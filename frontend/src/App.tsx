import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            TalentPilot AI
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Agente de Preselección de CVs y Políticas de RRHH
          </h1>
          <p className="text-sm text-slate-600">
            Estructura base lista. En los siguientes pasos conectaremos el chat en streaming,
            el ranking de candidatos y la trazabilidad en vivo.
          </p>
        </div>
      </main>
    </ErrorBoundary>
  );
}
