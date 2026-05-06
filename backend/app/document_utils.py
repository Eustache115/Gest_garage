
from fpdf import FPDF
import os
import unicodedata

# ── Chemins ──────────────────────────────────────────────
STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "storage", "documents"))
LOGO_PATH   = os.path.join(os.path.dirname(__file__), "logonouveau.png")

if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR, exist_ok=True)


def safe(text: str, maxlen: int = 0) -> str:
    """
    Convertit une chaîne en Latin-1 pur (supporté par fpdf/Arial).
    - Remplace les caractères hors Latin-1 par leur équivalent ASCII via unicodedata
    - Remplace les caractères restants par '?'
    - Tronque si maxlen > 0
    """
    if not isinstance(text, str):
        text = str(text) if text is not None else ''
    # Normalise NFD pour décomposer les accents, puis encode en ASCII pour les caractères non couverts
    normalized = unicodedata.normalize('NFKC', text)
    # Remplace les tirets spéciaux et apostrophes typographiques par des équivalents ASCII
    replacements = {
        '\u2014': '-',   # em dash —
        '\u2013': '-',   # en dash –
        '\u2019': "'",   # apostrophe courbe '
        '\u2018': "'",   # apostrophe courbe '
        '\u201c': '"',   # guillemet "
        '\u201d': '"',   # guillemet "
        '\u2026': '...',  # ellipse …
        '\u00e0': 'a',   # à  (déjà en Latin-1 mais au cas où)
    }
    for orig, repl in replacements.items():
        normalized = normalized.replace(orig, repl)
    # Encodage Latin-1 avec remplacement des caractères non supportés
    try:
        encoded = normalized.encode('latin-1', errors='replace').decode('latin-1')
    except Exception:
        encoded = normalized.encode('ascii', errors='replace').decode('ascii')
    return encoded[:maxlen] if maxlen else encoded


# ── Classe PDF ────────────────────────────────────────────
class GaragePDF(FPDF):
    def header(self):
        # Logo (si disponible)
        x_offset = 10
        if os.path.exists(LOGO_PATH):
            self.image(LOGO_PATH, x=10, y=8, h=16)
            x_offset = 35
            
        # Nom garage
        self.set_xy(x_offset, 10)
        self.set_font('Arial', 'B', 16)
        self.set_text_color(30, 58, 95)
        self.cell(100, 6, 'E-GARAGE', 0, 1, 'L')
        
        # Infos garage
        self.set_x(x_offset)
        self.set_font('Arial', '', 9)
        self.set_text_color(100, 100, 100)
        self.cell(100, 5, safe('Quartier Haie Vive, Cotonou - Bénin'), 0, 1, 'L')
        self.set_x(x_offset)
        self.cell(100, 5, 'contact@gestiongarage.bj | +229 00 00 00 00', 0, 1, 'L')
        
        self.ln(4)
        # Séparateur bleu marine
        self.set_draw_color(30, 58, 95)
        self.set_line_width(0.4)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'E-GARAGE - Page {self.page_no()}', 0, 0, 'C')
        self.set_text_color(0, 0, 0)


# ── PDF Devis ─────────────────────────────────────────────
def generer_pdf_devis(devis_data):
    pdf = GaragePDF()
    pdf.add_page()

    # Titre
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, safe(f"DEVIS : {devis_data['reference']}"), 0, 1, 'L')
    pdf.ln(3)

    # Infos générales
    pdf.set_font('Arial', '', 11)
    pdf.cell(0, 8, safe(f"Client  : {devis_data['client_nom']}"), 0, 1)
    pdf.cell(0, 8, safe(f"Vehicule: {devis_data.get('vehicule', '')}"), 0, 1)
    pdf.cell(0, 8, safe(f"Date    : {devis_data['date']}"), 0, 1)
    pdf.ln(8)

    # En-tête du tableau
    pdf.set_font('Arial', 'B', 11)
    pdf.set_fill_color(30, 58, 95)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(100, 10, 'Description',    1, 0, 'L', True)
    pdf.cell(25,  10, 'Qte',            1, 0, 'C', True)
    pdf.cell(32,  10, 'P.U. (FCFA)',    1, 0, 'R', True)
    pdf.cell(33,  10, 'Total (FCFA)',   1, 1, 'R', True)
    pdf.set_text_color(0, 0, 0)

    # Lignes
    pdf.set_font('Arial', '', 11)
    total_general = 0
    for i, ligne in enumerate(devis_data.get('lignes', [])):
        qte       = ligne.get('quantite', 1)
        pu        = float(ligne.get('prix_unitaire', 0))
        total_l   = qte * pu
        total_general += total_l
        fill = i % 2 == 0
        pdf.set_fill_color(245, 247, 250)
        pdf.cell(100, 9, safe(str(ligne.get('description', '')), 55), 1, 0, 'L', fill)
        pdf.cell(25,  9, str(qte),                 1, 0, 'C', fill)
        pdf.cell(32,  9, f"{pu:,.0f}",             1, 0, 'R', fill)
        pdf.cell(33,  9, f"{total_l:,.0f}",        1, 1, 'R', fill)

    pdf.ln(4)

    # Total
    pdf.set_font('Arial', 'B', 12)
    pdf.set_fill_color(30, 58, 95)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(157, 11, 'TOTAL A PAYER',              1, 0, 'R', True)
    pdf.cell(33,  11, f"{total_general:,.0f} FCFA", 1, 1, 'R', True)
    pdf.set_text_color(0, 0, 0)

    filename = f"devis_{devis_data['id']}.pdf"
    filepath = os.path.join(STORAGE_DIR, filename)
    pdf.output(filepath)
    return filepath


# ── PDF Facture ───────────────────────────────────────────
def generer_pdf_facture(facture_data):
    """
    Génère le PDF d'une facture avec le détail des pièces/prestations.
    facture_data : id, reference, client_nom, vehicule, date,
                   lignes (description, quantite, prix_unitaire),
                   montant (float), statut
    """
    pdf = GaragePDF()
    pdf.add_page()

    # Titre
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, safe(f"FACTURE : {facture_data['reference']}"), 0, 1, 'L')
    pdf.ln(3)

    # Infos client
    pdf.set_font('Arial', '', 11)
    pdf.cell(0, 8, safe(f"Client  : {facture_data['client_nom']}"), 0, 1)
    if facture_data.get('vehicule'):
        pdf.cell(0, 8, safe(f"Vehicule: {facture_data['vehicule']}"), 0, 1)
    pdf.cell(0, 8, safe(f"Date    : {facture_data['date']}"), 0, 1)
    statut_val = facture_data.get('statut')
    if statut_val:
        pdf.cell(0, 8, safe(f"Statut  : {statut_val}"), 0, 1)
    pdf.ln(8)

    lignes = facture_data.get('lignes', [])

    if lignes:
        # En-tête tableau
        pdf.set_font('Arial', 'B', 11)
        pdf.set_fill_color(30, 58, 95)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(100, 10, 'Designation',   1, 0, 'L', True)
        pdf.cell(25,  10, 'Qte',           1, 0, 'C', True)
        pdf.cell(32,  10, 'P.U. (FCFA)',   1, 0, 'R', True)
        pdf.cell(33,  10, 'Total (FCFA)',  1, 1, 'R', True)
        pdf.set_text_color(0, 0, 0)

        pdf.set_font('Arial', '', 11)
        total_general = 0
        for i, ligne in enumerate(lignes):
            qte   = ligne.get('quantite', 1)
            pu    = float(ligne.get('prix_unitaire', 0))
            total_l = qte * pu
            total_general += total_l
            fill = i % 2 == 0
            pdf.set_fill_color(245, 247, 250)
            pdf.cell(100, 9, safe(str(ligne.get('description', '')), 55), 1, 0, 'L', fill)
            pdf.cell(25,  9, str(qte),              1, 0, 'C', fill)
            pdf.cell(32,  9, f"{pu:,.0f}",          1, 0, 'R', fill)
            pdf.cell(33,  9, f"{total_l:,.0f}",     1, 1, 'R', fill)

        pdf.ln(4)

        # Total
        pdf.set_font('Arial', 'B', 12)
        pdf.set_fill_color(30, 58, 95)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(157, 11, 'TOTAL A PAYER',              1, 0, 'R', True)
        pdf.cell(33,  11, f"{total_general:,.0f} FCFA", 1, 1, 'R', True)
        pdf.set_text_color(0, 0, 0)

    else:
        # Aucune ligne — affichage simple (rétrocompatibilité)
        pdf.set_font('Arial', 'B', 11)
        pdf.set_fill_color(30, 58, 95)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(160, 10, 'DESCRIPTION',  1, 0, 'L', True)
        pdf.cell(30,  10, 'MONTANT',      1, 1, 'R', True)
        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Arial', '', 11)
        desc = safe(facture_data.get('description') or facture_data.get('note') or 'Prestation de service', 70)
        pdf.cell(160, 10, desc, 1)
        pdf.cell(30,  10, f"{facture_data.get('montant', 0):,.0f}", 1)
        pdf.ln()
        pdf.ln(5)
        pdf.set_font('Arial', 'B', 12)
        pdf.set_fill_color(30, 58, 95)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(160, 11, 'TOTAL A PAYER',                            1, 0, 'R', True)
        pdf.cell(30,  11, f"{facture_data.get('montant', 0):,.0f} FCFA", 1, 1, 'R', True)
        pdf.set_text_color(0, 0, 0)

    filename = f"facture_{facture_data['id']}.pdf"
    filepath = os.path.join(STORAGE_DIR, filename)
    pdf.output(filepath)
    return filepath
