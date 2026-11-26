import fs from "fs";
import path from "path";

const promptCache = new Map<string, string>();

function resolvePromptsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../prompts"),
    path.resolve(process.cwd(), "prompts"),
    path.resolve(__dirname, "../../../prompts"),
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) {
    throw new Error(`No se encontro la carpeta prompts/. Rutas: ${candidates.join(", ")}`);
  }
  return found;
}

export function loadPrompt(filename: string): string {
  const cached = promptCache.get(filename);
  if (cached) {
    return cached;
  }

  const fullPath = path.join(resolvePromptsDir(), filename);
  const content = fs.readFileSync(fullPath, "utf-8").trim();
  promptCache.set(filename, content);
  return content;
}
