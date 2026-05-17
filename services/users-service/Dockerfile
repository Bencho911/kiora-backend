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

# Pre-crear carpeta si necesita y dar permisos
RUN chown -R appuser:appgroup /app && \
    chmod +x entrypoint.sh

# No correr como root
USER appuser

EXPOSE 3001

ENTRYPOINT ["/app/entrypoint.sh"]
