---
title: "Inventario de Secretos"
tags: [seguridad, secrets, devops]
---
[[Home]] > **Inventario de Secretos**

# Inventario y gobierno de secretos (Kiora)

**Este archivo no contiene secretos.** Es una guía y plantilla para que el equipo mantenga el inventario **fuera del repositorio** (1Password, Vault de cloud, Notion privado, etc.).

---

## Por qué existe (Fase 0.3)

- Cumplir el plan de auditoría: saber **qué** rotar cuando hay fuga o rotación periódica.
- Evitar depender de memoria o de `.env` en máquinas personales.

---

## Plantilla de inventario (copiar al gestor del equipo)

| Activo | Dónde se usa | Entorno (dev/staging/prod) | Última rotación | Próxima rotación | Notas |
|--------|----------------|---------------------------|-----------------|------------------|--------|
| JWT_SECRET | users-service | | | | |
| JWT_REFRESH_SECRET | users-service | | | | |
| DB (usuarios) | users-service | | | | Usuario/contraseña o connection string |
| DB (productos) | products-service | | | | |
| DB (inventario) | inventory-service | | | | |
| DB (pedidos) | orders-service | | | | |
| Redis | varios | | | | Si aplica ACL/contraseña |
| SMTP | users / notifications | | | | |
| Cloudinary u otro storage | products-service | | | | API keys |
| API keys terceros | … | | | | |

*(Añade filas según servicios desplegados.)*

---

## Reglas

1. **Valores reales** solo en variables de entorno del runtime o secret manager (GitHub Actions secrets, AWS Secrets Manager, etc.), no en Markdown del repo.
2. Tras **cualquier exposición** (commit accidental, captura, log): rotar credencial en el proveedor y actualizar despliegues.
3. **Producción:** contraseñas por defecto de `docker-compose` **no** son válidas; usar secretos inyectados en orquestador.

---

## Checklist post-incidente (fuga sospechosa)

- [ ] Identificar qué secreto quedó expuesto y durante cuánto tiempo.
- [ ] Rotar en el proveedor (emitir nuevas keys / cambiar password).
- [ ] Actualizar todos los entornos que usaban el valor antiguo.
- [ ] Revisar accesos/logs del proveedor si aplica (SMTP, DB).
- [ ] Si hubo commit público: valorar `git filter-repo` / soporte GitHub y fuerza de collaborators.

---

## Referencias internas

- `.gitignore` en la raíz incluye `.env`, `.env.local`, `.env.docker`.
- Cada servicio debe tener **`.env.example`** sin secretos, solo placeholders.
