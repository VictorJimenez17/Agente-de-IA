import axios from "axios";
import { AppError } from "@shared/errors/AppError";
import { GeminiGenerateResult, GeminiMessage, ToolDeclaration } from "./types";

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiGenerateResult["parts"];
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiClient {
  private readonly model: string;

  constructor(model?: string) {
    this.model = model || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  }

  private getApiKey(): string {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new AppError(
        "GEMINI_API_KEY no esta configurada en las variables de entorno.",
        503
      );
    }
    return key;
  }

  private async postWithRetry(body: Record<string, unknown>, maxRetries = 3): Promise<GeminiApiResponse> {
    const apiKey = this.getApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await axios.post<GeminiApiResponse>(url, body, {
          headers: { "Content-Type": "application/json" },
          timeout: 45000,
        });
        return res.data;
      } catch (err: unknown) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        const transient = status === 429 || status === 500 || status === 502 || status === 503;
        if (transient && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
          continue;
        }
        if (axios.isAxiosError(err)) {
          const detail =
            (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message ||
            err.message;
          throw new AppError(`Error al consultar Gemini (${status ?? "red"}): ${detail}`, 502);
        }
        throw err;
      }
    }

    throw new AppError("No se obtuvo respuesta de Gemini tras los reintentos.", 502);
  }

  async generateWithTools(params: {
    systemInstruction: string;
    contents: GeminiMessage[];
    tools: ToolDeclaration[];
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<GeminiGenerateResult> {
    const data = await this.postWithRetry({
      systemInstruction: {
        parts: [{ text: params.systemInstruction }],
      },
      contents: params.contents,
      tools: params.tools.length > 0 ? [{ functionDeclarations: params.tools }] : undefined,
      generationConfig: {
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxOutputTokens ?? 1500,
      },
    });

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const usage = data.usageMetadata;

    return {
      parts,
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
      totalTokens: usage?.totalTokenCount ?? 0,
    };
  }

  async generateStructuredJson(params: {
    systemInstruction: string;
    userContent: string;
    temperature?: number;
  }): Promise<{ text: string; totalTokens: number }> {
    const data = await this.postWithRetry({
      systemInstruction: {
        parts: [{ text: params.systemInstruction }],
      },
      contents: [{ role: "user", parts: [{ text: params.userContent }] }],
      generationConfig: {
        temperature: params.temperature ?? 0.1,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    });

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      text,
      totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
    };
  }
}

export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  // Tarifas de referencia Gemini 2.5 Flash (~$0.15 / 1M input, ~$0.60 / 1M output)
  const cost = (promptTokens / 1_000_000) * 0.15 + (completionTokens / 1_000_000) * 0.6;
  return Number(cost.toFixed(6));
}
