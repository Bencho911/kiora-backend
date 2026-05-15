---
title: "Despliegue en Azure VM"
tags: [azure, vm, despliegue, infraestructura, caddy, https]
---
[[Home]] > **Azure VM Deployment**

# Guía de Despliegue en Máquina Virtual (Azure)

Esta guía documenta la infraestructura en la nube actual del proyecto Kiora. En lugar de utilizar servicios PaaS restrictivos (como Container Apps o bases de datos manejadas), Kiora se despliega en una **Máquina Virtual (IaaS)** usando Docker Compose. Este enfoque garantiza control absoluto, menores costos y evita problemas de "Capacity Restrictions" en suscripciones gratuitas.

## 1. Arquitectura de Despliegue

- **Provisión:** Azure CLI.
- **Instancia:** Ubuntu 22.04 LTS (`Standard_D2s_v3` - 2 vCPUs, 8GB RAM).
- **Orquestador:** Docker Compose.
- **Sincronización:** `rsync` vía SSH.
- **Red:** Todo se expone a través del puerto `3000` (API Gateway) directamente a la IP Pública.

## 2. Instrucciones de Operación

### Prerrequisitos
Asegúrate de estar logueado en la línea de comandos de Azure en tu computadora local:
```bash
az login
```

### Paso 1: Levantar la Infraestructura
Si la máquina virtual no existe, aprovisiónala corriendo:
```bash
./scripts/azure_vm_provision.sh
```
*Este script crea el Resource Group, la VM, configura las llaves SSH y abre los puertos de seguridad (22, 80, 443, 3000, 5050).*

### Paso 2: Desplegar el Código
Para enviar los últimos cambios de código y levantar los servicios en la nube:
```bash
./scripts/azure_vm_deploy.sh
```
*Este script detecta la IP pública, sincroniza los archivos excluyendo pesados (como `node_modules`), entra por SSH, instala Docker si no está presente y ejecuta `docker compose up -d --build`.*

Las migraciones de bases de datos (`node-pg-migrate`) se ejecutan **de forma automática** dentro de los contenedores gracias al `entrypoint.sh` de cada microservicio, utilizando las variables de entorno inyectadas centralmente desde el `docker-compose.yml`.

## 3. Acceso de Administración

Si necesitas entrar a la consola de la máquina virtual para debuggear contenedores, ver logs de Docker o interactuar con el sistema operativo:

```bash
# Cambia <IP_PUBLICA> por la IP que te arrojó el script de provisión
ssh kioraadmin@<IP_PUBLICA>

# Una vez adentro, puedes ver logs de contenedores
sudo docker ps
sudo docker logs kiora_api_gateway --tail 50 -f
```

---

## 4. 🔮 Siguiente Paso (Futuro): Habilitar HTTPS Automático con Caddy

Actualmente el sistema es accesible vía HTTP usando directamente la dirección IP. Para subir esto a nivel **Enterprise**, recomendamos utilizar [Caddy](https://caddyserver.com/).

Caddy es un proxy inverso moderno que gestiona certificados SSL (HTTPS) de forma automática con *Let's Encrypt*.

**Requisito previo:** Debes haber comprado un nombre de dominio (ej. `kiora.com`) y en tu proveedor de dominio (GoDaddy, Namecheap, Cloudflare) debes apuntar un Registro "A" hacia la IP Pública de tu máquina en Azure.

### ¿Cómo configurarlo en la VM?

1. Conéctate a tu servidor: `ssh kioraadmin@<IP_PUBLICA>`
2. Instala Caddy:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update
   sudo apt install caddy
   ```
3. Edita el archivo de configuración global de Caddy:
   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```
4. Borra lo que tenga y coloca estas simples 3 líneas (reemplazando `api.kiora.com` por tu dominio real):
   ```caddy
   api.kiora.com {
       reverse_proxy localhost:3000
   }
   ```
5. Reinicia Caddy:
   ```bash
   sudo systemctl restart caddy
   ```

**¡Eso es todo!** Tu API ahora será accesible globalmente mediante `https://api.kiora.com` con el candado verde de seguridad activado. 

*(Nota de Seguridad: Una vez implementado Caddy con HTTPS, recuerda ir al archivo `api-gateway/src/app.js` y quitar la propiedad `contentSecurityPolicy: false` del middleware `helmet` para restablecer las políticas estrictas de seguridad web).*
