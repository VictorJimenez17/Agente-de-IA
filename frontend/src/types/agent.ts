export interface CandidatoItem {
  id: string;
  folio: string;
  nombre: string;
  email: string;
  ciudad: string;
  vacanteId: string;
  experienciaAnios: number;
  disponibilidadRotativos: boolean;
  escolaridad: string;
  cvArchivoNombre?: string | null;
  scoreFinal: number | null;
  clasificacion: string | null;
  esKnockOut: boolean;
  motivoKnockOut: string | null;
  justificacion: string | null;
  preguntasSugeridas: string[] | null;
  alertaSeguridad: string | null;
  evaluadoAt: string | null;
}

export interface VacanteItem {
  id: string;
  codigo: string;
  titulo: string;
  departamento: string;
  ubicacion: string;
  descripcion: string;
  requisitos: string;
  experienciaMinAnios: number;
  requiereRotativos: boolean;
  escolaridadMinima: string;
  habilidadesClave: string[];
  salarioMensual: number | null;
  cupo: number;
  candidatos: CandidatoItem[];
}

export interface ToolExecutionRecord {
  name: string;
  args: Record<string, unknown>;
  durationMs: number;
  ok: boolean;
  summary: string;
}

export interface TraceSource {
  type: "db" | "policy_rag" | "cv_document";
  label: string;
  detail?: string;
}

export interface AgentTrace {
  sessionId: string;
  toolsUsed: ToolExecutionRecord[];
  sourcesCited: TraceSource[];
  securityFlags: string[];
  outOfScope: boolean;
  latencyMs: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  trace?: AgentTrace;
}
