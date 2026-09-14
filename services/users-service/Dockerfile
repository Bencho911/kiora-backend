# ── Etapa base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY --from=shared . /shared

# Copiar solo los archivos de dependencias primero (mejor cache de Docker)
COPY package*.json ./
RUN npm install --omit=dev

# ── Etapa final ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY --from=shared . /shared

# Crear usuario sin privilegios (seguridad)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY entrypoint.sh ./

RUN ln -s /app/node_modules /node_modules && npm install --include=dev && npm run build && npm install --omit=dev

# Pre-crear carpeta si necesita y dar permisos
RUN chown -R appuser:appgroup /app && \
    chmod +x entrypoint.sh

# No correr como root
USER appuser

EXPOSE 3001

ENTRYPOINT ["/app/entrypoint.sh"]
