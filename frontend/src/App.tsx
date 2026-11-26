import { useCallback, useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { ChatPanel } from "./components/ChatPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RankingPanel } from "./components/RankingPanel";
import { TraceabilityPanel } from "./components/TraceabilityPanel";
import { fetchVacantes, streamAgentChat } from "./services/agentApi";
import { AgentTrace, ChatTurn, VacanteItem } from "./types/agent";

interface LiveToolStep {
  name: string;
  status: "running" | "ok" | "error";
  detail: string;
}

export default function App() {
  const [vacantes, setVacantes] = useState<VacanteItem[]>([]);
  const [loadingVacantes, setLoadingVacantes] = useState(false);

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveStatus, setLiveStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestTrace, setLatestTrace] = useState<AgentTrace | null>(null);
  const [liveSteps, setLiveSteps] = useState<LiveToolStep[]>([]);

  const loadVacantes = useCallback(async () => {
    setLoadingVacantes(true);
    try {
      const data = await fetchVacantes();
      setVacantes(data);
    } catch {
      // Si el backend aun esta iniciando, el panel sigue operativo
    } finally {
      setLoadingVacantes(false);
    }
  }, []);

  useEffect(() => {
    void loadVacantes();
  }, [loadVacantes]);

  const handleSend = async (message: string) => {
    setErrorMessage(null);
    setIsStreaming(true);
    setLiveStatus("Conectando con el agente...");
    setLiveSteps([]);

    const userTurnId = `u-${Date.now()}`;
    const assistantTurnId = `a-${Date.now() + 1}`;

    setTurns((prev) => [
      ...prev,
      { id: userTurnId, role: "user", content: message },
      { id: assistantTurnId, role: "assistant", content: "" },
    ]);

    try {
      await streamAgentChat(
        { sessionId, message },
        {
          onStatus: (msg) => setLiveStatus(msg),
          onToolCall: (name, args) => {
            setLiveStatus(`Ejecutando herramienta: ${name}`);
            setLiveSteps((prev) => [
              ...prev,
              { name, status: "running", detail: JSON.stringify(args) },
            ]);
          },
          onToolResult: (name, ok, summary) => {
            setLiveSteps((prev) =>
              prev.map((step, idx) =>
                idx === prev.length - 1 && step.name === name
                  ? { ...step, status: ok ? "ok" : "error", detail: summary }
                  : step
              )
            );
          },
          onDelta: (chunk) => {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantTurnId ? { ...t, content: t.content + chunk } : t
              )
            );
          },
          onTrace: (trace) => {
            setLatestTrace(trace);
            setSessionId(trace.sessionId);
          },
          onDone: (newSessionId, fullReply) => {
            setSessionId(newSessionId);
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantTurnId ? { ...t, content: fullReply } : t
              )
            );
            void loadVacantes();
          },
          onError: (err) => setErrorMessage(err),
        }
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error de conexion con el agente");
    } finally {
      setIsStreaming(false);
      setLiveStatus("");
    }
  };

  const handleResetSession = () => {
    setSessionId(undefined);
    setTurns([]);
    setLatestTrace(null);
    setLiveSteps([]);
    setErrorMessage(null);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="bg-slate-900 text-white border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight">
                  TalentPilot AI — Agente de RRHH (BistroNube)
                </h1>
                <p className="text-xs text-slate-300">
                  Preselección de CVs, Entrevistas STAR y Políticas Internas con RAG
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
              SSE Streaming + Guardrails Activos
            </span>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8">
              <ChatPanel
                turns={turns}
                isStreaming={isStreaming}
                liveStatus={liveStatus}
                errorMessage={errorMessage}
                sessionId={sessionId}
                onSend={handleSend}
                onResetSession={handleResetSession}
              />
            </div>
            <div className="lg:col-span-4">
              <TraceabilityPanel
                trace={latestTrace}
                liveSteps={liveSteps}
                isStreaming={isStreaming}
              />
            </div>
          </div>

          <RankingPanel
            vacantes={vacantes}
            loading={loadingVacantes}
            onRefresh={() => void loadVacantes()}
            onAskAgentRank={(codigo) =>
              void handleSend(
                `Evalúa y rankea los candidatos de la vacante ${codigo} indicando justificación, knock-out y alertas.`
              )
            }
          />
        </main>
      </div>
    </ErrorBoundary>
  );
}
