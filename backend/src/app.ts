import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import { AppError } from "@shared/errors/AppError";
import { securityHeadersMiddleware } from "@infrastructure/http/middlewares/SecurityMiddleware";
import agentRoutes from "@infrastructure/http/routes/agent.routes";
import vacantesRoutes from "@infrastructure/http/routes/vacantes.routes";

export function createApp(): Express {
  const app = express();

  app.use(securityHeadersMiddleware);

  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost")) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "agente-rrhh-backend",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/agent", agentRoutes);
  app.use("/api", vacantesRoutes);

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "Ruta no encontrada",
      path: req.path,
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.message,
        statusCode: err.statusCode,
      });
      return;
    }

    console.error("Error no controlado:", err);
    res.status(500).json({
      error: "Error interno del servidor",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  });

  return app;
}
