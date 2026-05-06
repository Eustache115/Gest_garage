import sys
import os

# Trouver le chemin racine du projet
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
backend_path = os.path.join(root_path, 'backend')

if backend_path not in sys.path:
    sys.path.append(backend_path)

try:
    from app.main import app
except ImportError as e:
    from fastapi import FastAPI
    app = FastAPI()
    @app.get("/api/health")
    def health():
        return {
            "status": "error", 
            "error": str(e),
            "root": root_path,
            "backend": backend_path,
            "contents": os.listdir(backend_path) if os.path.exists(backend_path) else "not found"
        }
