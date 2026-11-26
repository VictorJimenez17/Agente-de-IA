export interface PolicySectionChunk {
  documento: string;
  tituloSeccion: string;
  contenido: string;
  palabrasClave: string[];
  orden: number;
}

const STOPWORDS = new Set([
  "para", "como", "con", "los", "las", "del", "una", "uno", "unos", "unas",
  "que", "por", "sin", "sobre", "entre", "cuando", "donde", "este", "esta",
  "cada", "todo", "toda", "todos", "todas", "tiene", "tienen", "debe", "deben",
  "bistronube", "politica", "reglamento", "interno", "operativo",
]);

export function extractKeywords(text: string, limit = 12): string[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");

  const freq = new Map<string, number>();
  for (const token of normalized.split(/\s+/)) {
    if (token.length < 4 || STOPWORDS.has(token)) continue;
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/**
 * Divide un documento Markdown de politicas por encabezados "## " para preservar
 * secciones completas y facilitar citas precisas en respuestas RAG.
 */
export function chunkMarkdownPolicy(documento: string, markdown: string): PolicySectionChunk[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const chunks: PolicySectionChunk[] = [];

  let currentTitle = "Introducción";
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (!content) return;
    chunks.push({
      documento,
      tituloSeccion: currentTitle,
      contenido: content,
      palabrasClave: extractKeywords(`${currentTitle} ${content}`),
      orden: chunks.length + 1,
    });
    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      currentTitle = line.replace(/^##\s+/, "").trim();
    } else if (!line.startsWith("# ")) {
      buffer.push(line);
    }
  }
  flush();

  return chunks;
}
