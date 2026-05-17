#!/bin/bash
# =============================================================================
# Kiora Backend - Azure VM Provisioning Script
# =============================================================================
# NOTA: Debes haber iniciado sesión con `az login` antes de ejecutar esto.
#
# Este script crea una Máquina Virtual Ubuntu en Azure (8GB RAM) y abre
# los puertos necesarios para que el API Gateway funcione.

set -e

# --- CONFIGURACIÓN ---
PREFIX="kiora"
ENV="prod"
LOCATION="eastus2" # Usamos eastus2 porque suele tener buena disponibilidad de VMs

RG_NAME="rg-${PREFIX}-vm"
VM_NAME="vm-${PREFIX}-backend"
VM_SIZE="Standard_D2s_v3" # 2 vCPUs, 8GB RAM (Sin restricciones de capacidad como la serie B)
ADMIN_USER="kioraadmin"

echo "🚀 Iniciando provisión de la Máquina Virtual en Azure ($LOCATION)..."
echo ""

# 1. Crear el Resource Group
echo "📦 [1/3] Creando Resource Group: $RG_NAME..."
az group create --name "$RG_NAME" --location "$LOCATION" -o none
echo "   ✅ Listo."

# 2. Crear la Máquina Virtual
echo "🖥️  [2/3] Creando Máquina Virtual: $VM_NAME ($VM_SIZE)..."
echo "   ⏳ Esto tomará un par de minutos. Se generarán llaves SSH automáticamente en ~/.ssh si no existen."

az vm create \
  --resource-group "$RG_NAME" \
  --name "$VM_NAME" \
  --image "Ubuntu2204" \
  --admin-username "$ADMIN_USER" \
  --size "$VM_SIZE" \
  --generate-ssh-keys \
  --public-ip-sku Standard \
  -o none

echo "   ✅ VM Creada con éxito."

# 3. Abrir Puertos en el Firewall (Network Security Group)
echo "🛡️  [3/3] Configurando Firewall (Puertos 22, 80, 443, 3000, 5050)..."
az vm open-port --resource-group "$RG_NAME" --name "$VM_NAME" --port 80 --priority 1010 -o none
az vm open-port --resource-group "$RG_NAME" --name "$VM_NAME" --port 443 --priority 1020 -o none
az vm open-port --resource-group "$RG_NAME" --name "$VM_NAME" --port 3000 --priority 1030 -o none
az vm open-port --resource-group "$RG_NAME" --name "$VM_NAME" --port 5050 --priority 1040 -o none # Para pgAdmin si quieres verlo
echo "   ✅ Puertos abiertos."

# Resumen
PUBLIC_IP=$(az vm show -d -g "$RG_NAME" -n "$VM_NAME" --query publicIps -o tsv)

echo ""
echo "====================================================="
echo "🎉 ¡MÁQUINA VIRTUAL LISTA!"
echo "====================================================="
echo ""
echo "🌐 IP Pública de tu servidor: $PUBLIC_IP"
echo ""
echo "🔑 Puedes conectarte por SSH con este comando si lo deseas:"
echo "   ssh $ADMIN_USER@$PUBLIC_IP"
echo ""
echo "👉 Siguiente paso: Corre ./scripts/azure_vm_deploy.sh para subir tu código"
