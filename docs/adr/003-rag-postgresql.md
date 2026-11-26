# ADR-003: RAG léxico (BM25/TF) en PostgreSQL sobre base vectorial

- **Estado:** Aceptado
- **Fecha:** 2026-11-26

## Contexto
El agente debe responder preguntas sobre las políticas internas de BistroNube (`politica-reclutamiento-y-entrevistas.md`, `reglamento-interno-operativo.md`, `politica-compensacion-y-beneficios.md`) citando documento y sección exacta.

## Opciones consideradas
1. **Chunking por sección Markdown + búsqueda BM25/TF en PostgreSQL (`PoliticaChunk`):** Aprovecha la misma instancia de PostgreSQL usada por Prisma, sin extensiones nativas ni servicios extra.
2. **PostgreSQL con `pgvector` o base vectorial externa (Chroma/Qdrant):** Mejor recuperación ante consultas con sinónimos puros, pero requiere imagen Docker personalizada o servicio adicional, más llamadas a API de embeddings y mayor complejidad operativa.

## Decisión
Implementar **chunking por encabezados Markdown** (`policyChunker.ts`) almacenado en la tabla `PoliticaChunk` de PostgreSQL, y realizar la recuperación mediante **scoring léxico BM25/TF + coincidencia de palabras clave** en `policyRetriever.ts`.

## Consecuencias
- **Positivas:** Cero dependencias de infraestructura adicionales (usa `postgres:16-alpine` estándar), latencia de recuperación de pocos milisegundos, costo cero de embeddings y trazabilidad exacta del documento y sección citada.
- **Negativas / Mitigación:** Sensibilidad a vocabulario exacto cuando el usuario usa sinónimos muy distintos al texto original. Se mitiga extrayendo palabras clave por chunk durante el seed y permitiendo ampliar fácilmente a `pgvector` en el futuro manteniendo la misma interfaz de `PolicyRetriever`.
