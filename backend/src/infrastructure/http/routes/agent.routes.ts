import { NextFunction, Request, Response, Router } from "express";
import { HrAgentOrchestrator } from "@agent/hrAgent";
import { prisma } from "@infrastructure/database/prismaClient";
import { NotFoundError } from "@shared/errors/AppError";

const router = Router();
const orchestrator = new HrAgentOrchestrator();

router.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, message } = req.body as { sessionId?: string; message?: string };
    const result = await orchestrator.handleMessage({
      sessionId,
      message: message ?? "",
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/chat/stream", async (req: Request, res: Response, next: NextFunction) => {
  const { sessionId, message } = req.body as { sessionId?: string; message?: string };

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendSse = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await orchestrator.handleMessage({
      sessionId,
      message: message ?? "",
      onEvent: (ev) => sendSse(ev.type, ev.data),
    });
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    sendSse("error", { error: msg });
    res.end();
    if (!res.headersSent) {
      next(err);
    }
  }
});

router.get("/sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        traces: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!session) {
      throw new NotFoundError("Sesion", req.params.id);
    }
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.get("/traces", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const traces = await prisma.agentTrace.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    res.json(traces);
  } catch (err) {
    next(err);
  }
});

export default router;
