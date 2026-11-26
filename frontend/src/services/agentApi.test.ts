import { describe, expect, it } from "vitest";
import { parseSseBlock } from "./agentApi";

describe("parseSseBlock", () => {
  it("parsea bloques SSE con evento y JSON valido", () => {
    const parsed = parseSseBlock('event: tool_call\ndata: {"name":"listar_vacantes","args":{}}');

    expect(parsed).toEqual({
      event: "tool_call",
      data: { name: "listar_vacantes", args: {} },
    });
  });

  it("retorna null si el bloque no contiene data", () => {
    expect(parseSseBlock("event: ping")).toBeNull();
  });
});
