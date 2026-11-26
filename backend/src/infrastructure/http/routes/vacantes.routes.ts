import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { detectPromptInjection } from "@agent/guardrails";
import { prisma } from "@infrastructure/database/prismaClient";
import { NotFoundError, ValidationError } from "@shared/errors/AppError";
import { extractTextFromBuffer } from "@shared/utils/documentParser";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get("/vacantes", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const vacantes = await prisma.vacante.findMany({
      include: {
        candidatos: {
          orderBy: [{ scoreFinal: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: { codigo: "asc" },
    });
    res.json(vacantes);
  } catch (err) {
    next(err);
  }
});

router.get("/candidatos", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vacanteId = typeof req.query.vacanteId === "string" ? req.query.vacanteId : undefined;
    const candidatos = await prisma.candidato.findMany({
      where: vacanteId ? { vacanteId } : undefined,
      include: { vacante: true },
      orderBy: [{ scoreFinal: "desc" }, { createdAt: "desc" }],
    });
    res.json(candidatos);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/candidatos/upload",
  upload.single("cv"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nombre, email, ciudad, vacanteCodigo, experienciaAnios, disponibilidadRotativos, escolaridad } =
        req.body as Record<string, string>;

      if (!nombre?.trim() || !vacanteCodigo?.trim()) {
        throw new ValidationError("Los campos nombre y vacanteCodigo son obligatorios.");
      }

      const vacante = await prisma.vacante.findUnique({
        where: { codigo: vacanteCodigo.trim() },
      });
      if (!vacante) {
        throw new NotFoundError("Vacante", vacanteCodigo);
      }

      let cvTexto = (req.body.cvTexto as string | undefined)?.trim() || "";
      let cvArchivoNombre = "texto-directo.txt";

      if (req.file) {
        cvTexto = await extractTextFromBuffer(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        cvArchivoNombre = req.file.originalname;
      }

      if (!cvTexto) {
        throw new ValidationError("Debes adjuntar un archivo de CV o proporcionar cvTexto.");
      }

      const scan = detectPromptInjection(cvTexto);
      const folio = `CAN-${Date.now().toString().slice(-4)}`;

      const creado = await prisma.candidato.create({
        data: {
          folio,
          nombre: nombre.trim(),
          email: email?.trim() || `${folio.toLowerCase()}@ejemplo.local`,
          ciudad: ciudad?.trim() || vacante.ubicacion,
          vacanteId: vacante.id,
          experienciaAnios: Number(experienciaAnios || 0),
          disponibilidadRotativos: disponibilidadRotativos !== "false",
          escolaridad: escolaridad?.trim() || "Preparatoria",
          cvTexto,
          cvArchivoNombre,
          alertaSeguridad: scan.detected
            ? `Advertencia previa: posibles patrones de injection (${scan.matchedPatterns.join(", ")})`
            : null,
        },
      });

      res.status(201).json(creado);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
