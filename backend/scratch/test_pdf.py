
import os
import sys

# Ajouter le chemin du projet au sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import document_utils

test_data = {
    "id": 999,
    "reference": "TEST-001",
    "client_nom": "John Doe",
    "vehicule": "Toyota Corolla (AA-123-BB)",
    "date": "22/04/2026",
    "lignes": [
        {"description": "Vidange", "quantite": 1, "prix_unitaire": 50.0},
        {"description": "Filtre à huile", "quantite": 1, "prix_unitaire": 15.0}
    ],
    "montant": 65.0,
    "description": "Test de génération PDF"
}

try:
    print("Tentative de génération PDF Devis...")
    path_devis = document_utils.generer_pdf_devis(test_data)
    print(f"Succès ! Fichier créé : {path_devis}")
    
    print("Tentative de génération PDF Facture...")
    path_facture = document_utils.generer_pdf_facture(test_data)
    print(f"Succès ! Fichier créé : {path_facture}")
    
except Exception as e:
    print(f"ERREUR : {e}")
    import traceback
    traceback.print_exc()
