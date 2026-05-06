import os
from sqlalchemy import create_engine, text
from passlib.context import CryptContext

# Configuration
DATABASE_URL = "postgresql://neondb_owner:npg_Eb8WAZGoUcB2@ep-falling-mode-ab1dvvfi-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
EMAIL = "eustachehounfodji6@gmail.com"
MDP = "Eustache@05"

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
hashed_mdp = pwd_context.hash(MDP)

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        # Vérifier si l'utilisateur existe
        result = conn.execute(text("SELECT id_utilisateur FROM utilisateurs WHERE email = :email"), {"email": EMAIL})
        user = result.fetchone()
        
        if user:
            conn.execute(
                text("UPDATE utilisateurs SET mot_de_passe = :mdp, actif = true, premiere_connexion = false WHERE email = :email"),
                {"mdp": hashed_mdp, "email": EMAIL}
            )
            conn.commit()
            print(f"SUCCÈS : Le mot de passe de {EMAIL} a été mis à jour avec succès.")
        else:
            print(f"ERREUR : L'utilisateur {EMAIL} n'existe pas dans la base de données.")
except Exception as e:
    print(f"ERREUR fatale : {e}")
