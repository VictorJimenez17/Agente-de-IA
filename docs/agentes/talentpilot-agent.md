# Ficha Técnica del Agente: TalentPilot

## 1. Propósito y usuario objetivo
- **Nombre:** TalentPilot (`HrAgentOrchestrator`)
- **Dominio:** Recursos Humanos — preselección de candidatos y consultas de políticas internas para **BistroNube**.
- **Usuario objetivo:** Analistas y coordinadores de RRHH que necesitan filtrar CVs con criterios objetivos, preparar entrevistas y validar normativas internas en segundos.

## 2. Configuración del modelo
- **Modelo por defecto:** `gemini-2.5-flash` (configurable vía `GEMINI_MODEL`).
- **Cliente:** `backend/src/agent/geminiClient.ts` (API REST de Google Gemini con reintentos ante errores transitorios).
- **Prompts versionados:**
  - Orquestador conversacional: [`prompts/rrhh-agent.v1.md`](../../prompts/rrhh-agent.v1.md)
  - Evaluador estructurado de CVs (JSON): [`prompts/cv-evaluator.v1.md`](../../prompts/cv-evaluator.v1.md)
  - Cargador con caché en memoria: `backend/src/agent/promptLoader.ts`

## 3. Herramientas disponibles (`HrAgentTools`)
Definidas en `backend/src/agent/tools.ts`:

| Herramienta | Propósito | Fuentes / Efecto |
| --- | --- | --- |
| `listar_vacantes` | Lista las vacantes activas con su código, requisitos y número de candidatos | Tabla `Vacante` + conteo de `Candidato` en PostgreSQL |
| `rankear_candidatos_vacante` | Evalúa todos los CVs de una vacante combinando reglas *knock-out* deterministas y rúbrica con LLM; devuelve ranking ordenado | Tablas `Vacante`, `Candidato` + `cv-evaluator.v1.md` |
| `generar_preguntas_entrevista` | Genera preguntas STAR personalizadas según fortalezas y brechas de un candidato frente a su vacante | Tablas `Candidato`, `Vacante` + Gemini |
| `consultar_politica_rrhh` | Recupera los fragmentos más relevantes de políticas internas usando BM25/TF y devuelve citas con documento y sección | Tabla `PoliticaChunk` (`policyRetriever.ts`) |
| `escalar_a_rrhh` | Registra un caso que requiere decisión humana (excepciones salariales, conflictos, apelaciones) | Respuesta estructurada y traza en `AgentTrace` |

## 4. Datos, estado y memoria
- **Persistencia en PostgreSQL (Prisma):**
  - `Vacante` y `Candidato`: vacantes activas, CVs en texto plano, puntajes, clasificación, estado *knock-out* y preguntas STAR.
  - `PoliticaChunk`: secciones de documentos Markdown indexadas con palabras clave.
  - `ChatSession` y `ChatMessage`: memoria conversacional persistente por `sessionId`.
  - `AgentTrace`: bitácora por turno con pasos ejecutados, herramientas, fuentes RAG, alertas de seguridad, latencia, tokens y costo USD estimado.
- **Sin memoria compartida no controlada:** Cada sesión mantiene su propio historial (`ChatSession`).

## 5. Flujo de ejecución por turno
1. **Recepción:** `POST /api/agent/chat` o `POST /api/agent/chat/stream` (SSE).
2. **Guardrails de entrada (`guardrails.ts`):**
   - `detectPromptInjection(message)`: si detecta intento de manipulación, bloquea la ejecución, registra flag de seguridad y responde de forma segura.
   - `isClearlyOutOfScope(message)`: si detecta consulta ajena a RRHH, rechaza sin consumir tokens del LLM.
3. **Bucle de Function Calling (`HrAgentOrchestrator`):**
   - Carga el historial de la sesión y el system prompt `rrhh-agent.v1.md`.
   - Emite eventos SSE en vivo (`status`, `tool_start`, `tool_result`, `token`, `trace`, `done`).
   - Ejecuta las herramientas solicitadas por Gemini hasta obtener la respuesta final (con límite máximo de iteraciones para evitar ciclos infinitos).
4. **Persistencia y observabilidad:** Guarda el mensaje del usuario, la respuesta del asistente y el registro completo en `AgentTrace`.

## 6. Límites y salvaguardas
- **Reglas Knock-Out deterministas (sin IA):** En `checkDeterministicKnockOut()`, un candidato queda descartado automáticamente si falta disponibilidad de turnos rotativos cuando la vacante lo exige, o si posee menos del 50% de la experiencia mínima requerida en vacantes de 2+ años.
- **Aislamiento de documentos no confiables:** Todo texto proveniente de CVs se sanitiza (`sanitizeUntrustedDocument()`) y se envuelve en etiquetas `<cv_no_confiable>` antes de enviarse al evaluador LLM.
- **Fallback ante fallo de API:** Si Gemini no responde, `buildFallbackEvaluation()` calcula un puntaje base determinista por coincidencia de habilidades.
- **Límite de iteraciones:** El bucle de herramientas acota el número de pasos por turno para garantizar respuesta predecible y control de costos.
