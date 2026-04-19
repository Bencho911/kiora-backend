FROM node:20-alpine

# Opcional: Instalar fuentes base en Alpine para mejor soporte de PDFKit
RUN apk add --no-cache ttf-dejavu fontconfig

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 3006
CMD ["npm", "start"]
