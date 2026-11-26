import { useState } from "react";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import { CandidatoItem, VacanteItem } from "../types/agent";
import { UploadCvModal } from "./UploadCvModal";

interface RankingPanelProps {
  vacantes: VacanteItem[];
  loading: boolean;
  onRefresh: () => void;
  onAskAgentRank: (vacanteCodigo: string) => void;
}

const BADGE_CLASS: Record<string, string> = {
  FAST_TRACK: "bg-emerald-100 text-emerald-800",
  APTO: "bg-blue-100 text-blue-800",
  RESERVA: "bg-amber-100 text-amber-800",
  NO_APTO: "bg-red-100 text-red-800",
};

export function RankingPanel({
  vacantes,
  loading,
  onRefresh,
  onAskAgentRank,
}: RankingPanelProps) {
  const [selectedCodigo, setSelectedCodigo] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const activeVacante =
    vacantes.find((v) => v.codigo === selectedCodigo) ?? vacantes[0] ?? null;

  const exportCsv = (vacante: VacanteItem) => {
    const headers = ["Folio", "Nombre", "Experiencia_Anios", "Score", "Clasificacion", "KnockOut", "Alerta_Seguridad"];
    const rows = vacante.candidatos.map((c) => [
      c.folio,
      `"${c.nombre}"`,
      c.experienciaAnios,
      c.scoreFinal ?? "Sin evaluar",
      c.clasificacion ?? "Pendiente",
      c.esKnockOut ? "SI" : "NO",
      `"${c.alertaSeguridad ?? ""}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ranking-${vacante.codigo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-slate-700" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Vacantes y Ranking de Candidatos
            </h2>
            <p className="text-xs text-slate-500">
              Resultados persistidos por el agente tras aplicar política BistroNube y reglas knock-out
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          {activeVacante && (
            <>
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Subir CV
              </button>
              <button
                type="button"
                onClick={() => exportCsv(activeVacante)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() => onAskAgentRank(activeVacante.codigo)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Rankear con Agente
              </button>
            </>
          )}
        </div>
      </div>

      {vacantes.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          {vacantes.map((vac) => {
            const active = activeVacante?.codigo === vac.codigo;
            return (
              <button
                key={vac.codigo}
                type="button"
                onClick={() => setSelectedCodigo(vac.codigo)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                {vac.codigo} · {vac.titulo} ({vac.candidatos.length})
              </button>
            );
          })}
        </div>
      )}

      {!activeVacante ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          No hay vacantes cargadas. Ejecuta el seed de base de datos para poblar el dataset sintético.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <strong>Ubicación:</strong> {activeVacante.ubicacion}
            </span>
            <span>
              <strong>Exp. mínima:</strong> {activeVacante.experienciaMinAnios} años
            </span>
            <span>
              <strong>Turnos rotativos:</strong> {activeVacante.requiereRotativos ? "Obligatorio" : "Opcional"}
            </span>
            <span>
              <strong>Salario base:</strong>{" "}
              {activeVacante.salarioMensual
                ? `$${activeVacante.salarioMensual.toLocaleString("es-MX")} MXN`
                : "Por definir"}
            </span>
          </div>

          <div className="space-y-2">
            {activeVacante.candidatos.map((cand: CandidatoItem) => {
              const isExpanded = expandedId === cand.id;
              const badge = cand.clasificacion
                ? BADGE_CLASS[cand.clasificacion] || "bg-slate-100 text-slate-700"
                : "bg-slate-100 text-slate-500";

              return (
                <div
                  key={cand.id}
                  className="border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">{cand.folio}</span>
                        <span className="text-sm font-semibold text-slate-900">{cand.nombre}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge}`}>
                          {cand.clasificacion ?? "PENDIENTE"}
                        </span>
                        {cand.esKnockOut && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            Knock-Out
                          </span>
                        )}
                        {cand.alertaSeguridad && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            <ShieldAlert className="w-3 h-3" />
                            Injection bloqueado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cand.experienciaAnios} años exp. · {cand.escolaridad} · Rotativos:{" "}
                        {cand.disponibilidadRotativos ? "Sí" : "No"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900">
                          {cand.scoreFinal !== null ? `${cand.scoreFinal}/100` : "—"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : cand.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-2 text-slate-700">
                      {cand.motivoKnockOut && (
                        <p className="text-red-700">
                          <strong>Motivo Knock-Out:</strong> {cand.motivoKnockOut}
                        </p>
                      )}
                      {cand.alertaSeguridad && (
                        <p className="text-amber-800">
                          <strong>Seguridad:</strong> {cand.alertaSeguridad}
                        </p>
                      )}
                      <p>
                        <strong>Justificación IA:</strong>{" "}
                        {cand.justificacion || "Aún no evaluado por el agente."}
                      </p>
                      {Array.isArray(cand.preguntasSugeridas) && cand.preguntasSugeridas.length > 0 && (
                        <div>
                          <strong>Preguntas STAR sugeridas:</strong>
                          <ol className="list-decimal pl-5 mt-1 space-y-1 text-slate-600">
                            {cand.preguntasSugeridas.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showUpload && activeVacante && (
        <UploadCvModal
          vacantes={vacantes}
          defaultVacanteCodigo={activeVacante.codigo}
          onClose={() => setShowUpload(false)}
          onUploaded={onRefresh}
        />
      )}
    </section>
  );
}
