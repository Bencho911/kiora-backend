# ── Etapa base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# Copiar solo los archivos de dependencias primero (mejor cache de Docker)
COPY package*.json ./
RUN npm ci --only=production

# ── Etapa final ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Crear usuario sin privilegios (seguridad)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=base /app/node_modules ./node_modules
COPY . .

# No correr como root
USER appuser

EXPOSE 3001

CMD ["node", "src/index.js"]
