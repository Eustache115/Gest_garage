from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ═══════════════════════════════════════════════════════
#  UTILISATEURS
# ═══════════════════════════════════════════════════════

class UtilisateurBase(BaseModel):
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str = ""

class UtilisateurResponse(BaseModel):
    id_utilisateur: int
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str
    role: str
    actif: bool = True
    premiere_connexion: bool = True
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True
class ProfilUpdate(BaseModel):
    nom_utilisateur: Optional[str] = None
    prenom_utilisateur: Optional[str] = None
    telephone: Optional[str] = None


# ─── Client ───────────────────────────────────────────
class ClientCreate(BaseModel):
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str = ""
    adresse: str = ""
    ville: str = ""
    mot_de_passe: Optional[str] = None  # optionnel — sera défini via email

class ClientInscription(BaseModel):
    """Activation du compte client (le client existe déjà, il ajoute un mot de passe)"""
    email: str
    mot_de_passe: str

class ClientUpdate(BaseModel):
    nom_utilisateur: Optional[str] = None
    prenom_utilisateur: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    ville: Optional[str] = None
    mot_de_passe: Optional[str] = None

class ClientResponse(BaseModel):
    id_client: int
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str
    role: str = "client"
    actif: bool = True
    adresse: str = ""
    ville: str = ""
    vehicules_count: int = 0
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Mécanicien ──────────────────────────────────────
class MecanicienCreate(BaseModel):
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str = ""
    specialite: str = ""
    disponible: bool = True
    mot_de_passe: Optional[str] = None

class MecanicienUpdate(BaseModel):
    nom_utilisateur: Optional[str] = None
    prenom_utilisateur: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    specialite: Optional[str] = None
    disponible: Optional[bool] = None
    mot_de_passe: Optional[str] = None

class MecanicienResponse(BaseModel):
    id_mecanicien: int
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str
    role: str = "mecanicien"
    actif: bool = True
    specialite: str = ""
    disponible: bool = True
    interventions_en_cours: int = 0
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Réceptionniste ──────────────────────────────────
class ReceptionnisteCreate(BaseModel):
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str = ""
    mot_de_passe: Optional[str] = None

class ReceptionnisteUpdate(BaseModel):
    nom_utilisateur: Optional[str] = None
    prenom_utilisateur: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    mot_de_passe: Optional[str] = None

class ReceptionnisteResponse(BaseModel):
    id_receptionniste: int
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str
    role: str = "receptionniste"
    actif: bool = True
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Administrateur ──────────────────────────────────
class AdminCreate(BaseModel):
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str = ""
    mot_de_passe: str

class AdminResponse(BaseModel):
    id_administrateur: int
    nom_utilisateur: str
    prenom_utilisateur: str
    email: str
    telephone: str
    role: str = "admin"
    actif: bool = True
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Auth / Mot de passe ─────────────────────────────
class DefinirMotDePasse(BaseModel):
    token: str
    mot_de_passe: str

class LoginRequest(BaseModel):
    email: str
    mot_de_passe: str

class ChangerMotDePasseRequest(BaseModel):
    nouveau_mot_de_passe: str

class ForgotPasswordRequest(BaseModel):
    email: str


# ═══════════════════════════════════════════════════════
#  VÉHICULES
# ═══════════════════════════════════════════════════════
class VehiculeCreate(BaseModel):
    numero_chassis: str
    immatriculation: str
    marque: str
    modele: str
    annee: str = ""
    etat: str = ""
    description: str = ""
    id_client: Optional[int] = None

class VehiculeUpdate(BaseModel):
    numero_chassis: Optional[str] = None
    immatriculation: Optional[str] = None
    marque: Optional[str] = None
    modele: Optional[str] = None
    annee: Optional[str] = None
    etat: Optional[str] = None
    description: Optional[str] = None
    id_client: Optional[int] = None

class VehiculeResponse(BaseModel):
    id_vehicule: int
    numero_chassis: str
    immatriculation: str
    marque: str
    modele: str
    annee: str
    etat: str
    description: str
    id_client: Optional[int] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════
#  RÉPARATIONS
# ═══════════════════════════════════════════════════════
class ReparationCreate(BaseModel):
    id_vehicule: int
    reference: str = ""
    description: str = ""
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    kilometrage: Optional[int] = None
    montant: float = 0.0
    statut: str = "En cours"
    technicien: str = ""
    notes: str = ""

class ReparationUpdate(BaseModel):
    reference: Optional[str] = None
    description: Optional[str] = None
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    kilometrage: Optional[int] = None
    montant: Optional[float] = None
    statut: Optional[str] = None
    technicien: Optional[str] = None
    notes: Optional[str] = None

class ReparationResponse(BaseModel):
    id_reparation: int
    id_vehicule: int
    reference: str
    description: str
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    kilometrage: Optional[int] = None
    montant: float
    statut: str
    technicien: str
    notes: str
    created_at: Optional[datetime] = None
    # Champs enrichis
    vehicule_immatriculation: str = ""
    client_nom_utilisateur: str = ""
    client_prenom_utilisateur: str = ""
    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════
#  PIÈCES (Stock)
# ═══════════════════════════════════════════════════════
class PieceCreate(BaseModel):
    nom_piece: str
    quantite: int = 0
    prix_unitaire: float = 0.0
    seuil_alerte: int = 0
    date_enregistrement: Optional[str] = None

class PieceUpdate(BaseModel):
    nom_piece: Optional[str] = None
    quantite: Optional[int] = None
    prix_unitaire: Optional[float] = None
    seuil_alerte: Optional[int] = None
    date_enregistrement: Optional[str] = None

class PiecePrise(BaseModel):
    quantite: int  # quantité à retirer

class PieceResponse(BaseModel):
    id_piece: int
    nom_piece: str
    quantite: int
    prix_unitaire: float = 0.0
    seuil_alerte: int
    date_enregistrement: Optional[datetime] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════
#  DEVIS
# ═══════════════════════════════════════════════════════
class LigneDevisCreate(BaseModel):
    description: str
    quantite: int = 1
    prix_unitaire: float = 0.0
    id_piece: Optional[int] = None  # lien vers une pièce du stock

class LigneDevisResponse(BaseModel):
    id_ligne_devis: int
    description: str
    quantite: int
    prix_unitaire: float
    id_piece: Optional[int] = None
    class Config:
        from_attributes = True

class DevisCreate(BaseModel):
    id_client: int
    id_vehicule: int
    statut: str = "brouillon"
    date_creation: Optional[str] = None
    date_echeance: Optional[str] = None
    note: str = ""
    id_intervention: Optional[int] = None
    lignes: list[LigneDevisCreate] = []

class DevisUpdate(BaseModel):
    id_client: Optional[int] = None
    id_vehicule: Optional[int] = None
    statut: Optional[str] = None
    date_echeance: Optional[str] = None
    note: Optional[str] = None
    id_intervention: Optional[int] = None
    lignes: Optional[list[LigneDevisCreate]] = None

class DevisResponse(BaseModel):
    id_devis: int
    reference: str
    id_client: int
    id_vehicule: int
    statut: str
    facture_generee: bool = False
    date_creation: Optional[datetime] = None
    date_echeance: Optional[datetime] = None
    note: str = ""
    lignes: list[LigneDevisResponse] = []
    total: float = 0.0
    client_nom_utilisateur: str = ""
    client_prenom_utilisateur: str = ""
    vehicule_immatriculation: str = ""
    vehicule_marque: str = ""
    vehicule_modele: str = ""
    id_intervention: Optional[int] = None
    intervention_desc: str = ""
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class GenerateFactureRequest(BaseModel):
    note: str = ""


# ═══════════════════════════════════════════════════════
#  FACTURE
# ═══════════════════════════════════════════════════════
class FactureCreate(BaseModel):
    id_client: int
    id_intervention: Optional[int] = None
    id_devis: Optional[int] = None
    montant_total: float
    statut: str = "En attente"
    date_emission: Optional[str] = None
    date_echeance: Optional[str] = None
    note: str = ""

class FactureUpdate(BaseModel):
    statut: Optional[str] = None
    montant_total: Optional[float] = None
    date_echeance: Optional[str] = None
    note: Optional[str] = None

class FactureResponse(BaseModel):
    id_facture: int
    reference: str
    id_client: int
    id_intervention: Optional[int] = None
    id_devis: Optional[int] = None
    montant_total: float
    statut: str
    date_emission: Optional[datetime] = None
    date_echeance: Optional[datetime] = None
    note: str = ""
    client_nom_utilisateur: str = ""
    client_prenom_utilisateur: str = ""
    intervention_desc: str = ""
    devis_ref: str = ""
    vehicule_immatriculation: str = ""
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════
#  RENDEZ-VOUS
# ═══════════════════════════════════════════════════════
class RendezVousCreate(BaseModel):
    id_client: int
    id_vehicule: Optional[int] = None
    date_heure: str
    motif: str
    statut: str = "En attente"
    notes: str = ""

class RendezVousUpdate(BaseModel):
    date_heure: Optional[str] = None
    motif: Optional[str] = None
    statut: Optional[str] = None
    notes: Optional[str] = None

class RendezVousResponse(BaseModel):
    id_rendezvous: int
    id_client: int
    id_vehicule: Optional[int] = None
    date_heure: datetime
    motif: str
    statut: str
    notes: str = ""
    reponse_admin: str = ""
    client_nom_utilisateur: str = ""
    client_prenom_utilisateur: str = ""
    vehicule_immatriculation: str = ""
    vehicule_marque: str = ""
    date_alternative: Optional[datetime] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class RendezVousStatusUpdate(BaseModel):
    statut: str
    message: Optional[str] = ""
    date_alternative: Optional[str] = None

# ═══════════════════════════════════════════════════════
#  AUTHENTIFICATION JWT
# ═══════════════════════════════════════════════════════
class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TokenData(BaseModel):
    email: Optional[str] = None

class AvisCreate(BaseModel):
    id_intervention: int
    note: int
    commentaire: str = ''
    id_client: Optional[int] = None

class AvisResponse(BaseModel):
    id_avis: int
    id_client: int
    id_intervention: int
    note: int
    commentaire: str
    created_at: Optional[datetime] = None
    client_nom_utilisateur: str = ""
    client_prenom_utilisateur: str = ""
    intervention_desc: str = ""
    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════
#  INTERVENTIONS
# ═══════════════════════════════════════════════════════
class InterventionCreate(BaseModel):
    description: str
    id_vehicule: int
    id_mecanicien: Optional[int] = None

class InterventionUpdate(BaseModel):
    description: Optional[str] = None
    statut: Optional[str] = None
    id_mecanicien: Optional[int] = None

class InterventionResponse(BaseModel):
    id_intervention: int
    description: str
    date_creation: Optional[datetime] = None
    statut: str
    id_vehicule: int
    id_mecanicien: Optional[int] = None
    vehicule_immatriculation: str = ""
    vehicule_marque: str = ""
    vehicule_modele: str = ""
    client_nom_utilisateur: str = ""
    client_prenom_utilisateur: str = ""
    client_telephone: str = ""
    mecanicien_nom_utilisateur: str = ""
    mecanicien_prenom_utilisateur: str = ""
    devis: List[DevisResponse] = []
    factures: List[FactureResponse] = []
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True
