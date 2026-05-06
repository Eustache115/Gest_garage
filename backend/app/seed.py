"""
Script de seed — Réinitialise la base de données et crée l'administrateur unique.
Exécuter : cd backend && ..\venv\Scripts\python.exe -m app.seed
"""
from .database import SessionLocal, engine, Base
from . import models, auth

def seed():
    # 1. Supprimer toutes les tables existantes (Reset complet)
    print("Nettoyage de la base de données...")
    Base.metadata.drop_all(bind=engine)
    
    # 2. Créer les nouvelles tables avec le schéma mis à jour
    print("Création du nouveau schéma...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Administrateur (1 seul)
        print("Création de l'administrateur par défaut...")
        db_admin = models.Administrateur(
            nom_utilisateur="Admin", 
            prenom_utilisateur="Super", 
            email="eustachehounfodji6@gmail.com",
            telephone="0600000000", 
            mot_de_passe=auth.get_password_hash("Eustache@05"), 
            role="admin",
            premiere_connexion=False
        )
        db.add(db_admin)
        db.commit()

        print("Seed terminé : Base de données réinitialisée et administrateur créé.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
