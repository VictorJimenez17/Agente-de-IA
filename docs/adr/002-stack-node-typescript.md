# ADR-002: Stack Node.js + TypeScript sobre Python

- **Estado:** Aceptado
- **Fecha:** 2026-11-26

## Contexto
La solución requiere un backend API REST con streaming SSE, subida de archivos (`pdf`, `docx`, `txt`, `md`), acceso tipado a PostgreSQL y un frontend moderno en React + Vite, todo mantenible dentro de un mismo repositorio con CI automatizado y Docker Compose.

## Opciones consideradas
1. **Node.js 20 + TypeScript + Express + Prisma (backend) y React + TypeScript (frontend):** Unifica lenguaje, tipado estricto y herramientas de calidad (ESLint, Vitest, `tsc`) en todo el proyecto.
2. **Python + FastAPI (backend) y React + TypeScript (frontend):** Amplio ecosistema de IA en Python (LangChain/LlamaIndex), pero introduce dos ecosistemas de dependencias, linters y runners de pruebas distintos para un proyecto de alcance acotado.

## Decisión
Utilizar **Node.js 20 + TypeScript** tanto en backend como en frontend, implementando el orquestador del agente y las llamadas a Gemini directamente sin frameworks pesados de abstracción.

## Consecuencias
- **Positivas:** Código transparente y fácil de auditar (sin "caja negra" de frameworks), contratos de tipos compartidos conceptualmente entre backend y frontend, builds rápidos en GitHub Actions y contenedores Alpine ligeros.
- **Negativas / Mitigación:** Menor cantidad de librerías nativas de NLP/ML en comparación con Python; mitigado porque el razonamiento semántico se delega a Gemini 2.5 Flash y la recuperación RAG usa un algoritmo léxico propio en TypeScript.
