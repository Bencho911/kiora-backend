#!/bin/bash
# =============================================================================
# Kiora Backend - Azure VM Deployment Script
# =============================================================================
# Copia tu código a la Máquina Virtual, instala Docker (si no lo tiene)
# y levanta toda tu arquitectura.

set -e

RG_NAME="rg-kiora-vm"
VM_NAME="vm-kiora-backend"
ADMIN_USER="kioraadmin"

echo "Buscando la IP de tu Máquina Virtual en Azure..."
PUBLIC_IP=$(az vm show -d -g "$RG_NAME" -n "$VM_NAME" --query publicIps -o tsv)

if [ -z "$PUBLIC_IP" ]; then
    echo "No se encontró la IP. Asegúrate de correr azure_vm_provision.sh primero."
    exit 1
fi

echo "IP encontrada: $PUBLIC_IP"
echo ""

# 1. Copiar los archivos a la VM
echo "[1/3] Copiando el proyecto a la Máquina Virtual..."
echo "   (Esto puede tomar unos segundos, ignorando archivos pesados como node_modules...)"

# Usamos rsync para copiar todo excepto carpetas pesadas y archivos .env
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  --exclude '.env' --exclude '.env.local' --exclude '.env.docker' \
  -e "ssh -o StrictHostKeyChecking=no" \
  ./ "$ADMIN_USER@$PUBLIC_IP:~/kiora-backend/" > /dev/null

echo "Archivos copiados."

# 2. Instalar Docker en la VM y levantar el proyecto
echo "[2/3] Configurando el servidor e instalando Docker..."
ssh -o StrictHostKeyChecking=no "$ADMIN_USER@$PUBLIC_IP" << 'EOF'
  set -e
  
  # Instalar Docker si no está instalado
  if ! command -v docker &> /dev/null; then
      echo "      Instalando Docker..."
      sudo apt-get update -y > /dev/null
      sudo apt-get install -y ca-certificates curl gnupg > /dev/null
      sudo install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      sudo chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update -y > /dev/null
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null
      sudo usermod -aG docker kioraadmin
  fi

  # Levantar el proyecto
  echo "[3/3] Levantando arquitectura con Docker Compose..."
  cd ~/kiora-backend
  sudo docker compose down
  sudo docker compose up -d --build
EOF

echo ""
echo "====================================================="
echo "¡DESPLIEGUE COMPLETADO EN LA MÁQUINA VIRTUAL!"
echo "====================================================="
echo ""
echo "Tu API pública:"
echo "   http://$PUBLIC_IP:3000/health/all"
echo ""
echo "Swagger UI (Documentación interactiva):"
echo "   http://$PUBLIC_IP:3000/api/docs"
echo ""
echo "pgAdmin (Para ver las bases de datos):"
echo "   http://$PUBLIC_IP:5050"
echo "   (El email de admin es 'admin@kiora.com' y la clave 'admin')"
echo ""
echo "====================================================="
echo "NOTA IMPORTANTE PARA LAS MIGRACIONES"
echo "Debes correr las migraciones en la VM para crear las tablas de DB."
echo "Puedes conectarte por SSH ejecutando:"
echo "ssh $ADMIN_USER@$PUBLIC_IP"
echo "Y luego adentro ejecutar:"
echo "cd kiora-backend && sudo ./scripts/migrate_all.sh"
