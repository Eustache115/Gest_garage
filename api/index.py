import sys
import os

# Configuration des chemins
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '..'))
backend_dir = os.path.join(root_dir, 'backend')

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    # Tentative d'importation de l'application réelle
    from backend.app.main import app
except Exception as e:
    # En cas d'erreur, on crée une application FastAPI minimale
    # Cela évite que Vercel ne dise "Could not find app"
    from fastapi import FastAPI
    app = FastAPI()
    
    @app.get("/api/health")
    def health():
        return {
            "status": "error",
            "message": "Erreur lors de l'importation du backend",
            "error": str(e)
        }
    
    @app.get("/api/{path:path}")
    def catch_all(path: str):
        return {
            "error": "Backend import failed",
            "details": str(e),
            "path": path
        }

# Exports requis par Vercel
app = app
handler = app
application = app
