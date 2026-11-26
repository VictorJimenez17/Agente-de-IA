import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { prisma } from "../src/infrastructure/database/prismaClient";
import { chunkMarkdownPolicy } from "../src/infrastructure/rag/policyChunker";
import { SEED_CANDIDATOS, SEED_VACANTES } from "./seedData";

dotenv.config();

function resolveDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../data"),
    path.resolve(process.cwd(), "data"),
    path.resolve(__dirname, "../../data"),
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) {
    throw new Error(`No se encontro la carpeta data/. Rutas probadas: ${candidates.join(", ")}`);
  }
  return found;
}

async function main(): Promise<void> {
  const dataDir = resolveDataDir();
  const cvsDir = path.join(dataDir, "cvs");
  const politicasDir = path.join(dataDir, "politicas");

  console.info("Sembrando vacantes...");
  const vacanteIdByCodigo = new Map<string, string>();
  for (const vac of SEED_VACANTES) {
    const saved = await prisma.vacante.upsert({
      where: { codigo: vac.codigo },
      update: { ...vac },
      create: { ...vac },
    });
    vacanteIdByCodigo.set(vac.codigo, saved.id);
  }

  console.info("Sembrando candidatos y CVs sinteticos...");
  for (const cand of SEED_CANDIDATOS) {
    const vacanteId = vacanteIdByCodigo.get(cand.vacanteCodigo);
    if (!vacanteId) {
      throw new Error(`Vacante no encontrada para codigo ${cand.vacanteCodigo}`);
    }

    const cvPath = path.join(cvsDir, cand.cvArchivoNombre);
    const cvTexto = fs.readFileSync(cvPath, "utf-8");

    await prisma.candidato.upsert({
      where: { folio: cand.folio },
      update: {
        nombre: cand.nombre,
        email: cand.email,
        ciudad: cand.ciudad,
        vacanteId,
        experienciaAnios: cand.experienciaAnios,
        disponibilidadRotativos: cand.disponibilidadRotativos,
        escolaridad: cand.escolaridad,
        cvTexto,
        cvArchivoNombre: cand.cvArchivoNombre,
      },
      create: {
        folio: cand.folio,
        nombre: cand.nombre,
        email: cand.email,
        ciudad: cand.ciudad,
        vacanteId,
        experienciaAnios: cand.experienciaAnios,
        disponibilidadRotativos: cand.disponibilidadRotativos,
        escolaridad: cand.escolaridad,
        cvTexto,
        cvArchivoNombre: cand.cvArchivoNombre,
      },
    });
  }

  console.info("Indexando chunks de politicas para RAG...");
  const policyFiles = fs.readdirSync(politicasDir).filter((f) => f.endsWith(".md"));
  for (const file of policyFiles) {
    const raw = fs.readFileSync(path.join(politicasDir, file), "utf-8");
    const chunks = chunkMarkdownPolicy(file, raw);
    for (const chunk of chunks) {
      await prisma.politicaChunk.upsert({
        where: {
          documento_orden: {
            documento: chunk.documento,
            orden: chunk.orden,
          },
        },
        update: {
          tituloSeccion: chunk.tituloSeccion,
          contenido: chunk.contenido,
          palabrasClave: chunk.palabrasClave,
        },
        create: chunk,
      });
    }
  }

  console.info("Seed completado correctamente.");
}

main()
  .catch((err) => {
    console.error("Error ejecutando seed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
