import { describe, expect, it, vi } from "vitest";

vi.mock("@infrastructure/database/prismaClient", () => ({
  prisma: {
    politicaChunk: {
      findMany: vi.fn().mockResolvedValue([
        {
          documento: "reglamento-interno-operativo.md",
          tituloSeccion: "4. Vacaciones y permisos especiales",
          contenido:
            "Los colaboradores tienen derecho a disfrutar de 12 dias de vacaciones pagadas al cumplir el primer ano de servicio.",
          palabrasClave: ["vacaciones", "permisos", "servicio", "colaboradores"],
        },
        {
          documento: "politica-compensacion-y-beneficios.md",
          tituloSeccion: "1. Tabulador salarial mensual de referencia",
          contenido: "Jefe de Cocina: $18,000 MXN mensuales brutos.",
          palabrasClave: ["tabulador", "salarial", "jefe", "cocina"],
        },
      ]),
    },
  },
}));

import { searchPoliciesInDb } from "../src/infrastructure/rag/policyRetriever";

describe("policyRetriever RAG", () => {
  it("recupera la seccion mas relevante y ordena por relevancia", async () => {
    const results = await searchPoliciesInDb("cuantos dias de vacaciones tengo al primer ano");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].documento).toBe("reglamento-interno-operativo.md");
    expect(results[0].tituloSeccion).toContain("Vacaciones");
  });

  it("retorna vacio si no hay terminos coincidentes", async () => {
    const results = await searchPoliciesInDb("energia nuclear cuantica");
    expect(results).toEqual([]);
  });
});
