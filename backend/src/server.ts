import dotenv from "dotenv";
import { createApp } from "./app";
import { prisma } from "./infrastructure/database/prismaClient";

dotenv.config();

const port = parseInt(process.env.PORT || "3000", 10);

async function connectDatabaseWithRetry(maxAttempts = 5, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      const isLast = attempt === maxAttempts;
      console.warn(
        `Intento ${attempt}/${maxAttempts} de conexion a PostgreSQL fallo: ${error instanceof Error ? error.message : String(error)}`
      );
      if (isLast) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function bootstrap(): Promise<void> {
  await connectDatabaseWithRetry();
  const app = createApp();
  const server = app.listen(port, () => {
    console.info(`API de agente RRHH escuchando en puerto ${port}`);
  });

  const shutdown = async (): Promise<void> => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

bootstrap().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exit(1);
});
