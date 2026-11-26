import { prisma } from "@infrastructure/database/prismaClient";

export interface PolicySearchMatch {
  documento: string;
  tituloSeccion: string;
  contenido: string;
  relevancia: number;
}

const QUERY_STOPWORDS = new Set([
  "cual", "cuales", "como", "cuando", "donde", "para", "sobre", "tiene",
  "tienen", "dice", "segun", "politica", "reglamento", "sobre", "cuanto",
  "cuantos", "puede", "pueden", "debo", "bistronube", "hola", "quiero",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !QUERY_STOPWORDS.has(token));
}

export function scorePolicyChunk(
  queryTokens: string[],
  chunk: {
    documento: string;
    tituloSeccion: string;
    contenido: string;
    palabrasClave: string[];
  }
): number {
  if (queryTokens.length === 0) return 0;

  const titleTokens = new Set(tokenize(chunk.tituloSeccion));
  const bodyTokens = tokenize(chunk.contenido);
  const bodySet = new Set(bodyTokens);
  const keywordSet = new Set(chunk.palabrasClave.map((k) => k.toLowerCase()));

  let score = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 4;
    if (keywordSet.has(token)) score += 2.5;
    if (bodySet.has(token)) {
      const tf = bodyTokens.filter((t) => t === token).length;
      score += 1 + Math.min(tf, 3) * 0.5;
    }
  }

  return Number(score.toFixed(2));
}

export async function searchPoliciesInDb(
  query: string,
  topK = 3
): Promise<PolicySearchMatch[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return [];
  }

  const chunks = await prisma.politicaChunk.findMany({
    orderBy: [{ documento: "asc" }, { orden: "asc" }],
  });

  return chunks
    .map((chunk) => ({
      documento: chunk.documento,
      tituloSeccion: chunk.tituloSeccion,
      contenido: chunk.contenido,
      relevancia: scorePolicyChunk(queryTokens, chunk),
    }))
    .filter((item) => item.relevancia > 0)
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, topK);
}
