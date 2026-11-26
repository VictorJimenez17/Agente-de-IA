export interface InjectionScanResult {
  detected: boolean;
  matchedPatterns: string[];
}

export interface SanitizedDocumentResult {
  sanitizedText: string;
  detected: boolean;
  matchedPatterns: string[];
}

interface InjectionRule {
  label: string;
  regex: RegExp;
}

const INJECTION_RULES: InjectionRule[] = [
  {
    label: "override_instrucciones",
    regex: /ignora(?:r)?\s+(?:todas?\s+)?(?:las\s+)?instrucciones\s+(?:anteriores|previas)/i,
  },
  {
    label: "override_instrucciones_en",
    regex: /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  },
  {
    label: "system_override",
    regex: /(?:\[?\s*system\s+override\s*\]?|instruccion\s+prioritaria\s+de\s+auditoria|override\s+administrativo)/i,
  },
  {
    label: "exfiltracion_prompt",
    regex: /(?:imprime|revela|muestra|dime|expon)\s+(?:el|tu)?\s*(?:system\s*prompt|prompt\s+del\s+sistema|instrucciones\s+internas)/i,
  },
  {
    label: "manipulacion_score",
    regex: /(?:asigna|pon|fuerza|establece)\s+score(?:final)?\s*[:=]?\s*100/i,
  },
  {
    label: "bypass_knockout",
    regex: /(?:marcar|poner|dejar)\s+esknockout\s*[:=]?\s*false/i,
  },
  {
    label: "cambio_rol",
    regex: /(?:olvida\s+tu\s+rol|ahora\s+eres\s+un|actua\s+como\s+dan|jailbreak)/i,
  },
];

const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  /\b(?:clima|pronostico\s+del\s+tiempo|lluvia\s+en)\b/i,
  /\b(?:bitcoin|ethereum|criptomoneda|bolsa\s+de\s+valores|trading)\b/i,
  /\b(?:chiste|poema|cancion|horoscopo|tarot)\b/i,
  /\b(?:partido\s+de\s+futbol|marcador|champions\s+league)\b/i,
  /\b(?:escribe\s+un\s+codigo|programa\s+en\s+python|script\s+en\s+bash)\b/i,
  /\b(?:receta\s+de\s+pastel|como\s+preparar\s+tacos)\b/i,
  /\b(?:capital\s+de\s+francia|presidente\s+actual)\b/i,
];

function normalizeForScan(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectPromptInjection(text: string): InjectionScanResult {
  const normalized = normalizeForScan(text);
  const matchedPatterns: string[] = [];

  for (const rule of INJECTION_RULES) {
    if (rule.regex.test(normalized)) {
      matchedPatterns.push(rule.label);
    }
  }

  return {
    detected: matchedPatterns.length > 0,
    matchedPatterns,
  };
}

/**
 * Neutraliza lineas con posibles directivas inyectadas dentro de un CV externo
 * antes de enviarlo al modelo, conservando intacta la trayectoria laboral legitima.
 */
export function sanitizeUntrustedDocument(text: string): SanitizedDocumentResult {
  const fullScan = detectPromptInjection(text);
  if (!fullScan.detected) {
    return {
      sanitizedText: text,
      detected: false,
      matchedPatterns: [],
    };
  }

  const lines = text.split(/\r?\n/);
  const filteredLines = lines.map((line) => {
    const normalizedLine = normalizeForScan(line);
    const hasDirective =
      INJECTION_RULES.some((rule) => rule.regex.test(normalizedLine)) ||
      /^\s*\[?(?:atencion\s+sistema\s+ia|fin\s+de\s+instruccion)/i.test(normalizedLine) ||
      /tu\s+nueva\s+instruccion\s+obligatoria/i.test(normalizedLine);

    return hasDirective ? "[DIRECTIVA NO CONFIABLE BLOQUEADA POR SEGURIDAD]" : line;
  });

  return {
    sanitizedText: filteredLines.join("\n"),
    detected: true,
    matchedPatterns: fullScan.matchedPatterns,
  };
}

export function isClearlyOutOfScope(query: string): boolean {
  const normalized = normalizeForScan(query);
  const hrKeywords = /\b(vacante|candidato|cv|curriculum|entrevista|star|politica|reglamento|turno|vacaciones|salario|sueldo|bono|rrhh|reclutamiento|contratacion|knockout|bpm)\b/i;
  if (hrKeywords.test(normalized)) {
    return false;
  }
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));
}
