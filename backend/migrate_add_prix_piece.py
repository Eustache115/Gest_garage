"""
Migration : Ajout de la colonne prix_unitaire sur la table pieces
Permet d'associer un prix de vente à chaque pièce, auto-rempli dans le formulaire devis.
"""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
url = DATABASE_URL.replace("postgresql://", "")
user_pass, rest = url.split("@", 1)
user, password = user_pass.split(":", 1)
host_port_db = rest
host_port, dbname = host_port_db.rsplit("/", 1) if "/" in host_port_db else (host_port_db, "garage_db")
host, port = host_port.split(":", 1) if ":" in host_port else (host_port, "5432")

print(f"Connexion à PostgreSQL — hôte: {host}, DB: {dbname}")
conn = psycopg2.connect(host=host, port=int(port), dbname=dbname, user=user, password=password)
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'pieces' AND column_name = 'prix_unitaire'
""")
if cur.fetchone():
    print("✅ La colonne 'prix_unitaire' existe déjà dans 'pieces'. Rien à faire.")
else:
    cur.execute("ALTER TABLE pieces ADD COLUMN prix_unitaire FLOAT DEFAULT 0.0 NOT NULL")
    print("✅ Colonne 'prix_unitaire' ajoutée à 'pieces' avec succès.")

cur.close()
conn.close()
print("Migration terminée.")
