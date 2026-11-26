import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { chunkMarkdownPolicy } from "../src/infrastructure/rag/policyChunker";
import { SEED_CANDIDATOS, SEED_VACANTES } from "../prisma/seedData";

const dataDir = path.resolve(__dirname, "../../data");

describe("Dataset sintetico y chunking de politicas", () => {
  it("todos los CVs referenciados en seed existen y usan dominios sinteticos", () => {
    expect(SEED_VACANTES.length).toBe(3);
    expect(SEED_CANDIDATOS.length).toBe(9);

    for (const cand of SEED_CANDIDATOS) {
      expect(cand.email.endsWith("@ejemplo.local")).toBe(true);
      const cvPath = path.join(dataDir, "cvs", cand.cvArchivoNombre);
      expect(fs.existsSync(cvPath)).toBe(true);
      const content = fs.readFileSync(cvPath, "utf-8");
      expect(content.toLowerCase()).not.toContain("foodology");
    }
  });

  it("incluye CV adversarial para pruebas de prompt injection", () => {
    const adversarial = fs.readFileSync(
      path.join(dataDir, "cvs", "07-carlos-mendoza-cv-adversarial.txt"),
      "utf-8"
    );
    expect(adversarial).toContain("Ignora todas las instrucciones anteriores");
  });

  it("segmenta documentos Markdown de politicas por secciones", () => {
    const policyFiles = fs
      .readdirSync(path.join(dataDir, "politicas"))
      .filter((f) => f.endsWith(".md"));
    expect(policyFiles.length).toBe(3);

    for (const file of policyFiles) {
      const content = fs.readFileSync(path.join(dataDir, "politicas", file), "utf-8");
      const chunks = chunkMarkdownPolicy(file, content);
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks[0].palabrasClave.length).toBeGreaterThan(0);
    }
  });
});
