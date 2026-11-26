import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("responde estado ok y cabeceras de seguridad", async () => {
    const app = createApp();
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("retorna 404 en rutas inexistentes", async () => {
    const app = createApp();
    const res = await request(app).get("/api/no-existe");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Ruta no encontrada");
  });
});
