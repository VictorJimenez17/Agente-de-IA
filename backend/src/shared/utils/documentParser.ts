import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { ValidationError } from "@shared/errors/AppError";

const SUPPORTED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx"] as const;

export function getFileExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx >= 0 ? filename.slice(dotIdx).toLowerCase() : "";
}

/**
 * Extrae texto plano de archivos TXT, MD, PDF o DOCX recibidos en memoria.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new ValidationError("El archivo recibido está vacío.");
  }

  const ext = getFileExtension(filename);

  if (ext === ".txt" || ext === ".md" || mimeType === "text/plain" || mimeType === "text/markdown") {
    return normalizeExtractedText(buffer.toString("utf-8"));
  }

  if (ext === ".pdf" || mimeType === "application/pdf") {
    const parsed = await pdfParse(buffer);
    return normalizeExtractedText(parsed.text || "");
  }

  if (
    ext === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeExtractedText(result.value || "");
  }

  throw new ValidationError(
    `Formato no soportado (${ext || mimeType || "desconocido"}). Usa: ${SUPPORTED_EXTENSIONS.join(", ")}.`
  );
}

export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\0")
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
