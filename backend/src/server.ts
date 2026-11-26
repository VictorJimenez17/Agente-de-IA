import dotenv from "dotenv";
import { createApp } from "./app";

dotenv.config();

const port = parseInt(process.env.PORT || "3000", 10);
const app = createApp();

app.listen(port, () => {
  console.info(`API de agente RRHH escuchando en puerto ${port}`);
});
