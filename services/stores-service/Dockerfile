FROM node:20-alpine AS base
RUN apk update && apk add --no-cache gcompat
WORKDIR /app
COPY --from=shared . /shared

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# ── Etapa final ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY --from=shared . /shared

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY entrypoint.sh ./

RUN npm install --include=dev && npm run build && npm install --omit=dev

RUN chown -R appuser:appgroup /app && chmod +x entrypoint.sh

USER appuser

EXPOSE 3009

ENTRYPOINT ["/app/entrypoint.sh"]
