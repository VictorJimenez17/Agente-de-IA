import { Activity, AlertOctagon, CheckCircle2, Clock, Database, ShieldAlert, Wrench } from "lucide-react";
import { AgentTrace } from "../types/agent";

interface LiveToolStep {
  name: string;
  status: "running" | "ok" | "error";
  detail: string;
}

interface TraceabilityPanelProps {
  trace: AgentTrace | null;
  liveSteps: LiveToolStep[];
  isStreaming: boolean;
}

export function TraceabilityPanel({ trace, liveSteps, isStreaming }: TraceabilityPanelProps) {
  return (
    <aside className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col gap-4 h-[640px] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">Trazabilidad en Vivo (RF-08)</h2>
        </div>
        {isStreaming && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            Procesando
          </span>
        )}
      </div>

      {liveSteps.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Ejecución de Herramientas
          </h3>
          <ul className="space-y-2">
            {liveSteps.map((step, idx) => (
              <li
                key={`${step.name}-${idx}`}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
              >
                <div className="flex items-center justify-between font-medium text-slate-800">
                  <span className="inline-flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-slate-600" />
                    {step.name}
                  </span>
                  {step.status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  {step.status === "error" && <AlertOctagon className="w-3.5 h-3.5 text-red-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 break-all">{step.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!trace && liveSteps.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-400 px-4">
          Envía una consulta al agente para inspeccionar herramientas invocadas, fuentes citadas,
          alertas de seguridad, latencia y tokens.
        </div>
      )}

      {trace && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="w-3 h-3" /> Latencia
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{trace.latencyMs} ms</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">Tokens</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{trace.estimatedTokens}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">Costo est.</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                ${trace.estimatedCostUsd.toFixed(5)}
              </div>
            </div>
          </div>

          {trace.outOfScope && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <span className="font-semibold">Guardrail RF-05:</span> Consulta clasificada fuera de
              alcance; el agente se abstuvo sin inventar respuesta.
            </div>
          )}

          {trace.securityFlags.length > 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="w-4 h-4" />
                Alertas de Prompt Injection (RF-06)
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {trace.securityFlags.map((flag) => (
                  <li key={flag} className="break-all">
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Fuentes Consultadas ({trace.sourcesCited.length})
            </h3>
            {trace.sourcesCited.length === 0 ? (
              <p className="text-xs text-slate-400">Sin fuentes consultadas en este turno.</p>
            ) : (
              <ul className="space-y-1.5">
                {trace.sourcesCited.map((src, idx) => (
                  <li
                    key={`${src.label}-${idx}`}
                    className="p-2 rounded-lg border border-slate-200 text-xs flex items-start gap-2"
                  >
                    <Database className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-slate-800">{src.label}</span>
                      {src.detail && <p className="text-[11px] text-slate-500">{src.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
