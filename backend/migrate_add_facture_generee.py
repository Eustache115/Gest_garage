"""
Migration : Ajout de la colonne facture_generee sur la table devis
Exécuter une seule fois : python migrate_add_facture_generee.py
"""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
# postgresql://postgres:root@localhost:5432/garage_db
# On parse manuellement pour psycopg2
url = DATABASE_URL.replace("postgresql://", "")
user_pass, rest = url.split("@", 1)
user, password = user_pass.split(":", 1)
host_port_db = rest
if "/" in host_port_db:
    host_port, dbname = host_port_db.rsplit("/", 1)
else:
    host_port, dbname = host_port_db, "garage_db"
if ":" in host_port:
    host, port = host_port.split(":", 1)
else:
    host, port = host_port, "5432"

print(f"Connexion à PostgreSQL — hôte: {host}, DB: {dbname}")

conn = psycopg2.connect(
    host=host, port=int(port), dbname=dbname,
    user=user, password=password
)
conn.autocommit = True
cur = conn.cursor()

# Vérifier si la colonne existe déjà
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'devis' AND column_name = 'facture_generee'
""")
exists = cur.fetchone()

if exists:
    print("✅ La colonne 'facture_generee' existe déjà. Aucune migration nécessaire.")
else:
    cur.execute("""
        ALTER TABLE devis
        ADD COLUMN facture_generee BOOLEAN DEFAULT FALSE NOT NULL
    """)
    print("✅ Colonne 'facture_generee' ajoutée avec succès à la table 'devis'.")

cur.close()
conn.close()
print("Migration terminée.")
