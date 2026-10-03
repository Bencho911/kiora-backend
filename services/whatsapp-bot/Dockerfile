FROM node:20-alpine AS builder
WORKDIR /app
# git es necesario para que Baileys instale sus dependencias
RUN apk add --no-cache git
COPY --from=shared . /shared
COPY package*.json ./
RUN npm install
COPY . .
RUN ln -s /app/node_modules /node_modules && npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY --from=shared . /shared
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Crear directorio de sesión con permisos para el usuario node
RUN mkdir -p /app/session && chown -R node:node /app/session
VOLUME ["/app/session"]
USER node
CMD ["node", "dist/index.js"]
