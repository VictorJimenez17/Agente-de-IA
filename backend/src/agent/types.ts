export interface TraceSource {
  type: "db" | "policy_rag" | "cv_document";
  label: string;
  detail?: string;
}

export interface ToolExecutionRecord {
  name: string;
  args: Record<string, unknown>;
  durationMs: number;
  ok: boolean;
  summary: string;
}

export interface AgentTracePayload {
  sessionId: string;
  toolsUsed: ToolExecutionRecord[];
  sourcesCited: TraceSource[];
  securityFlags: string[];
  outOfScope: boolean;
  latencyMs: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
}

export interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface GeminiGenerateResult {
  parts: GeminiPart[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
