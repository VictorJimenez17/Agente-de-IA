import { FormEvent, useState } from "react";
import { Upload, X } from "lucide-react";
import { uploadCandidatoCv } from "../services/agentApi";
import { VacanteItem } from "../types/agent";

interface UploadCvModalProps {
  vacantes: VacanteItem[];
  defaultVacanteCodigo: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadCvModal({
  vacantes,
  defaultVacanteCodigo,
  onClose,
  onUploaded,
}: UploadCvModalProps) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [vacanteCodigo, setVacanteCodigo] = useState(defaultVacanteCodigo);
  const [experienciaAnios, setExperienciaAnios] = useState("2");
  const [disponibilidadRotativos, setDisponibilidadRotativos] = useState(true);
  const [escolaridad, setEscolaridad] = useState("Preparatoria");
  const [file, setFile] = useState<File | null>(null);
  const [cvTexto, setCvTexto] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("nombre", nombre);
      formData.append("email", email);
      formData.append("vacanteCodigo", vacanteCodigo);
      formData.append("experienciaAnios", experienciaAnios);
      formData.append("disponibilidadRotativos", String(disponibilidadRotativos));
      formData.append("escolaridad", escolaridad);
      if (file) {
        formData.append("cv", file);
      } else {
        formData.append("cvTexto", cvTexto);
      }

      await uploadCandidatoCv(formData);
      onUploaded();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el candidato");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Registrar CV de Candidato</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Sofia Ramirez"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vacante *</label>
              <select
                value={vacanteCodigo}
                onChange={(e) => setVacanteCodigo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {vacantes.map((v) => (
                  <option key={v.codigo} value={v.codigo}>
                    {v.codigo} — {v.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Correo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sofia@ejemplo.local"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Años exp.</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={experienciaAnios}
                onChange={(e) => setExperienciaAnios(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Escolaridad</label>
              <input
                value={escolaridad}
                onChange={(e) => setEscolaridad(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={disponibilidadRotativos}
              onChange={(e) => setDisponibilidadRotativos(e.target.checked)}
            />
            Disponible para turnos rotativos
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Archivo CV (.txt, .md, .pdf, .docx)
            </label>
            <input
              type="file"
              accept=".txt,.md,.pdf,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-slate-600"
            />
          </div>

          {!file && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                O pega el texto del CV aquí
              </label>
              <textarea
                rows={4}
                value={cvTexto}
                onChange={(e) => setCvTexto(e.target.value)}
                placeholder="Resumen profesional, empleos previos y habilidades..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {submitting ? "Guardando..." : "Guardar CV"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
