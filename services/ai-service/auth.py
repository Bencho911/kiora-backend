import sys
import os

# Aseguramos que Python encuentre la carpeta 'app' y los archivos JSON
CURRENT_DIR = "/home/bencho/Documentos/Kiora/kiora-backend/services/ai-service"
sys.path.insert(0, CURRENT_DIR)
os.chdir(CURRENT_DIR)

from app.services.gmail_service import get_gmail_service

print("Iniciando proceso de autenticación de Google...")
get_gmail_service()
print("¡Autenticación exitosa! El archivo token.json ha sido creado.")
