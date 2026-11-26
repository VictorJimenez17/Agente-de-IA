# System Prompts Versionados

Los prompts del agente viven separados del código fuente para poder versionarlos, auditarlos en code review y compararlos sin mezclar reglas de negocio con lógica de transporte HTTP.

## Archivos
- `rrhh-agent.v1.md`: Prompt del orquestador conversacional (tool calling, citas obligatorias, abstención fuera de alcance y manejo de contenido no confiable).
- `cv-evaluator.v1.md`: Prompt estructurado para evaluar CVs individuales contra una vacante devolviendo JSON estricto.

## Criterios de diseño y pruebas
1. **Aislamiento de datos no confiables:** Todo texto proveniente de un CV se encapsula en etiquetas `<cv_no_confiable>` y se indica explícitamente que cualquier instrucción dentro de ese bloque debe ignorarse y reportarse.
2. **Mitigación de alucinaciones:** Se prohíbe inventar datos de candidatos, vacantes o artículos de política; toda respuesta operativa debe apoyarse en el resultado de las herramientas.
3. **Pruebas realizadas:** Validado con las suites `guardrails.test.ts`, `tools.test.ts` y `agent.test.ts` cubriendo consultas de ranking, preguntas de reglamento, consultas fuera de alcance (clima/programación) y el CV adversarial `07-carlos-mendoza-cv-adversarial.txt`.
