FROM node:20-alpine AS base
WORKDIR /app
COPY --from=shared . /shared
COPY package*.json ./
RUN npm install --omit=dev

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
EXPOSE 3007
CMD ["npm", "run", "start"]
