import { describe, expect, it } from "vitest";
import { extractTextFromBuffer, normalizeExtractedText } from "../src/shared/utils/documentParser";
import { ValidationError } from "../src/shared/errors/AppError";

describe("documentParser", () => {
  it("extrae y normaliza texto de archivos TXT y MD", async () => {
    const raw = Buffer.from("Linea 1  \r\n\r\n\r\nLinea 2\0", "utf-8");
    const text = await extractTextFromBuffer(raw, "cv.txt", "text/plain");

    expect(text).toBe("Linea 1\n\nLinea 2");
  });

  it("rechaza archivos vacios o formatos no soportados", async () => {
    await expect(extractTextFromBuffer(Buffer.alloc(0), "cv.txt")).rejects.toThrow(ValidationError);
    await expect(extractTextFromBuffer(Buffer.from("abc"), "foto.png", "image/png")).rejects.toThrow(
      ValidationError
    );
  });

  it("limpia saltos excesivos en texto plano", () => {
    expect(normalizeExtractedText("A\r\n\r\n\r\n\r\nB")).toBe("A\n\nB");
  });
});
