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
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY entrypoint.sh ./

RUN npm ci --include=dev && npm run build && npm ci --omit=dev

RUN chown -R appuser:appgroup /app && chmod +x entrypoint.sh

USER appuser

EXPOSE 3009

ENTRYPOINT ["/app/entrypoint.sh"]
