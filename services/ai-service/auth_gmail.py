import os
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.compose"]

def authenticate():
    if not os.path.exists("credentials.json"):
        print("❌ No se encontró credentials.json")
        return
    
    print("Iniciando flujo de autenticación, se abrirá una ventana de tu navegador...")
    flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
    creds = flow.run_local_server(port=0)
    
    with open("token.json", "w") as token:
        token.write(creds.to_json())
    
    print("✅ Autenticación completada. token.json creado con éxito.")

if __name__ == '__main__':
    authenticate()
