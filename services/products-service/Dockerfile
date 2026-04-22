FROM node:20-alpine AS base
RUN apk update && apk add --no-cache gcompat
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Etapa final ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=base /app/node_modules ./node_modules
COPY . .

# Pre-crear carpeta de subidas y dar permisos al usuario de la app
RUN mkdir -p /app/src/public/uploads && \
    chown -R appuser:appgroup /app && \
    chmod +x entrypoint.sh

USER appuser

EXPOSE 3002

ENTRYPOINT ["/app/entrypoint.sh"]
