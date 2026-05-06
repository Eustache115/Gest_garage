from sqlalchemy.orm import Session
from . import models, schemas, auth
from .email_utils import envoyer_email_creation_compte
import uuid
import secrets
import string

def generer_mot_de_passe(longueur: int = 10) -> str:
    """Génère un mot de passe unique, fort et aléatoire."""
    # On évite les caractères trop compliqués ou ambigus pour faciliter le copier-coller
    alphabet = string.ascii_letters + string.digits + "!@%"
    while True:
        mdp = ''.join(secrets.choice(alphabet) for _ in range(longueur))
        # Vérifier qu'il contient au moins 1 majuscule, 1 minuscule, 1 chiffre
        if (any(c.isupper() for c in mdp)
                and any(c.islower() for c in mdp)
                and any(c.isdigit() for c in mdp)):
            return mdp


# ═══════════════════════════════════════════════════════
#  UTILISATEURS (tous types)
# ═══════════════════════════════════════════════════════
def get_utilisateurs(db: Session):
    return db.query(models.Utilisateur).filter(models.Utilisateur.actif == True).all()

def get_utilisateur(db: Session, user_id: int):
    return db.query(models.Utilisateur).filter(models.Utilisateur.id_utilisateur == user_id).first()

def get_utilisateur_by_email(db: Session, email: str):
    if not email: return None
    # On ne cherche QUE parmi les utilisateurs actifs
    return db.query(models.Utilisateur).filter(
        models.Utilisateur.email == email.strip().lower(),
        models.Utilisateur.actif == True
    ).first()

def delete_utilisateur(db: Session, user_id: int):
    db_user = db.query(models.Utilisateur).filter(models.Utilisateur.id_utilisateur == user_id).first()
    if not db_user:
        return False
    db_user.actif = False
    db_user.email = f"{db_user.email}.del.{uuid.uuid4().hex[:6]}"
    db.commit()
    return True

def renvoyer_activation_utilisateur(db: Session, user_id: int):
    """Génère un nouveau MDP et renvoie l'email d'activation.
    Le hash n'est mis à jour en base QUE si l'email est bien envoyé."""
    user = get_utilisateur(db, user_id)
    if not user:
        return False, "Utilisateur non trouvé"
    
    mdp = generer_mot_de_passe()
    print(f"\n>>> RENVOYER EMAIL en cours pour: {user.email} <<<")
    
    # On envoie l'email EN PREMIER
    email_ok = envoyer_email_creation_compte(user.email, user.prenom_utilisateur, user.nom_utilisateur, mdp)
    
    if email_ok:
        # Email envoyé avec succès -> on sauvegarde le nouveau hash
        user.mot_de_passe = auth.get_password_hash(mdp)
        user.premiere_connexion = True
        db.commit()
        return True, None
    else:
        # Email échoué -> on ne change PAS le mot de passe en base, l'ancien reste valide
        return False, "Echec de l'envoi de l'email. Le mot de passe n'a pas été modifié."


# ═══════════════════════════════════════════════════════
#  CLIENTS
# ═══════════════════════════════════════════════════════
def get_clients(db: Session):
    return db.query(models.Client).filter(models.Client.actif == True).all()

def get_client(db: Session, client_id: int):
    return db.query(models.Client).filter(models.Client.id_client == client_id).first()

def create_client(db: Session, client: schemas.ClientCreate):
    mdp = generer_mot_de_passe()
    clean_email = client.email.strip().lower()
    print(f"\n>>> COMPTE CLIENT EN COURS: {clean_email} <<<")
    
    # Créer le compte SANS hash d'abord (ou avec hash temporaire)
    db_client = models.Client(
        nom_utilisateur=client.nom_utilisateur, prenom_utilisateur=client.prenom_utilisateur, 
        email=clean_email,
        telephone=client.telephone, adresse=client.adresse, ville=client.ville,
        mot_de_passe=auth.get_password_hash(mdp),  # hash pré-calculé
        role="client",
        premiere_connexion=True,
    )
    db.add(db_client)
    db.flush()  # réserve l'ID sans committer
    
    # Envoyer l'email
    email_ok = envoyer_email_creation_compte(clean_email, client.prenom_utilisateur, client.nom_utilisateur, mdp)
    
    if email_ok:
        db.commit()  # tout va bien -> on confirme
        db.refresh(db_client)
        print(f">>> EMAIL ENVOYE AVEC SUCCES a {clean_email} <<<")
    else:
        db.rollback()  # email échoué -> on annule la création
        print(f">>> ECHEC EMAIL pour {clean_email} - COMPTE NON CREE <<<")
        raise Exception(f"Impossible d'envoyer l'email à {clean_email}. Compte non créé. Vérifiez votre configuration SMTP dans le fichier .env (Hote, Port, Email et Mot de passe d'application).")
    
    return db_client

def inscription_client(db: Session, data: schemas.ClientInscription):
    """Trouve le client existant par email et ajoute le mot de passe"""
    db_client = db.query(models.Client).filter(models.Client.email == data.email).first()
    if not db_client:
        return None, "Aucun client trouvé avec cet email. Contactez le garage pour être enregistré."
    if db_client.mot_de_passe:
        return None, "Ce client a déjà un compte actif."
    db_client.mot_de_passe = auth.get_password_hash(data.mot_de_passe)
    db.commit()
    db.refresh(db_client)
    return db_client, None

def update_client(db: Session, client_id: int, client: schemas.ClientUpdate):
    db_client = db.query(models.Client).filter(models.Client.id_client == client_id).first()
    if not db_client:
        return None
    update_data = client.dict(exclude_unset=True)
    if "email" in update_data:
        update_data["email"] = update_data["email"].strip().lower()
    if "mot_de_passe" in update_data and update_data["mot_de_passe"]:
        update_data["mot_de_passe"] = auth.get_password_hash(update_data["mot_de_passe"])
    
    for key, value in update_data.items():
        setattr(db_client, key, value)
    db.commit()
    db.refresh(db_client)
    return db_client

def delete_client(db: Session, client_id: int):
    db_client = db.query(models.Client).filter(models.Client.id_client == client_id).first()
    if not db_client:
        return False
    db_client.actif = False
    db_client.email = f"{db_client.email}.del.{uuid.uuid4().hex[:6]}"
    db.commit()
    return True

def get_vehicules_by_client(db: Session, client_id: int):
    return db.query(models.Vehicule).filter(models.Vehicule.id_client == client_id).all()


# ═══════════════════════════════════════════════════════
#  MÉCANICIENS
# ═══════════════════════════════════════════════════════
def get_mecaniciens(db: Session):
    return db.query(models.Mecanicien).filter(models.Mecanicien.actif == True).all()

def get_mecanicien(db: Session, mecanicien_id: int):
    return db.query(models.Mecanicien).filter(models.Mecanicien.id_mecanicien == mecanicien_id).first()

def get_mecaniciens_disponibles(db: Session):
    all_mecas = db.query(models.Mecanicien).filter(models.Mecanicien.disponible == True).all()
    result = []
    for m in all_mecas:
        en_cours = db.query(models.Intervention).filter(
            models.Intervention.id_mecanicien == m.id_utilisateur,
            models.Intervention.statut == "En cours"
        ).count()
        if en_cours < 3:
            result.append(m)
    return result

def create_mecanicien(db: Session, mecanicien: schemas.MecanicienCreate):
    mdp = generer_mot_de_passe()
    clean_email = mecanicien.email.strip().lower()
    print(f"\n>>> COMPTE MECANICIEN EN COURS: {clean_email} <<<")
    
    db_meca = models.Mecanicien(
        nom_utilisateur=mecanicien.nom_utilisateur, prenom_utilisateur=mecanicien.prenom_utilisateur, 
        email=clean_email,
        telephone=mecanicien.telephone, specialite=mecanicien.specialite,
        disponible=mecanicien.disponible,
        mot_de_passe=auth.get_password_hash(mdp),
        role="mecanicien",
        premiere_connexion=True,
    )
    db.add(db_meca)
    db.flush()
    
    email_ok = envoyer_email_creation_compte(clean_email, mecanicien.prenom_utilisateur, mecanicien.nom_utilisateur, mdp)
    
    if email_ok:
        db.commit()
        db.refresh(db_meca)
        print(f">>> EMAIL ENVOYE AVEC SUCCES a {clean_email} <<<")
    else:
        db.rollback()
        print(f">>> ECHEC EMAIL pour {clean_email} - COMPTE NON CREE <<<")
        raise Exception(f"Impossible d'envoyer l'email à {clean_email}. Compte non créé. Vérifiez votre configuration SMTP dans le fichier .env.")
    
    return db_meca

def update_mecanicien(db: Session, mecanicien_id: int, mecanicien: schemas.MecanicienUpdate):
    db_meca = db.query(models.Mecanicien).filter(models.Mecanicien.id_mecanicien == mecanicien_id).first()
    if not db_meca:
        return None
    update_data = mecanicien.dict(exclude_unset=True)
    if "email" in update_data:
        update_data["email"] = update_data["email"].strip().lower()
    if "mot_de_passe" in update_data and update_data["mot_de_passe"]:
        update_data["mot_de_passe"] = auth.get_password_hash(update_data["mot_de_passe"])

    for key, value in update_data.items():
        setattr(db_meca, key, value)
    db.commit()
    db.refresh(db_meca)
    return db_meca

def delete_mecanicien(db: Session, mecanicien_id: int):
    db_meca = db.query(models.Mecanicien).filter(models.Mecanicien.id_mecanicien == mecanicien_id).first()
    if not db_meca:
        return False
    db_meca.actif = False
    db_meca.email = f"{db_meca.email}.del.{uuid.uuid4().hex[:6]}"
    db.commit()
    return True


# ═══════════════════════════════════════════════════════
#  RÉCEPTIONNISTES
# ═══════════════════════════════════════════════════════
def get_receptionnistes(db: Session):
    return db.query(models.Receptionniste).filter(models.Receptionniste.actif == True).all()

def create_receptionniste(db: Session, recep: schemas.ReceptionnisteCreate):
    mdp = generer_mot_de_passe()
    clean_email = recep.email.strip().lower()
    print(f"\n>>> COMPTE RECEPTIONNISTE EN COURS: {clean_email} <<<")
    
    db_recep = models.Receptionniste(
        nom_utilisateur=recep.nom_utilisateur, prenom_utilisateur=recep.prenom_utilisateur, 
        email=clean_email,
        telephone=recep.telephone,
        mot_de_passe=auth.get_password_hash(mdp),
        role="receptionniste",
        premiere_connexion=True,
    )
    db.add(db_recep)
    db.flush()
    
    email_ok = envoyer_email_creation_compte(clean_email, recep.prenom_utilisateur, recep.nom_utilisateur, mdp)
    
    if email_ok:
        db.commit()
        db.refresh(db_recep)
        print(f">>> EMAIL ENVOYE AVEC SUCCES a {clean_email} <<<")
    else:
        db.rollback()
        print(f">>> ECHEC EMAIL pour {clean_email} - COMPTE NON CREE <<<")
        raise Exception(f"Impossible d'envoyer l'email à {clean_email}. Compte non créé. Vérifiez votre configuration SMTP dans le fichier .env.")
    
    return db_recep

def update_receptionniste(db: Session, recep_id: int, recep: schemas.ReceptionnisteUpdate):
    db_recep = db.query(models.Receptionniste).filter(models.Receptionniste.id_receptionniste == recep_id).first()
    if not db_recep:
        return None
    update_data = recep.dict(exclude_unset=True)
    if "email" in update_data:
        update_data["email"] = update_data["email"].strip().lower()
    if "mot_de_passe" in update_data and update_data["mot_de_passe"]:
        update_data["mot_de_passe"] = auth.get_password_hash(update_data["mot_de_passe"])

    for key, value in update_data.items():
        setattr(db_recep, key, value)
    db.commit()
    db.refresh(db_recep)
    return db_recep

def delete_receptionniste(db: Session, recep_id: int):
    db_recep = db.query(models.Receptionniste).filter(models.Receptionniste.id_receptionniste == recep_id).first()
    if not db_recep:
        return False
    db_recep.actif = False
    db_recep.email = f"{db_recep.email}.del.{uuid.uuid4().hex[:6]}"
    db.commit()
    return True


# ═══════════════════════════════════════════════════════
#  ADMINISTRATEUR
# ═══════════════════════════════════════════════════════
def get_admin(db: Session):
    return db.query(models.Administrateur).first()

def create_admin(db: Session, admin: schemas.AdminCreate):
    # Un seul admin
    existing = db.query(models.Administrateur).first()
    if existing:
        return None, "Un administrateur existe déjà"
    db_admin = models.Administrateur(
        nom_utilisateur=admin.nom_utilisateur, prenom_utilisateur=admin.prenom_utilisateur, email=admin.email,
        telephone=admin.telephone, mot_de_passe=auth.get_password_hash(admin.mot_de_passe) if admin.mot_de_passe else None,
        role="admin",
        premiere_connexion=False, # L'admin n'a pas besoin de changer à la première connexion si créé manuellement
    )
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)
    return db_admin, None


# ═══════════════════════════════════════════════════════
#  AUTH — Définir mot de passe via token
# ═══════════════════════════════════════════════════════
def definir_mot_de_passe(db: Session, token: str, mot_de_passe: str):
    user = db.query(models.Utilisateur).filter(models.Utilisateur.token_reset == token).first()
    if not user:
        return None, "Token invalide ou expiré"
    user.mot_de_passe = auth.get_password_hash(mot_de_passe)
    user.token_reset = None  # Invalider le token
    user.premiere_connexion = False # Mot de passe défini, donc plus de première connexion forcée
    db.commit()
    db.refresh(user)
    return user, None

def changer_mot_de_passe(db: Session, email: str, mot_de_passe: str):
    user = get_utilisateur_by_email(db, email)
    if not user:
        return None, "Utilisateur non trouvé"
    user.mot_de_passe = auth.get_password_hash(mot_de_passe)
    user.premiere_connexion = False
    db.commit()
    db.refresh(user)
    return user, None

def request_password_reset(db: Session, email: str):
    user = get_utilisateur_by_email(db, email)
    if not user:
        return False # On ne dit pas que l'email n'existe pas pour des raisons de sécurité
    
    token = uuid.uuid4().hex
    user.token_reset = token
    db.commit()
    
    from .email_utils import envoyer_email_reinitialisation
    envoyer_email_reinitialisation(user.email, user.prenom_utilisateur, token)
    return True


# ═══════════════════════════════════════════════════════
#  VÉHICULES
# ═══════════════════════════════════════════════════════
def get_vehicules(db: Session):
    return db.query(models.Vehicule).all()

def get_vehicule(db: Session, vehicule_id: int):
    return db.query(models.Vehicule).filter(models.Vehicule.id_vehicule == vehicule_id).first()

def create_vehicule(db: Session, vehicule: schemas.VehiculeCreate):
    db_vehicule = models.Vehicule(**vehicule.dict())
    db.add(db_vehicule)
    db.commit()
    db.refresh(db_vehicule)
    return db_vehicule

def update_vehicule(db: Session, vehicule_id: int, vehicule: schemas.VehiculeUpdate):
    db_vehicule = db.query(models.Vehicule).filter(models.Vehicule.id_vehicule == vehicule_id).first()
    if not db_vehicule:
        return None
    update_data = vehicule.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_vehicule, key, value)
    db.commit()
    db.refresh(db_vehicule)
    return db_vehicule

def delete_vehicule(db: Session, vehicule_id: int):
    db_vehicule = db.query(models.Vehicule).filter(models.Vehicule.id_vehicule == vehicule_id).first()
    if not db_vehicule:
        return False
    db.delete(db_vehicule)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════
#  RÉPARATIONS
# ═══════════════════════════════════════════════════════
def get_reparations(db: Session):
    return db.query(models.Reparation).all()

def get_reparation(db: Session, reparation_id: int):
    return db.query(models.Reparation).filter(models.Reparation.id_reparation == reparation_id).first()

def get_reparations_by_vehicule(db: Session, vehicule_id: int):
    return db.query(models.Reparation).filter(
        models.Reparation.id_vehicule == vehicule_id
    ).order_by(models.Reparation.date_debut.desc()).all()

def create_reparation(db: Session, reparation: schemas.ReparationCreate):
    db_reparation = models.Reparation(**reparation.dict())
    db.add(db_reparation)
    db.commit()
    db.refresh(db_reparation)
    return db_reparation

def update_reparation(db: Session, reparation_id: int, reparation: schemas.ReparationUpdate):
    db_rep = db.query(models.Reparation).filter(models.Reparation.id_reparation == reparation_id).first()
    if not db_rep:
        return None
    update_data = reparation.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rep, key, value)
    db.commit()
    db.refresh(db_rep)
    return db_rep

def delete_reparation(db: Session, reparation_id: int):
    db_rep = db.query(models.Reparation).filter(models.Reparation.id_reparation == reparation_id).first()
    if not db_rep:
        return False
    db.delete(db_rep)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════
#  INTERVENTIONS
# ═══════════════════════════════════════════════════════
def get_interventions(db: Session):
    return db.query(models.Intervention).order_by(models.Intervention.date_creation.desc()).all()

def get_intervention(db: Session, intervention_id: int):
    return db.query(models.Intervention).filter(models.Intervention.id_intervention == intervention_id).first()

def create_intervention(db: Session, intervention: schemas.InterventionCreate):
    data = intervention.dict()
    db_inter = models.Intervention(**data)
    # Si assigné dès le départ
    if db_inter.id_mecanicien:
        db_inter.statut = "En cours"
    db.add(db_inter)
    db.commit()
    db.refresh(db_inter)
    return db_inter

def update_intervention(db: Session, intervention_id: int, intervention: schemas.InterventionUpdate):
    db_inter = db.query(models.Intervention).filter(models.Intervention.id_intervention == intervention_id).first()
    if not db_inter:
        return None
    update_data = intervention.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_inter, key, value)
    
    # Si on vient d'assigner un mécanicien et que c'était en attente, on passe en cours
    if db_inter.id_mecanicien and db_inter.statut == "En attente":
        db_inter.statut = "En cours"
        
    db.commit()
    db.refresh(db_inter)
    return db_inter

def affecter_mecanicien(db: Session, intervention_id: int, mecanicien_id: int):
    db_inter = db.query(models.Intervention).filter(models.Intervention.id_intervention == intervention_id).first()
    if not db_inter:
        return None, "Intervention non trouvée"
    db_meca = db.query(models.Mecanicien).filter(models.Mecanicien.id_mecanicien == mecanicien_id).first()
    if not db_meca:
        return None, "Mécanicien non trouvé"
    if not db_meca.disponible:
        return None, "Ce mécanicien n'est pas disponible"
    en_cours = db.query(models.Intervention).filter(
        models.Intervention.id_mecanicien == mecanicien_id,
        models.Intervention.statut == "En cours"
    ).count()
    if en_cours >= 3:
        return None, "Ce mécanicien a déjà 3 interventions en cours"
    db_inter.id_mecanicien = mecanicien_id
    if db_inter.statut == "En attente":
        db_inter.statut = "En cours"
    db.commit()
    db.refresh(db_inter)
    return db_inter, None

def affecter_auto(db: Session, intervention_id: int):
    db_inter = db.query(models.Intervention).filter(models.Intervention.id_intervention == intervention_id).first()
    if not db_inter:
        return None, "Intervention non trouvée"
    mecas_dispo = db.query(models.Mecanicien).filter(models.Mecanicien.disponible == True).all()
    if not mecas_dispo:
        return None, "Aucun mécanicien disponible"
    meilleur = None
    min_charge = 999
    for m in mecas_dispo:
        charge = db.query(models.Intervention).filter(
            models.Intervention.id_mecanicien == m.id_utilisateur,
            models.Intervention.statut == "En cours"
        ).count()
        if charge < 3 and charge < min_charge:
            min_charge = charge
            meilleur = m
    if not meilleur:
        return None, "Tous les mécaniciens sont surchargés"
    db_inter.id_mecanicien = meilleur.id_utilisateur
    if db_inter.statut == "En attente":
        db_inter.statut = "En cours"
    db.commit()
    db.refresh(db_inter)
    return db_inter, None

def cloturer_intervention(db: Session, intervention_id: int, reparation: schemas.ReparationCreate):
    from datetime import datetime
    # 1. Update Intervention
    db_inter = db.query(models.Intervention).filter(models.Intervention.id_intervention == intervention_id).first()
    if not db_inter:
        return None, "Intervention non trouvée"
    
    db_inter.statut = "Terminé"
    
    # 2. Create Reparation
    repar_data = reparation.dict()
    # On s'assure que le véhicule est le bon
    repar_data["id_vehicule"] = db_inter.id_vehicule
    if not repar_data.get("date_fin"):
        repar_data["date_fin"] = datetime.utcnow()
    
    if not repar_data.get("date_debut"):
        # On essaie d'utiliser la date de création de l'intervention
        repar_data["date_debut"] = db_inter.date_creation or datetime.utcnow()
    
    # Référence automatique si vide
    if not repar_data.get("reference"):
        import uuid
        repar_data["reference"] = f"REP-{uuid.uuid4().hex[:6].upper()}"
    
    # Ajouter le nom du mécanicien
    if db_inter.id_mecanicien:
        meca = db.query(models.Utilisateur).filter(models.Utilisateur.id_utilisateur == db_inter.id_mecanicien).first()
        if meca:
            repar_data["technicien"] = f"{meca.prenom_utilisateur} {meca.nom_utilisateur}"
    
    db_reparation = models.Reparation(**repar_data)
    db.add(db_reparation)
    
    db.commit()
    db.refresh(db_inter)
    db.refresh(db_reparation)
    return db_inter, None

def delete_intervention(db: Session, intervention_id: int):
    db_inter = db.query(models.Intervention).filter(models.Intervention.id_intervention == intervention_id).first()
    if not db_inter:
        return False
    db.delete(db_inter)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════
#  PIÈCES (Stock)
# ═══════════════════════════════════════════════════════
def get_pieces(db: Session):
    return db.query(models.Piece).order_by(models.Piece.nom_piece).all()

def get_piece(db: Session, piece_id: int):
    return db.query(models.Piece).filter(models.Piece.id_piece == piece_id).first()

def create_piece(db: Session, piece: schemas.PieceCreate):
    data = piece.dict()
    if data.get("date_enregistrement"):
        from datetime import datetime
        data["date_enregistrement"] = datetime.strptime(data["date_enregistrement"], "%Y-%m-%d")
    else:
        data.pop("date_enregistrement", None)
    db_piece = models.Piece(**data)
    db.add(db_piece)
    db.commit()
    db.refresh(db_piece)
    return db_piece

def update_piece(db: Session, piece_id: int, piece: schemas.PieceUpdate):
    db_piece = db.query(models.Piece).filter(models.Piece.id_piece == piece_id).first()
    if not db_piece:
        return None
    update_data = piece.dict(exclude_unset=True)
    if "date_enregistrement" in update_data and update_data["date_enregistrement"]:
        from datetime import datetime
        update_data["date_enregistrement"] = datetime.strptime(update_data["date_enregistrement"], "%Y-%m-%d")
    for key, value in update_data.items():
        setattr(db_piece, key, value)
    db.commit()
    db.refresh(db_piece)
    return db_piece

def prendre_piece(db: Session, piece_id: int, quantite: int):
    db_piece = db.query(models.Piece).filter(models.Piece.id_piece == piece_id).first()
    if not db_piece:
        return None, "Pièce non trouvée"
    if quantite <= 0:
        return None, "La quantité doit être positive"
    if quantite > db_piece.quantite:
        return None, f"Stock insuffisant (disponible: {db_piece.quantite})"
    db_piece.quantite -= quantite
    db.commit()
    db.refresh(db_piece)
    return db_piece, None

def delete_piece(db: Session, piece_id: int):
    db_piece = db.query(models.Piece).filter(models.Piece.id_piece == piece_id).first()
    if not db_piece:
        return False
    db.delete(db_piece)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════
#  DEVIS
# ═══════════════════════════════════════════════════════
def _gen_reference(db: Session):
    count = db.query(models.Devis).count()
    return f"DEV-{count + 1:04d}"

def get_devis_list(db: Session):
    return db.query(models.Devis).order_by(models.Devis.date_creation.desc()).all()

def get_devis(db: Session, devis_id: int):
    return db.query(models.Devis).filter(models.Devis.id_devis == devis_id).first()

def create_devis(db: Session, devis: schemas.DevisCreate):
    from datetime import datetime as dt
    data = {
        "reference": _gen_reference(db),
        "id_client": devis.id_client,
        "id_vehicule": devis.id_vehicule,
        "id_intervention": devis.id_intervention,
        "statut": devis.statut,
        "note": devis.note,
    }
    if devis.date_creation:
        data["date_creation"] = dt.strptime(devis.date_creation, "%Y-%m-%d")
    if devis.date_echeance:
        data["date_echeance"] = dt.strptime(devis.date_echeance, "%Y-%m-%d")
    db_devis = models.Devis(**data)
    db.add(db_devis)
    db.flush()
    for ligne in devis.lignes:
        db_ligne = models.LigneDevis(
            id_devis=db_devis.id_devis,
            description=ligne.description,
            quantite=ligne.quantite,
            prix_unitaire=ligne.prix_unitaire,
            id_piece=ligne.id_piece,  # lien stock
        )
        db.add(db_ligne)
    db.commit()
    db.refresh(db_devis)
    return db_devis

def update_devis(db: Session, devis_id: int, devis: schemas.DevisUpdate):
    from datetime import datetime as dt
    db_devis = db.query(models.Devis).filter(models.Devis.id_devis == devis_id).first()
    if not db_devis:
        return None
    update_data = devis.dict(exclude_unset=True)
    lignes_data = update_data.pop("lignes", None)
    if "date_echeance" in update_data and update_data["date_echeance"]:
        update_data["date_echeance"] = dt.strptime(update_data["date_echeance"], "%Y-%m-%d")
    for key, value in update_data.items():
        setattr(db_devis, key, value)
    # Remplacer les lignes si fournies
    if lignes_data is not None:
        db.query(models.LigneDevis).filter(models.LigneDevis.id_devis == devis_id).delete()
        for l in lignes_data:
            db_ligne = models.LigneDevis(
                id_devis=devis_id,
                description=l["description"],
                quantite=l["quantite"],
                prix_unitaire=l["prix_unitaire"],
                id_piece=l.get("id_piece"),  # lien stock
            )
            db.add(db_ligne)
    db.commit()
    db.refresh(db_devis)
    return db_devis

def delete_devis(db: Session, devis_id: int):
    db_devis = db.query(models.Devis).filter(models.Devis.id_devis == devis_id).first()
    if not db_devis:
        return False
    db.delete(db_devis)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════
#  FACTURE
# ═══════════════════════════════════════════════════════
def _gen_facture_ref(db: Session):
    count = db.query(models.Facture).count()
    return f"FAC-{count + 1:04d}"

def get_factures(db: Session):
    return db.query(models.Facture).order_by(models.Facture.date_emission.desc()).all()

def create_facture(db: Session, facture: schemas.FactureCreate):
    from datetime import datetime as dt
    data = {
        "reference": _gen_facture_ref(db),
        "id_client": facture.id_client,
        "id_intervention": facture.id_intervention,
        "id_devis": facture.id_devis,
        "montant_total": facture.montant_total,
        "statut": facture.statut,
        "note": facture.note,
    }
    if facture.date_emission:
        data["date_emission"] = dt.strptime(facture.date_emission, "%Y-%m-%d")
    if facture.date_echeance:
        data["date_echeance"] = dt.strptime(facture.date_echeance, "%Y-%m-%d")
    db_facture = models.Facture(**data)
    db.add(db_facture)
    db.commit()
    db.refresh(db_facture)
    return db_facture

def update_facture(db: Session, facture_id: int, facture: schemas.FactureUpdate):
    from datetime import datetime as dt
    db_facture = db.query(models.Facture).filter(models.Facture.id_facture == facture_id).first()
    if not db_facture:
        return None
    update_data = facture.dict(exclude_unset=True)
    if "date_echeance" in update_data and update_data["date_echeance"]:
        update_data["date_echeance"] = dt.strptime(update_data["date_echeance"], "%Y-%m-%d")
    for key, value in update_data.items():
        setattr(db_facture, key, value)
    db.commit()
    db.refresh(db_facture)
    return db_facture

def delete_facture(db: Session, facture_id: int):
    db_facture = db.query(models.Facture).filter(models.Facture.id_facture == facture_id).first()
    if not db_facture:
        return False
    db.delete(db_facture)
    db.commit()
    return True

def generer_facture_depuis_devis(db: Session, devis_id: int, note: str = ""):
    """
    Génère une facture à partir d'un devis confirmé.
    Déduit le stock UNIQUEMENT pour les lignes ayant un id_piece (lien direct et fiable).
    Retourne (db_facture, error_message)
    """
    db_devis = db.query(models.Devis).filter(models.Devis.id_devis == devis_id).first()
    if not db_devis:
        return None, "Devis non trouvé"
    if db_devis.statut != "confirme":
        return None, f"Le devis doit être confirmé par le client avant de générer une facture (statut actuel : {db_devis.statut})"
    if db_devis.facture_generee:
        return None, "Une facture a déjà été générée depuis ce devis"

    # Vérification doublon via id_devis
    if db.query(models.Facture).filter(models.Facture.id_devis == devis_id).first():
        db_devis.facture_generee = True
        db.commit()
        return None, "Une facture est déjà liée à ce devis"

    # Calcul du montant total depuis les lignes du devis
    montant_total = sum(l.quantite * l.prix_unitaire for l in db_devis.lignes)

    # Récupérer le numéro du devis (ex: DEV-003 -> 003) pour la facture (FAC-003)
    try:
        if "-" in db_devis.reference:
            num = db_devis.reference.split("-")[1]
            facture_ref = f"FAC-{num}"
        else:
            facture_ref = _gen_facture_ref(db)
    except Exception:
        facture_ref = _gen_facture_ref(db)

    # Création de la facture
    db_facture = models.Facture(
        reference=facture_ref,
        id_client=db_devis.id_client,
        id_intervention=db_devis.id_intervention,
        id_devis=db_devis.id_devis,
        montant_total=montant_total,
        statut="En attente",
        note=note or f"Facture générée depuis le devis {db_devis.reference}",
    )
    db.add(db_facture)
    db.flush()

    # ─── DÉDUCTION STOCK — UNIQUEMENT AU MOMENT DE LA FACTURE ───
    # Seules les lignes avec id_piece sont déduites (lien direct fiable)
    for ligne in db_devis.lignes:
        if not ligne.id_piece:
            continue  # prestation/main-d'œuvre sans stock → ignorée
        piece = db.query(models.Piece).filter(
            models.Piece.id_piece == ligne.id_piece
        ).with_for_update().first()
        if not piece:
            print(f"[STOCK] ⚠ Pièce ID {ligne.id_piece} introuvable pour la ligne '{ligne.description}'")
            continue
        qte_disponible = piece.quantite
        qte_a_deduire = min(ligne.quantite, qte_disponible)
        piece.quantite -= qte_a_deduire
        print(f"[STOCK] '{piece.nom_piece}' : -{qte_a_deduire} (demandé: {ligne.quantite}, restant: {piece.quantite})")
        if ligne.quantite > qte_disponible:
            print(f"[STOCK] ⚠ Stock insuffisant pour '{piece.nom_piece}' : demandé {ligne.quantite}, disponible {qte_disponible}")

    # Marquer le devis comme facturé (empêche toute double facturation)
    db_devis.facture_generee = True
    db.commit()
    db.refresh(db_facture)
    return db_facture, None



# ═══════════════════════════════════════════════════════
#  RENDEZ-VOUS
# ═══════════════════════════════════════════════════════
def get_rendezvous(db: Session):
    return db.query(models.RendezVous).order_by(models.RendezVous.date_heure.asc()).all()

def create_rendezvous(db: Session, rdv: schemas.RendezVousCreate):
    from datetime import datetime as dt
    db_rdv = models.RendezVous(
        id_client=rdv.id_client,
        id_vehicule=rdv.id_vehicule,
        date_heure=dt.strptime(rdv.date_heure[:16], "%Y-%m-%dT%H:%M"),
        motif=rdv.motif,
        statut=rdv.statut,
        notes=rdv.notes,
    )
    db.add(db_rdv)
    db.commit()
    db.refresh(db_rdv)
    return db_rdv

def update_rendezvous(db: Session, rdv_id: int, rdv: schemas.RendezVousUpdate):
    from datetime import datetime as dt
    db_rdv = db.query(models.RendezVous).filter(models.RendezVous.id_rendezvous == rdv_id).first()
    if not db_rdv:
        return None
    update_data = rdv.dict(exclude_unset=True)
    if "date_heure" in update_data and update_data["date_heure"]:
        update_data["date_heure"] = dt.strptime(update_data["date_heure"][:16], "%Y-%m-%dT%H:%M")
    for key, value in update_data.items():
        setattr(db_rdv, key, value)
    db.commit()
    db.refresh(db_rdv)
    return db_rdv

def delete_rendezvous(db: Session, rdv_id: int):
    db_rdv = db.query(models.RendezVous).filter(models.RendezVous.id_rendezvous == rdv_id).first()
    if not db_rdv:
        return False
    db.delete(db_rdv)
    db.commit()
    return True

# ═══════════════════════════════════════════════════════
#  AUTHENTIFICATION
# ═══════════════════════════════════════════════════════
def authenticate_user(db: Session, email: str, password: str):
    if not email or not password:
        return False
        
    # Nettoyage des entrées (On enlève les espaces de copier-coller)
    clean_email = email.strip().lower()
    clean_password = password.strip()
    
    user = get_utilisateur_by_email(db, clean_email)
    if not user:
        print(f"DEBUG AUTH: Aucun utilisateur actif trouvé pour l'email '{clean_email}'")
        return False
        
    if not user.mot_de_passe:
        print(f"DEBUG AUTH: L'utilisateur '{clean_email}' n'a pas de mot de passe défini.")
        return False
        
    is_valid = auth.verify_password(clean_password, user.mot_de_passe)
    if not is_valid:
        print(f"DEBUG AUTH: Échec de vérification du mot de passe pour '{clean_email}'.")
        print(f"DEBUG AUTH: Mot de passe fourni: '{clean_password}'")
        print(f"DEBUG AUTH: Hash en base: '{user.mot_de_passe[:20]}...'")
        return False
        
    print(f"DEBUG AUTH: Connexion réussie pour '{clean_email}'")
    return user

def get_avis(db: Session):
    return db.query(models.Avis).order_by(models.Avis.created_at.desc()).all()

def create_avis(db: Session, avis: schemas.AvisCreate, client_id: int):
    db_avis = models.Avis(
        id_client=client_id,
        id_intervention=avis.id_intervention,
        note=avis.note,
        commentaire=avis.commentaire
    )
    db.add(db_avis)
    db.commit()
    db.refresh(db_avis)
    return db_avis
