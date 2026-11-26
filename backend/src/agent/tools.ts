import { prisma } from "@infrastructure/database/prismaClient";
import { searchPoliciesInDb } from "@infrastructure/rag/policyRetriever";
import { GeminiClient } from "./geminiClient";
import { sanitizeUntrustedDocument } from "./guardrails";
import { loadPrompt } from "./promptLoader";
import { ToolDeclaration, TraceSource } from "./types";

export interface ToolCallOutput {
  result: Record<string, unknown>;
  sources: TraceSource[];
  securityFlags: string[];
  extraTokens?: number;
}

export const AGENT_TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    name: "listar_vacantes",
    description:
      "Lista las vacantes abiertas en la base de datos junto con sus requisitos minimos, salario y total de candidatos registrados.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "rankear_candidatos_vacante",
    description:
      "Evalua y ordena de mayor a menor todos los candidatos postulados a una vacante (por codigo como VAC-JC-01 o titulo), aplicando reglas knock-out, sanitizacion anti prompt-injection, justificacion y preguntas STAR sugeridas.",
    parameters: {
      type: "object",
      properties: {
        vacanteReferencia: {
          type: "string",
          description: "Codigo (ej. VAC-JC-01) o titulo de la vacante a evaluar.",
        },
      },
      required: ["vacanteReferencia"],
    },
  },
  {
    name: "generar_preguntas_entrevista",
    description:
      "Genera preguntas estructuradas con metodologia STAR personalizadas para un candidato especifico segun su folio o nombre y los requisitos de su vacante.",
    parameters: {
      type: "object",
      properties: {
        candidatoReferencia: {
          type: "string",
          description: "Folio (ej. CAN-001) o nombre parcial del candidato.",
        },
      },
      required: ["candidatoReferencia"],
    },
  },
  {
    name: "consultar_politica_rrhh",
    description:
      "Busca fragmentos exactos en el reglamento interno y politicas de RRHH (horarios, turnos, vacaciones, BPM, tabulador salarial, bonos, reglas knock-out, escalamientos).",
    parameters: {
      type: "object",
      properties: {
        consulta: {
          type: "string",
          description: "Pregunta o palabras clave sobre la politica o reglamento a consultar.",
        },
      },
      required: ["consulta"],
    },
  },
  {
    name: "escalar_a_rrhh",
    description:
      "Registra y prepara un escalamiento formal al equipo de RRHH cuando el caso excede el alcance automatizado (reingresos, ajuste salarial >10%, permisos migratorios o aclaraciones de nomina).",
    parameters: {
      type: "object",
      properties: {
        categoria: {
          type: "string",
          description: "Tipo de caso: REINGRESO, SALARIO_FUERA_TABULADOR, NOMINA, MIGRATORIO u OTRO.",
        },
        motivo: {
          type: "string",
          description: "Resumen breve del caso a escalar.",
        },
        candidatoFolio: {
          type: "string",
          description: "Folio del candidato involucrado si aplica.",
        },
      },
      required: ["categoria", "motivo"],
    },
  },
];

interface ParsedAiEvaluation {
  scoreFinal: number;
  clasificacion: string;
  justificacion: string;
  preguntasSugeridas: string[];
  alertaSeguridad: string | null;
}

export function checkDeterministicKnockOut(
  candidato: {
    experienciaAnios: number;
    disponibilidadRotativos: boolean;
  },
  vacante: {
    experienciaMinAnios: number;
    requiereRotativos: boolean;
  }
): { esKnockOut: boolean; motivoKnockOut: string | null } {
  if (vacante.requiereRotativos && !candidato.disponibilidadRotativos) {
    return {
      esKnockOut: true,
      motivoKnockOut: "No cuenta con disponibilidad para turnos rotativos exigidos por la vacante.",
    };
  }

  // Politica BistroNube seccion 2: menos del 50% de experiencia minima en puestos de 2+ anos
  if (vacante.experienciaMinAnios >= 2 && candidato.experienciaAnios < vacante.experienciaMinAnios * 0.5) {
    return {
      esKnockOut: true,
      motivoKnockOut: `Experiencia (${candidato.experienciaAnios} anos) menor al 50% del minimo requerido (${vacante.experienciaMinAnios} anos).`,
    };
  }

  return { esKnockOut: false, motivoKnockOut: null };
}

function buildFallbackEvaluation(
  candidato: {
    nombre: string;
    experienciaAnios: number;
    disponibilidadRotativos: boolean;
    escolaridad: string;
    cvTexto: string;
  },
  vacante: {
    titulo: string;
    experienciaMinAnios: number;
    habilidadesClave: string[];
  },
  knockOut: { esKnockOut: boolean; motivoKnockOut: string | null },
  injectionDetected: boolean
): ParsedAiEvaluation {
  const cvLower = candidato.cvTexto.toLowerCase();
  const matchedSkills = vacante.habilidadesClave.filter((skill) =>
    cvLower.includes(skill.toLowerCase())
  );

  const expRatio = Math.min(candidato.experienciaAnios / Math.max(vacante.experienciaMinAnios, 1), 1.5);
  const expScore = Math.round(Math.min(expRatio / 1.5, 1) * 45);
  const skillScore = Math.round(
    (matchedSkills.length / Math.max(vacante.habilidadesClave.length, 1)) * 30
  );
  const fitScore = candidato.disponibilidadRotativos ? 22 : 8;

  let scoreFinal = Math.min(100, expScore + skillScore + fitScore);
  if (knockOut.esKnockOut) {
    scoreFinal = Math.min(scoreFinal, 40);
  }

  const clasificacion =
    knockOut.esKnockOut || scoreFinal < 60
      ? "NO_APTO"
      : scoreFinal >= 90
        ? "FAST_TRACK"
        : scoreFinal >= 75
          ? "APTO"
          : "RESERVA";

  return {
    scoreFinal,
    clasificacion,
    justificacion: knockOut.esKnockOut
      ? `Descartado por regla knock-out: ${knockOut.motivoKnockOut}`
      : `Cuenta con ${candidato.experienciaAnios} anos de experiencia y coincidencia en ${matchedSkills.length}/${vacante.habilidadesClave.length} habilidades clave (${matchedSkills.join(", ") || "ninguna directa"}).`,
    preguntasSugeridas: [
      `Cuentame una situacion concreta como ${vacante.titulo} donde manejaste un pico de demanda y cual fue el resultado.`,
      "Describe un error operativo que cometiste en turno, como lo comunicaste y que cambio aplicaste despues.",
      "Relata una ocasion en la que debiste garantizar normas de higiene o control PEPS bajo presion de tiempo.",
    ],
    alertaSeguridad: injectionDetected
      ? "Se detecto y neutralizo un intento de prompt injection dentro del CV."
      : null,
  };
}

export class HrAgentTools {
  constructor(private readonly gemini: GeminiClient = new GeminiClient()) {}

  async execute(name: string, args: Record<string, unknown>): Promise<ToolCallOutput> {
    switch (name) {
      case "listar_vacantes":
        return this.listarVacantes();
      case "rankear_candidatos_vacante":
        return this.rankearCandidatosVacante(String(args.vacanteReferencia ?? ""));
      case "generar_preguntas_entrevista":
        return this.generarPreguntasEntrevista(String(args.candidatoReferencia ?? ""));
      case "consultar_politica_rrhh":
        return this.consultarPolitica(String(args.consulta ?? ""));
      case "escalar_a_rrhh":
        return this.escalarARrhh({
          categoria: String(args.categoria ?? "OTRO"),
          motivo: String(args.motivo ?? ""),
          candidatoFolio: args.candidatoFolio ? String(args.candidatoFolio) : undefined,
        });
      default:
        return {
          result: { error: `Herramienta desconocida: ${name}` },
          sources: [],
          securityFlags: [],
        };
    }
  }

  private async listarVacantes(): Promise<ToolCallOutput> {
    const vacantes = await prisma.vacante.findMany({
      where: { abierta: true },
      include: { _count: { select: { candidatos: true } } },
      orderBy: { codigo: "asc" },
    });

    return {
      result: {
        total: vacantes.length,
        vacantes: vacantes.map((v) => ({
          codigo: v.codigo,
          titulo: v.titulo,
          departamento: v.departamento,
          ubicacion: v.ubicacion,
          experienciaMinAnios: v.experienciaMinAnios,
          requiereRotativos: v.requiereRotativos,
          salarioMensual: v.salarioMensual,
          cupo: v.cupo,
          candidatosRegistrados: v._count.candidatos,
        })),
      },
      sources: [{ type: "db", label: "PostgreSQL: Vacante", detail: `${vacantes.length} vacantes abiertas` }],
      securityFlags: [],
    };
  }

  private async rankearCandidatosVacante(vacanteReferencia: string): Promise<ToolCallOutput> {
    const ref = vacanteReferencia.trim();
    const vacante = await prisma.vacante.findFirst({
      where: {
        OR: [
          { codigo: { equals: ref, mode: "insensitive" } },
          { titulo: { contains: ref, mode: "insensitive" } },
        ],
      },
      include: { candidatos: true },
    });

    if (!vacante) {
      return {
        result: { encontrada: false, mensaje: `No existe una vacante que coincida con "${ref}".` },
        sources: [{ type: "db", label: "PostgreSQL: Vacante", detail: "Sin coincidencias" }],
        securityFlags: [],
      };
    }

    const evaluatorPrompt = loadPrompt("cv-evaluator.v1.md");
    const securityFlags: string[] = [];
    const sources: TraceSource[] = [
      { type: "db", label: `Vacante ${vacante.codigo}`, detail: vacante.titulo },
      {
        type: "policy_rag",
        label: "politica-reclutamiento-y-entrevistas.md",
        detail: "Reglas knock-out y escala 45/25/30",
      },
    ];

    let totalExtraTokens = 0;
    const ranked = [];

    for (const candidato of vacante.candidatos) {
      const knockOut = checkDeterministicKnockOut(candidato, vacante);
      const sanitized = sanitizeUntrustedDocument(candidato.cvTexto);
      if (sanitized.detected) {
        securityFlags.push(
          `CV_INJECTION_DETECTED:${candidato.folio}:${sanitized.matchedPatterns.join(",")}`
        );
      }

      sources.push({
        type: "cv_document",
        label: `${candidato.folio} (${candidato.nombre})`,
        detail: candidato.cvArchivoNombre || "CV cargado",
      });

      let evaluation: ParsedAiEvaluation;
      try {
        const userPayload = JSON.stringify({
          vacante: {
            codigo: vacante.codigo,
            titulo: vacante.titulo,
            requisitos: vacante.requisitos,
            experienciaMinAnios: vacante.experienciaMinAnios,
            requiereRotativos: vacante.requiereRotativos,
            habilidadesClave: vacante.habilidadesClave,
          },
          candidato: {
            folio: candidato.folio,
            nombre: candidato.nombre,
            experienciaAnios: candidato.experienciaAnios,
            disponibilidadRotativos: candidato.disponibilidadRotativos,
            escolaridad: candidato.escolaridad,
            esKnockOutPrecalculado: knockOut.esKnockOut,
            motivoKnockOutPrecalculado: knockOut.motivoKnockOut,
          },
          cv_no_confiable: `<cv_no_confiable>\n${sanitized.sanitizedText}\n</cv_no_confiable>`,
        });

        const aiRes = await this.gemini.generateStructuredJson({
          systemInstruction: evaluatorPrompt,
          userContent: userPayload,
          temperature: 0.1,
        });
        totalExtraTokens += aiRes.totalTokens;

        const parsed = JSON.parse(aiRes.text) as Partial<ParsedAiEvaluation>;
        const rawScore = typeof parsed.scoreFinal === "number" ? Math.round(parsed.scoreFinal) : 50;
        const clampedScore = knockOut.esKnockOut
          ? Math.min(45, Math.max(0, rawScore))
          : Math.min(100, Math.max(0, rawScore));

        evaluation = {
          scoreFinal: clampedScore,
          clasificacion: knockOut.esKnockOut ? "NO_APTO" : parsed.clasificacion || "RESERVA",
          justificacion: parsed.justificacion || "Evaluado frente a requisitos de la vacante.",
          preguntasSugeridas: Array.isArray(parsed.preguntasSugeridas)
            ? parsed.preguntasSugeridas.slice(0, 3)
            : [],
          alertaSeguridad: sanitized.detected
            ? `Prompt injection neutralizado (${sanitized.matchedPatterns.join(", ")})`
            : parsed.alertaSeguridad || null,
        };
      } catch {
        evaluation = buildFallbackEvaluation(candidato, vacante, knockOut, sanitized.detected);
      }

      await prisma.candidato.update({
        where: { id: candidato.id },
        data: {
          scoreFinal: evaluation.scoreFinal,
          clasificacion: evaluation.clasificacion,
          esKnockOut: knockOut.esKnockOut,
          motivoKnockOut: knockOut.motivoKnockOut,
          justificacion: evaluation.justificacion,
          preguntasSugeridas: evaluation.preguntasSugeridas,
          alertaSeguridad: evaluation.alertaSeguridad,
          evaluadoAt: new Date(),
        },
      });

      ranked.push({
        folio: candidato.folio,
        nombre: candidato.nombre,
        experienciaAnios: candidato.experienciaAnios,
        disponibilidadRotativos: candidato.disponibilidadRotativos,
        scoreFinal: evaluation.scoreFinal,
        clasificacion: evaluation.clasificacion,
        esKnockOut: knockOut.esKnockOut,
        motivoKnockOut: knockOut.motivoKnockOut,
        justificacion: evaluation.justificacion,
        preguntasSugeridas: evaluation.preguntasSugeridas,
        alertaSeguridad: evaluation.alertaSeguridad,
      });
    }

    ranked.sort((a, b) => b.scoreFinal - a.scoreFinal);

    return {
      result: {
        vacante: {
          codigo: vacante.codigo,
          titulo: vacante.titulo,
          ubicacion: vacante.ubicacion,
          cupo: vacante.cupo,
        },
        totalEvaluados: ranked.length,
        ranking: ranked,
      },
      sources,
      securityFlags,
      extraTokens: totalExtraTokens,
    };
  }

  private async generarPreguntasEntrevista(candidatoReferencia: string): Promise<ToolCallOutput> {
    const ref = candidatoReferencia.trim();
    const candidato = await prisma.candidato.findFirst({
      where: {
        OR: [
          { folio: { equals: ref, mode: "insensitive" } },
          { nombre: { contains: ref, mode: "insensitive" } },
        ],
      },
      include: { vacante: true },
    });

    if (!candidato) {
      return {
        result: { encontrado: false, mensaje: `No se encontro el candidato "${ref}".` },
        sources: [{ type: "db", label: "PostgreSQL: Candidato", detail: "Sin coincidencias" }],
        securityFlags: [],
      };
    }

    const sanitized = sanitizeUntrustedDocument(candidato.cvTexto);
    const baseQuestions = Array.isArray(candidato.preguntasSugeridas)
      ? (candidato.preguntasSugeridas as string[])
      : [];

    const preguntas =
      baseQuestions.length >= 3
        ? baseQuestions
        : [
            `Situacion de presion: describe tu turno mas exigente relacionado con ${candidato.vacante.titulo}, que acciones tomaste y que resultado obtuviste.`,
            "Manejo de errores: cuentame de un error operativo o de inventario que hayas cometido, como lo reportaste y como evitaste que se repitiera.",
            `Apego a requisitos (${candidato.vacante.habilidadesClave.slice(0, 2).join(", ")}): da un ejemplo concreto aplicando estas practicas en tu empleo previo.`,
          ];

    return {
      result: {
        folio: candidato.folio,
        nombre: candidato.nombre,
        vacante: `${candidato.vacante.codigo} - ${candidato.vacante.titulo}`,
        preguntasStar: preguntas,
        criteriosEvaluacion: [
          "Claridad en Situacion, Tarea, Accion y Resultado (STAR).",
          "Responsabilidad personal frente a fallas o mermas.",
          "Consistencia con la trayectoria declarada en CV.",
        ],
      },
      sources: [
        { type: "cv_document", label: `${candidato.folio} (${candidato.nombre})` },
        {
          type: "policy_rag",
          label: "politica-reclutamiento-y-entrevistas.md",
          detail: "Seccion 5. Metodologia de entrevista STAR",
        },
      ],
      securityFlags: sanitized.detected
        ? [`CV_INJECTION_DETECTED:${candidato.folio}:${sanitized.matchedPatterns.join(",")}`]
        : [],
    };
  }

  private async consultarPolitica(consulta: string): Promise<ToolCallOutput> {
    const matches = await searchPoliciesInDb(consulta, 3);
    if (matches.length === 0) {
      return {
        result: {
          encontrado: false,
          mensaje:
            "No se encontraron secciones relevantes en las politicas internas vigentes para esa consulta.",
        },
        sources: [{ type: "policy_rag", label: "Politicas RRHH", detail: "0 coincidencias" }],
        securityFlags: [],
      };
    }

    return {
      result: {
        encontrado: true,
        fragmentos: matches,
      },
      sources: matches.map((m) => ({
        type: "policy_rag" as const,
        label: m.documento,
        detail: m.tituloSeccion,
      })),
      securityFlags: [],
    };
  }

  private async escalarARrhh(input: {
    categoria: string;
    motivo: string;
    candidatoFolio?: string;
  }): Promise<ToolCallOutput> {
    const ticketId = `ESC-${Date.now().toString().slice(-6)}`;
    const canal =
      input.categoria.toUpperCase() === "NOMINA"
        ? "nomina@bistronube.local"
        : "talento@bistronube.local";

    return {
      result: {
        ticketId,
        estado: "ESCALADO_A_RRHH",
        categoria: input.categoria,
        candidatoFolio: input.candidatoFolio || null,
        motivo: input.motivo,
        canalContacto: canal,
        tiempoRespuestaEstimado: "1 dia habil",
      },
      sources: [
        {
          type: "policy_rag",
          label: "politica-reclutamiento-y-entrevistas.md",
          detail: "Seccion 6. Escalamiento a Recursos Humanos",
        },
      ],
      securityFlags: [],
    };
  }
}
