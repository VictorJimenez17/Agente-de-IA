import { prisma } from "@infrastructure/database/prismaClient";
import { ValidationError } from "@shared/errors/AppError";
import { estimateCostUsd, GeminiClient } from "./geminiClient";
import { detectPromptInjection, isClearlyOutOfScope } from "./guardrails";
import { loadPrompt } from "./promptLoader";
import { AGENT_TOOL_DECLARATIONS, HrAgentTools } from "./tools";
import {
  AgentTracePayload,
  GeminiMessage,
  ToolExecutionRecord,
  TraceSource,
} from "./types";

export type AgentStreamEvent =
  | { type: "status"; data: { message: string } }
  | { type: "tool_call"; data: { name: string; args: Record<string, unknown> } }
  | { type: "tool_result"; data: { name: string; ok: boolean; summary: string } }
  | { type: "delta"; data: { text: string } }
  | { type: "trace"; data: AgentTracePayload }
  | { type: "done"; data: { sessionId: string; reply: string } };

export interface AgentChatResult {
  sessionId: string;
  reply: string;
  trace: AgentTracePayload;
}

const MAX_TOOL_STEPS = 5;

export class HrAgentOrchestrator {
  constructor(
    private readonly gemini: GeminiClient = new GeminiClient(),
    private readonly tools: HrAgentTools = new HrAgentTools(gemini)
  ) {}

  async handleMessage(input: {
    sessionId?: string;
    message: string;
    onEvent?: (event: AgentStreamEvent) => void;
  }): Promise<AgentChatResult> {
    const startMs = Date.now();
    const userMessage = input.message?.trim();
    if (!userMessage) {
      throw new ValidationError("El mensaje no puede estar vacio.");
    }

    const emit = input.onEvent ?? (() => undefined);
    emit({ type: "status", data: { message: "Iniciando sesion y validando entrada..." } });

    const session = input.sessionId
      ? await prisma.chatSession.upsert({
          where: { id: input.sessionId },
          update: { updatedAt: new Date() },
          create: { id: input.sessionId, titulo: userMessage.slice(0, 60) },
        })
      : await prisma.chatSession.create({
          data: { titulo: userMessage.slice(0, 60) },
        });

    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: "user", content: userMessage },
    });

    const injectionScan = detectPromptInjection(userMessage);
    if (injectionScan.detected) {
      const refusal =
        "Solicitud bloqueada por seguridad: se detectaron instrucciones destinadas a alterar las reglas del sistema o exfiltrar configuracion interna. Puedo ayudarte unicamente con preseleccion de CVs, entrevistas STAR o politicas de RRHH.";

      return this.finishWithStaticReply({
        sessionId: session.id,
        userQuery: userMessage,
        reply: refusal,
        securityFlags: [`USER_PROMPT_INJECTION:${injectionScan.matchedPatterns.join(",")}`],
        outOfScope: true,
        startMs,
        emit,
      });
    }

    if (isClearlyOutOfScope(userMessage)) {
      const refusal =
        "Esta consulta esta fuera de mi alcance. Soy un asistente especializado de RRHH para BistroNube: puedo listar vacantes, evaluar y rankear CVs, sugerir preguntas STAR y responder dudas sobre el reglamento y politicas internas vigentes.";

      return this.finishWithStaticReply({
        sessionId: session.id,
        userQuery: userMessage,
        reply: refusal,
        securityFlags: [],
        outOfScope: true,
        startMs,
        emit,
      });
    }

    const historyRows = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      take: 12,
    });

    const contents: GeminiMessage[] = historyRows.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const systemInstruction = loadPrompt("rrhh-agent.v1.md");
    const toolsUsed: ToolExecutionRecord[] = [];
    const sourcesCited: TraceSource[] = [];
    const securityFlags: string[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let finalReply = "";

    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      emit({
        type: "status",
        data: {
          message:
            step === 0
              ? "Analizando intencion y consultando herramientas..."
              : "Sintetizando respuesta con base en los resultados...",
        },
      });

      const response = await this.gemini.generateWithTools({
        systemInstruction,
        contents,
        tools: AGENT_TOOL_DECLARATIONS,
        temperature: 0.2,
      });

      promptTokens += response.promptTokens;
      completionTokens += response.completionTokens;
      totalTokens += response.totalTokens;

      const functionCalls = response.parts.filter((p) => Boolean(p.functionCall));
      if (functionCalls.length === 0) {
        finalReply = response.parts
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        break;
      }

      contents.push({ role: "model", parts: response.parts });

      const responseParts: GeminiMessage["parts"] = [];
      for (const part of functionCalls) {
        const call = part.functionCall!;
        emit({ type: "tool_call", data: { name: call.name, args: call.args || {} } });

        const toolStart = Date.now();
        try {
          const out = await this.tools.execute(call.name, call.args || {});
          const durationMs = Date.now() - toolStart;
          const summary = `Ejecutada en ${durationMs}ms (${out.sources.length} fuente(s))`;

          toolsUsed.push({
            name: call.name,
            args: call.args || {},
            durationMs,
            ok: true,
            summary,
          });
          sourcesCited.push(...out.sources);
          securityFlags.push(...out.securityFlags);
          if (out.extraTokens) {
            totalTokens += out.extraTokens;
            promptTokens += Math.round(out.extraTokens * 0.7);
            completionTokens += Math.round(out.extraTokens * 0.3);
          }

          emit({ type: "tool_result", data: { name: call.name, ok: true, summary } });
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: out.result,
            },
          });
        } catch (err: unknown) {
          const durationMs = Date.now() - toolStart;
          const errMessage = err instanceof Error ? err.message : "Error desconocido en herramienta";
          toolsUsed.push({
            name: call.name,
            args: call.args || {},
            durationMs,
            ok: false,
            summary: errMessage,
          });
          emit({ type: "tool_result", data: { name: call.name, ok: false, summary: errMessage } });
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { error: errMessage },
            },
          });
        }
      }

      contents.push({ role: "user", parts: responseParts });
    }

    if (!finalReply) {
      finalReply =
        "No logre generar una respuesta concluyente con la informacion disponible. Por favor intenta reformular tu consulta de RRHH.";
    }

    const dedupedSources = deduplicateSources(sourcesCited);
    const trace: AgentTracePayload = {
      sessionId: session.id,
      toolsUsed,
      sourcesCited: dedupedSources,
      securityFlags: Array.from(new Set(securityFlags)),
      outOfScope: false,
      latencyMs: Date.now() - startMs,
      estimatedTokens: totalTokens,
      estimatedCostUsd: estimateCostUsd(promptTokens, completionTokens),
    };

    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: "assistant", content: finalReply },
    });

    await prisma.agentTrace.create({
      data: {
        sessionId: session.id,
        userQuery: userMessage,
        toolsUsed: trace.toolsUsed as unknown as object,
        sourcesCited: trace.sourcesCited as unknown as object,
        securityFlags: trace.securityFlags as unknown as object,
        outOfScope: trace.outOfScope,
        latencyMs: trace.latencyMs,
        estimatedTokens: trace.estimatedTokens,
        estimatedCostUsd: trace.estimatedCostUsd,
      },
    });

    await emitTextChunks(finalReply, emit);
    emit({ type: "trace", data: trace });
    emit({ type: "done", data: { sessionId: session.id, reply: finalReply } });

    return {
      sessionId: session.id,
      reply: finalReply,
      trace,
    };
  }

  private async finishWithStaticReply(params: {
    sessionId: string;
    userQuery: string;
    reply: string;
    securityFlags: string[];
    outOfScope: boolean;
    startMs: number;
    emit: (event: AgentStreamEvent) => void;
  }): Promise<AgentChatResult> {
    const trace: AgentTracePayload = {
      sessionId: params.sessionId,
      toolsUsed: [],
      sourcesCited: [],
      securityFlags: params.securityFlags,
      outOfScope: params.outOfScope,
      latencyMs: Date.now() - params.startMs,
      estimatedTokens: 0,
      estimatedCostUsd: 0,
    };

    await prisma.chatMessage.create({
      data: { sessionId: params.sessionId, role: "assistant", content: params.reply },
    });

    await prisma.agentTrace.create({
      data: {
        sessionId: params.sessionId,
        userQuery: params.userQuery,
        toolsUsed: [],
        sourcesCited: [],
        securityFlags: trace.securityFlags as unknown as object,
        outOfScope: trace.outOfScope,
        latencyMs: trace.latencyMs,
        estimatedTokens: 0,
        estimatedCostUsd: 0,
      },
    });

    await emitTextChunks(params.reply, params.emit);
    params.emit({ type: "trace", data: trace });
    params.emit({
      type: "done",
      data: { sessionId: params.sessionId, reply: params.reply },
    });

    return {
      sessionId: params.sessionId,
      reply: params.reply,
      trace,
    };
  }
}

function deduplicateSources(sources: TraceSource[]): TraceSource[] {
  const seen = new Set<string>();
  return sources.filter((src) => {
    const key = `${src.type}:${src.label}:${src.detail ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function emitTextChunks(
  text: string,
  emit: (event: AgentStreamEvent) => void
): Promise<void> {
  const chunkSize = 48;
  for (let i = 0; i < text.length; i += chunkSize) {
    emit({ type: "delta", data: { text: text.slice(i, i + chunkSize) } });
  }
}
