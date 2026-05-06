import os
from sqlalchemy import create_engine, text
from passlib.context import CryptContext

# Configuration
DATABASE_URL = "postgresql://neondb_owner:npg_Eb8WAZGoUcB2@ep-falling-mode-ab1dvvfi-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
EMAIL_TEST = "test@admin.com"
MDP_TEST = "admin123"

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
hashed_mdp = pwd_context.hash(MDP_TEST)

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        # Supprimer si existe déjà pour repartir à neuf
        conn.execute(text("DELETE FROM utilisateurs WHERE email = :email"), {"email": EMAIL_TEST})
        
        # Insérer le compte test
        conn.execute(
            text("""
                INSERT INTO utilisateurs (nom_utilisateur, prenom_utilisateur, email, mot_de_passe, role, actif, premiere_connexion)
                VALUES ('TEST', 'Admin', :email, :mdp, 'admin', true, false)
            """),
            {"email": EMAIL_TEST, "mdp": hashed_mdp}
        )
        conn.commit()
        print(f"SUCCÈS : Compte de test créé -> {EMAIL_TEST} / {MDP_TEST}")
except Exception as e:
    print(f"ERREUR : {e}")
