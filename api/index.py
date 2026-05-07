import sys
import os

# Ajout de la racine au sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# On tente d'importer l'app réelle
try:
    from backend.app.main import app
except Exception as e:
    # On définit une app de secours immédiatement pour éviter l'erreur Vercel
    from fastapi import FastAPI
    app = FastAPI()
    @app.get("/api/health")
    def health():
        return {"error": str(e), "sys_path": sys.path}

# Vercel cherche ces variables
handler = app
application = app
