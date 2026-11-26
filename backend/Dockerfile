# ---- Etapa 1: build ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/prisma ./prisma
RUN npm run build

# ---- Etapa 2: produccion ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm install --no-save prisma@^5.22.0

# Copiar artefactos compilados, schema, prompts y dataset
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prompts ./prompts
COPY data ./data

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
