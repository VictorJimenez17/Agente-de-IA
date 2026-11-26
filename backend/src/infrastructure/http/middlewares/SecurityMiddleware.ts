import { Request, Response, NextFunction } from "express";

// Cabeceras basicas de proteccion HTTP para respuestas API y contenido estatico
export const securityHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader("X-Frame-Options", "DENY");
  if (req.path.startsWith("/api")) {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
};
