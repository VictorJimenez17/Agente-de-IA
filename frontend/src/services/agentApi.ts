import axios from "axios";
import { AgentTrace, CandidatoItem, VacanteItem } from "../types/agent";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const http = axios.create({
  baseURL: API_BASE,
  timeout: 45000,
});

export async function fetchVacantes(): Promise<VacanteItem[]> {
  const res = await http.get<VacanteItem[]>("/vacantes");
  return res.data;
}

export async function uploadCandidatoCv(formData: FormData): Promise<CandidatoItem> {
  const res = await http.post<CandidatoItem>("/candidatos/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export interface StreamCallbacks {
  onStatus: (message: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onToolResult: (name: string, ok: boolean, summary: string) => void;
  onDelta: (text: string) => void;
  onTrace: (trace: AgentTrace) => void;
  onDone: (sessionId: string, reply: string) => void;
  onError: (message: string) => void;
}

export function parseSseBlock(block: string): { event: string; data: unknown } | null {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

export async function streamAgentChat(
  params: { sessionId?: string; message: string },
  callbacks: StreamCallbacks
): Promise<void> {
  const response = await fetch(`${API_BASE}/agent/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    throw new Error(errText || `Error HTTP ${response.status} al conectar con el agente`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const parsed = parseSseBlock(part);
      if (!parsed) continue;
      dispatchSseEvent(parsed.event, parsed.data, callbacks);
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer);
    if (parsed) {
      dispatchSseEvent(parsed.event, parsed.data, callbacks);
    }
  }
}

function dispatchSseEvent(
  event: string,
  data: unknown,
  callbacks: StreamCallbacks
): void {
  const payload = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;

  switch (event) {
    case "status":
      callbacks.onStatus(String(payload.message ?? ""));
      break;
    case "tool_call":
      callbacks.onToolCall(
        String(payload.name ?? ""),
        (payload.args as Record<string, unknown>) || {}
      );
      break;
    case "tool_result":
      callbacks.onToolResult(
        String(payload.name ?? ""),
        Boolean(payload.ok),
        String(payload.summary ?? "")
      );
      break;
    case "delta":
      callbacks.onDelta(String(payload.text ?? ""));
      break;
    case "trace":
      callbacks.onTrace(data as AgentTrace);
      break;
    case "done":
      callbacks.onDone(String(payload.sessionId ?? ""), String(payload.reply ?? ""));
      break;
    case "error":
      callbacks.onError(String(payload.error ?? "Error durante el streaming"));
      break;
  }
}
