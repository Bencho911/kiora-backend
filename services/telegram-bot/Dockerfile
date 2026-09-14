FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=shared . /shared
COPY package*.json ./
RUN npm install
COPY . .
RUN ln -s /app/node_modules /node_modules && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=shared . /shared
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
