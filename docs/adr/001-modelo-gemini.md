# ADR-001: Elección de Gemini 2.5 Flash como modelo principal

- **Estado:** Aceptado
- **Fecha:** 2026-11-26

## Contexto
El agente **TalentPilot** necesita:
1. Soportar *Function Calling* confiable para orquestar 5 herramientas (`listar_vacantes`, `rankear_candidatos_vacante`, `generar_preguntas_entrevista`, `consultar_politica_rrhh`, `escalar_a_rrhh`).
2. Emitir salidas JSON estructuradas para evaluar CVs según rúbrica y puntajes.
3. Mantener baja latencia y costo contenido al procesar múltiples CVs por vacante en una interfaz con streaming SSE.

## Opciones consideradas
1. **Google Gemini 2.5 Flash:** Soporte nativo de Function Calling y JSON estructurado vía API REST, ventana de contexto amplia, baja latencia y costo reducido (~USD \$0.15 / 1M tokens de entrada, ~USD \$0.60 / 1M tokens de salida).
2. **Modelos de razonamiento pesado (ej. Gemini Pro / GPT-4o):** Mayor capacidad en razonamiento complejo, pero mayor latencia (2–3x) y costo por evaluación masiva de CVs.
3. **Modelos locales (Ollama / Llama 3):** Sin costo por token, pero requieren GPU local y complican el despliegue reproducible en Docker ligero y entornos CI/entrevista.

## Decisión
Adoptar **Gemini 2.5 Flash** (`GEMINI_MODEL=gemini-2.5-flash`) como modelo por defecto, encapsulado en `backend/src/agent/geminiClient.ts` con reintentos exponenciales y cálculo de costo estimado por consulta.

## Consecuencias
- **Positivas:** Respuestas rápidas en streaming SSE, costo inferior a \$0.002 USD por ranking completo de vacante y configuración sencilla mediante una sola `GEMINI_API_KEY`.
- **Negativas / Mitigación:** Dependencia de conectividad externa a la API de Google. Se mitiga con `buildFallbackEvaluation()` en `tools.ts`, que permite evaluar habilidades de forma determinista si la API no está disponible.
