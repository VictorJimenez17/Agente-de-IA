# Dataset de Prueba (100% Sintético)

Todos los documentos, vacantes, currículums y políticas de este directorio fueron generados de forma sintética para fines exclusivos de demostración y pruebas técnicas. No contienen datos personales reales ni información confidencial de ninguna empresa.

## Origen y diseño
- **Empresa ficticia:** BistroNube (operación de cocinas centrales y restaurantes).
- **Vacantes (`3` perfiles operativos):**
  1. `VAC-JC-01` — Jefe de Cocina (CDMX Norte)
  2. `VAC-AC-02` — Auxiliar de Cocina (CDMX Centro)
  3. `VAC-AL-03` — Coordinador de Almacén e Inventarios (Guadalajara)
- **Currículums (`data/cvs/` + seed PostgreSQL):**
  - 9 perfiles sintéticos con nombres ficticios, correos `@ejemplo.local` y trayectorias variadas (candidatos ideales, en desarrollo, alta rotación, knock-out por turno/experiencia y **1 CV adversarial** con intento de *prompt injection* para validar `RF-06`).
- **Políticas internas (`data/politicas/`):**
  - Documentos en Markdown segmentados por sección para recuperación RAG con citas verificables (`RF-03`).
