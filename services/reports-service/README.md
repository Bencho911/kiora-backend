# Kiora — Reports Service

Microservicio encargado de renderizar y exponer los reportes generados por la plataforma. Construido con **Node.js**, **Express** y **PDFKit**.

---

## Requisitos previos

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (recomendado)

---

## Levantar con Docker (recomendado)

```bash
docker compose up -d
```

Este comando levanta el contenedor `reports-service` en el puerto local `3006`.

---

## Levantar manualmente

```bash
cd kiora-backend/services/reports-service
npm install
npm run dev
```

El microservicio utiliza variables de entorno compartidas para saber bajo qué ecosistema se ejecuta (`ORDERS_SERVICE_URL`) y así resolver las ventas desde `/receipt/:orderId`.

## Arquitectura (PDFKit)

El `reports-service` genera documentos PDF al vuelo sin almacenar archivos locales ni consumir RAM excesiva enviándolos directamente mediante el protocolo nativo HTTP `Stream.pipe()`.
Para obtener la información, se orquestra mediante HTTP de forma aislada a la base de datos contra el `orders-service`.
