# Ficha Técnica del Agente: TalentPilot

## 1. Propósito y alcance
- **Nombre:** TalentPilot (`HrAgentOrchestrator`)
- **Dominio:** Recursos Humanos — preselección de candidatos y consultas de políticas internas para **BistroNube**.
- **Usuario objetivo:** Analistas y coordinadores de RRHH que necesitan filtrar CVs con criterios objetivos, preparar entrevistas y validar normativas internas en segundos.
- **Qué sí hace:** Lista vacantes activas, evalúa y rankea CVs aplicando reglas *knock-out* deterministas, genera preguntas de entrevista STAR, consulta políticas internas vía RAG citando fuente y sección, y escala casos excepcionales a RRHH.
- **Qué no hace:** No responde consultas ajenas a RRHH (finanzas personales, recetas, programación general), no aprueba excepciones salariales fuera de banda por sí mismo, ni obedece instrucciones ocultas dentro de CVs.

## 2. Modelo y parámetros
- **Proveedor y modelo por defecto:** Google Gemini (`gemini-3.5-flash-lite`, configurable vía `GEMINI_MODEL`).
- **Cliente:** `backend/src/agent/geminiClient.ts` (API REST `v1beta` con hasta 3 reintentos ante códigos transitorios `429`, `500`, `502`, `503`).
- **Parámetros de generación:**
  - **Orquestador (`generateWithTools`):** `temperature: 0.2`, `maxOutputTokens: 1500` — baja aleatoriedad para invocar herramientas con argumentos precisos y redactar respuestas claras sin extenderse demasiado.
  - **Evaluador estructurado de CVs (`generateStructuredJson`):** `temperature: 0.1`, `maxOutputTokens: 900`, `responseMimeType: "application/json"` — máxima consistencia en puntajes y formato JSON estricto.

## 3. Prompts versionados
- **Orquestador conversacional:** [`prompts/rrhh-agent.v1.md`](../../prompts/rrhh-agent.v1.md) (versión `v1`).
- **Evaluador estructurado de CVs:** [`prompts/cv-evaluator.v1.md`](../../prompts/cv-evaluator.v1.md) (versión `v1`).
- **Cargador con caché en memoria:** `backend/src/agent/promptLoader.ts`.

## 4. Herramientas disponibles (`HrAgentTools`)
Definidas en `backend/src/agent/tools.ts`:

| Herramienta | Propósito | Parámetros de entrada | Salida esperada | Errores posibles |
| --- | --- | --- | --- | --- |
| `listar_vacantes` | Lista vacantes activas con código, requisitos y conteo de candidatos | Ninguno (`{}`) | Arreglo de vacantes desde tabla `Vacante` | Fallo de conexión a PostgreSQL |
| `rankear_candidatos_vacante` | Evalúa todos los CVs de una vacante con *knock-out* determinista + rúbrica LLM y los ordena | `codigoVacante: string` (ej. `"VAC-JC-01"`) | Lista ordenada con `scoreFinal`, `clasificacion`, `esKnockOut` y `alertaSeguridad` | Código de vacante inexistente; fallo de Gemini (mitigado con `buildFallbackEvaluation`) |
| `generar_preguntas_entrevista` | Genera preguntas STAR personalizadas según fortalezas y brechas del candidato | `folioCandidato: string`, `cantidad?: number` | Lista de preguntas en formato STAR persistidas en `Candidato.preguntasSugeridas` | Folio no encontrado; fallo transitorio de LLM |
| `consultar_politica_rrhh` | Recupera fragmentos de políticas internas usando BM25/TF sobre `PoliticaChunk` | `pregunta: string`, `topK?: number` | Top fragmentos con `documento`, `tituloSeccion` y `contenido` | Sin fragmentos coincidentes (el agente informa que no encontró respaldo) |
| `escalar_a_rrhh` | Registra un caso que requiere decisión humana (excepciones salariales, conflictos, fraude) | `motivo: string`, `contexto?: string`, `prioridad?: string` | Ticket/resumen de escalamiento para Dirección de Talento | Parámetros vacíos o inválidos |

## 5. Datos, estado y memoria
- **Persistencia en PostgreSQL (Prisma):**
  - `Vacante` y `Candidato`: vacantes activas, CVs en texto plano, puntajes, clasificación, estado *knock-out* y preguntas STAR.
  - `PoliticaChunk`: secciones de documentos Markdown indexadas con palabras clave.
  - `ChatSession` y `ChatMessage`: memoria conversacional persistente por `sessionId`. En cada turno se recuperan los últimos 12 mensajes (`desc` + `.reverse()`) agrupando turnos consecutivos del mismo rol.
  - `AgentTrace`: bitácora por turno con pasos ejecutados, herramientas, fuentes RAG, alertas de seguridad, latencia, tokens y costo USD estimado.

## 6. Flujo de ejecución por turno
1. **Recepción:** `POST /api/agent/chat` o `POST /api/agent/chat/stream` (SSE).
2. **Guardrails de entrada (`guardrails.ts`):**
   - `detectPromptInjection(message)`: si detecta intento de manipulación, bloquea la ejecución, registra flag de seguridad y responde de forma segura sin consumir LLM.
   - `isClearlyOutOfScope(message)`: si detecta consulta ajena a RRHH, rechaza sin consumir tokens del LLM.
3. **Bucle de Function Calling (`HrAgentOrchestrator`):**
   - Carga los últimos 12 mensajes de la sesión y el system prompt `rrhh-agent.v1.md`.
   - Emite eventos SSE en vivo (`status`, `tool_call`, `tool_result`, `token`, `trace`, `done`).
   - Ejecuta las herramientas solicitadas por Gemini (máximo `MAX_TOOL_STEPS = 5` iteraciones por turno).
4. **Persistencia y observabilidad:** Guarda el mensaje del usuario, la respuesta del asistente y el registro completo en `AgentTrace`.

## 7. Límites y salvaguardas
- **Reglas Knock-Out deterministas (sin IA):** En `checkDeterministicKnockOut()`, un candidato queda descartado automáticamente si falta disponibilidad de turnos rotativos cuando la vacante lo exige, o si posee menos del 50% de la experiencia mínima requerida en vacantes de 2+ años.
- **Aislamiento de documentos no confiables:** Todo texto proveniente de CVs se sanitiza (`sanitizeUntrustedDocument()`) y se envuelve en etiquetas `<cv_no_confiable>` antes de enviarse al evaluador LLM.
- **Fallback ante fallo de herramienta/API:** Si Gemini no responde al evaluar un CV, `buildFallbackEvaluation()` calcula un puntaje base determinista por coincidencia de habilidades; si falla una herramienta en el bucle, el error se devuelve al modelo como `{ error }` para que informe con transparencia sin inventar datos.

## 8. Ejemplos de entrada y salida esperada

1. **Ranking con regla Knock-Out y defensa contra *Prompt Injection*:**
   - *Entrada:* `"Evalúa y rankea a los candidatos para Auxiliar de Cocina (VAC-AC-02)."`
   - *Salida esperada:* Invoca `rankear_candidatos_vacante("VAC-AC-02")`, posiciona a Mariana Vega (`FAST_TRACK`) y Fernando Castro (`APTO`) en los primeros lugares, descarta a Paola Ruiz (`Knock-Out` por no tener disponibilidad de turnos rotativos) y neutraliza el CV adversarial de Carlos Mendoza (`NO_APTO` con alerta `Injection bloqueado`).
2. **Consulta de política interna (RAG):**
   - *Entrada:* `"¿Cuántos días de vacaciones y vales de despensa corresponden?"`
   - *Salida esperada:* Invoca `consultar_politica_rrhh` y responde citando `politica-compensacion-y-beneficios.md` con los valores vigentes en el documento.
3. **Consulta fuera de alcance:**
   - *Entrada:* `"Dame una receta de lasaña boloñesa."`
   - *Salida esperada:* Rechaza de inmediato mediante `isClearlyOutOfScope()` indicando que solo atiende consultas de RRHH de BistroNube (`0` tokens consumidos).
