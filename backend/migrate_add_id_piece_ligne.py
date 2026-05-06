"""
Migration : Ajout de la colonne id_piece sur la table lignes_devis
Permet le lien direct entre une ligne de devis et une pièce du stock
pour une déduction automatique et fiable lors de la génération de facture.
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

# Vérifier si la colonne existe déjà
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'lignes_devis' AND column_name = 'id_piece'
""")
if cur.fetchone():
    print("✅ La colonne 'id_piece' existe déjà dans 'lignes_devis'. Rien à faire.")
else:
    cur.execute("""
        ALTER TABLE lignes_devis
        ADD COLUMN id_piece INTEGER REFERENCES pieces(id_piece) ON DELETE SET NULL
    """)
    print("✅ Colonne 'id_piece' ajoutée à 'lignes_devis' avec succès.")

cur.close()
conn.close()
print("Migration terminée.")
