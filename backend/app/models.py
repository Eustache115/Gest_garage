from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


# ═══════════════════════════════════════════════════════
#  UTILISATEUR — Table de base (Joined Table Inheritance)
# ═══════════════════════════════════════════════════════
class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id_utilisateur = Column(Integer, primary_key=True, index=True)
    nom_utilisateur = Column(String(100), nullable=False)
    prenom_utilisateur = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    telephone = Column(String(20), default="")
    mot_de_passe = Column(String(255), nullable=True)   # nullable — défini par l'utilisateur via email
    role = Column(String(20), nullable=False)           # "client", "mecanicien", "receptionniste", "admin"
    actif = Column(Boolean, default=True)
    premiere_connexion = Column(Boolean, default=True)
    token_reset = Column(String(255), nullable=True)     # token pour définir/réinitialiser le mot de passe
    created_at = Column(DateTime, default=datetime.utcnow)

    # Discriminateur pour l'héritage
    __mapper_args__ = {
        "polymorphic_on": role,
        "polymorphic_identity": "utilisateur",
    }


# ─── Client hérite de Utilisateur ─────────────────────
class Client(Utilisateur):
    __tablename__ = "clients"

    id_client = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), primary_key=True)
    adresse = Column(String(255), default="")
    ville = Column(String(100), default="")

    vehicules = relationship("Vehicule", back_populates="proprietaire", cascade="all, delete-orphan")
    devis = relationship("Devis", back_populates="client", cascade="all, delete-orphan")
    factures = relationship("Facture", back_populates="client", cascade="all, delete-orphan")
    rendezvous = relationship("RendezVous", back_populates="client", cascade="all, delete-orphan")

    __mapper_args__ = {
        "polymorphic_identity": "client",
    }


# ─── Mécanicien hérite de Utilisateur ─────────────────
class Mecanicien(Utilisateur):
    __tablename__ = "mecaniciens"

    id_mecanicien = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), primary_key=True)
    specialite = Column(String(100), default="")
    disponible = Column(Boolean, default=True)

    interventions = relationship("Intervention", back_populates="mecanicien")

    __mapper_args__ = {
        "polymorphic_identity": "mecanicien",
    }


# ─── Réceptionniste hérite de Utilisateur ─────────────
class Receptionniste(Utilisateur):
    __tablename__ = "receptionnistes"

    id_receptionniste = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), primary_key=True)

    __mapper_args__ = {
        "polymorphic_identity": "receptionniste",
    }


# ─── Administrateur hérite de Utilisateur ─────────────
class Administrateur(Utilisateur):
    __tablename__ = "administrateurs"

    id_administrateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), primary_key=True)

    __mapper_args__ = {
        "polymorphic_identity": "admin",
    }


# ═══════════════════════════════════════════════════════
#  VÉHICULE
# ═══════════════════════════════════════════════════════
class Vehicule(Base):
    __tablename__ = "vehicules"

    id_vehicule = Column(Integer, primary_key=True, index=True)
    numero_chassis = Column(String(50), unique=True, index=True)
    immatriculation = Column(String(20), unique=True, index=True)
    marque = Column(String(50), nullable=False)
    modele = Column(String(50), nullable=False)
    annee = Column(String(4))
    etat = Column(String(50), default="")
    description = Column(Text, default="")
    id_client = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    proprietaire = relationship("Client", back_populates="vehicules")
    reparations = relationship("Reparation", back_populates="vehicule", cascade="all, delete-orphan", order_by="Reparation.date_debut.desc()")
    interventions = relationship("Intervention", back_populates="vehicule", cascade="all, delete-orphan", order_by="Intervention.date_creation.desc()")


# ═══════════════════════════════════════════════════════
#  RÉPARATION
# ═══════════════════════════════════════════════════════
class Reparation(Base):
    __tablename__ = "reparations"

    id_reparation = Column(Integer, primary_key=True, index=True)
    id_vehicule = Column(Integer, ForeignKey("vehicules.id_vehicule"), nullable=False)
    reference = Column(String(50), index=True)
    description = Column(Text, default="")
    date_debut = Column(DateTime, default=datetime.utcnow)
    date_fin = Column(DateTime, nullable=True)
    kilometrage = Column(Integer, nullable=True)
    montant = Column(Float, default=0.0)
    statut = Column(String(50), default="En cours")
    technicien = Column(String(100), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    vehicule = relationship("Vehicule", back_populates="reparations")


# ═══════════════════════════════════════════════════════
#  INTERVENTION
# ═══════════════════════════════════════════════════════
class Intervention(Base):
    __tablename__ = "interventions"

    id_intervention = Column(Integer, primary_key=True, index=True, autoincrement=True)
    description = Column(Text, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    statut = Column(String(50), default="En attente")
    id_vehicule = Column(Integer, ForeignKey("vehicules.id_vehicule"), nullable=False)
    id_mecanicien = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vehicule = relationship("Vehicule", back_populates="interventions")
    mecanicien = relationship("Mecanicien", back_populates="interventions")


# ═══════════════════════════════════════════════════════
#  PIÈCE (Stock)
# ═══════════════════════════════════════════════════════
class Piece(Base):
    __tablename__ = "pieces"

    id_piece = Column(Integer, primary_key=True, index=True)
    nom_piece = Column(String(100), nullable=False)
    quantite = Column(Integer, default=0)
    prix_unitaire = Column(Float, default=0.0)  # prix de vente unitaire de la pièce
    seuil_alerte = Column(Integer, default=0)
    date_enregistrement = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════
#  DEVIS
# ═══════════════════════════════════════════════════════
class Devis(Base):
    __tablename__ = "devis"

    id_devis = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, index=True)
    id_client = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    id_vehicule = Column(Integer, ForeignKey("vehicules.id_vehicule"), nullable=False)
    id_intervention = Column(Integer, ForeignKey("interventions.id_intervention"), nullable=True)
    statut = Column(String(50), default="brouillon")  # brouillon, en_attente, confirme, rejete
    facture_generee = Column(Boolean, default=False)  # True si une facture a été générée depuis ce devis
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_echeance = Column(DateTime, nullable=True)
    note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="devis")
    vehicule = relationship("Vehicule")
    intervention = relationship("Intervention")
    lignes = relationship("LigneDevis", back_populates="devis", cascade="all, delete-orphan")


class LigneDevis(Base):
    __tablename__ = "lignes_devis"

    id_ligne_devis = Column(Integer, primary_key=True, index=True)
    id_devis = Column(Integer, ForeignKey("devis.id_devis"), nullable=False)
    description = Column(Text, nullable=False)
    quantite = Column(Integer, default=1)
    prix_unitaire = Column(Float, default=0.0)
    id_piece = Column(Integer, ForeignKey("pieces.id_piece"), nullable=True)  # lien optionnel vers le stock

    devis = relationship("Devis", back_populates="lignes")
    piece = relationship("Piece")


# ═══════════════════════════════════════════════════════
#  FACTURE
# ═══════════════════════════════════════════════════════
class Facture(Base):
    __tablename__ = "factures"

    id_facture = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, index=True)
    id_client = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    id_intervention = Column(Integer, ForeignKey("interventions.id_intervention"), nullable=True)
    id_devis = Column(Integer, ForeignKey("devis.id_devis"), nullable=True)
    montant_total = Column(Float, default=0.0)
    statut = Column(String(50), default="En attente")  # En attente, Payée, Annulée
    date_emission = Column(DateTime, default=datetime.utcnow)
    date_echeance = Column(DateTime, nullable=True)
    note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="factures")
    intervention = relationship("Intervention")
    devis = relationship("Devis")


# ═══════════════════════════════════════════════════════
#  RENDEZ-VOUS
# ═══════════════════════════════════════════════════════
class RendezVous(Base):
    __tablename__ = "rendezvous"

    id_rendezvous = Column(Integer, primary_key=True, index=True)
    id_client = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    id_vehicule = Column(Integer, ForeignKey("vehicules.id_vehicule"), nullable=True)
    date_heure = Column(DateTime, nullable=False)
    motif = Column(Text, nullable=False)
    statut = Column(String(50), default="En attente")  # Confirmé, En attente, Annulé, Terminé
    notes = Column(Text, default="")
    reponse_admin = Column(Text, default="")
    date_alternative = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="rendezvous")
    vehicule = relationship("Vehicule")


# ═══════════════════════════════════════════════════════
#  AVIS
# ═══════════════════════════════════════════════════════
class Avis(Base):
    __tablename__ = "avis"

    id_avis = Column(Integer, primary_key=True, index=True)
    id_client = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    id_intervention = Column(Integer, ForeignKey("interventions.id_intervention"), nullable=False)
    note = Column(Integer, nullable=False) # 1 à 5
    commentaire = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="avis")
    intervention = relationship("Intervention")

# Mise à jour de Client pour inclure les avis
Client.avis = relationship("Avis", back_populates="client", cascade="all, delete-orphan")
