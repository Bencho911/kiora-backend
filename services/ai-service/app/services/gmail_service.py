import os
import base64
from email.message import EmailMessage
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import logging

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.compose"]

def get_gmail_service():
    """Autentica y retorna el servicio de Gmail."""
    creds = None
    # El archivo token.json almacena los tokens de acceso y actualización del usuario.
    # Se crea automáticamente cuando el flujo de autorización se completa por primera vez.
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    
    # Si no hay credenciales válidas, permite al usuario iniciar sesión.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists("credentials.json"):
                raise FileNotFoundError("El archivo credentials.json no se encuentra en el directorio actual. Por favor, descárgalo de Google Cloud Console.")
            
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Guardar las credenciales para la próxima ejecución
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)

def create_draft_email(to_email: str, subject: str, body: str) -> dict:
    """Crea un borrador en Gmail."""
    try:
        service = get_gmail_service()

        message = EmailMessage()
        message.set_content(body)
        message["To"] = to_email
        message["From"] = "me" # "me" es el usuario autenticado
        message["Subject"] = subject

        # Codificar en base64 de manera segura para la URL
        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

        create_message = {"message": {"raw": encoded_message}}
        
        draft = service.users().drafts().create(userId="me", body=create_message).execute()
        
        logger.info(f"Borrador creado exitosamente con ID: {draft['id']}")
        return {"success": True, "draft_id": draft["id"], "message": f"Borrador creado exitosamente para {to_email}."}
        
    except Exception as e:
        logger.error(f"Error creando borrador de Gmail: {e}")
        return {"error": str(e)}
