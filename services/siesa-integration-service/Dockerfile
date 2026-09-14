FROM node:20-alpine AS base
WORKDIR /app
COPY --from=shared . /shared

COPY package*.json ./
# Ignoraremos fallos si no encuentra paquetes en la primera pasada,
# porque necesitamos copiar "shared" luego. O en su lugar
# usamos npm install --omit=dev que a veces es más permisivo, o
# simplemente combinamos los pasos si npm install falla por @kiora/shared.
# Sin embargo, siguiendo el patrón de api-gateway:
RUN npm install --omit=dev --ignore-scripts || true

FROM node:20-alpine
WORKDIR /app
COPY --from=shared . /shared

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN ln -s /app/node_modules /node_modules && npm install --include=dev && npm run build && npm install --omit=dev

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3010

CMD ["node", "dist/index.js"]
