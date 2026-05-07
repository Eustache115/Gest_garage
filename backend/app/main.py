from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse, FileResponse
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import calendar
import uuid

from . import models, crud, schemas, auth, document_utils
from .database import engine, SessionLocal, Base, get_db
from .email_utils import envoyer_email_creation_compte, envoyer_email_bienvenue, envoyer_notification_intervention_terminee, envoyer_notification_statut_change

# Utilise get_db importé depuis .database

app = FastAPI(title="Garage Management API", root_path="/api")

@app.on_event("startup")
def on_startup():
    # Création automatique des tables si elles n'existent pas
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(IntegrityError)
def sqlalchemy_integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=400,
        content={"detail": "Cette action est ignorée car la donnée existe déjà (double-clic ou duplication)."}
    )


# ─── Root ─────────────────────────────────────────────
@app.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        return {"status": "ok", "message": "Database connected successfully!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/")
def root(db: Session = Depends(get_db)):
    try:
        user_count = db.query(models.Utilisateur).count()
        return {
            "message": "Garage Backend Running",
            "database_connected": True,
            "user_count": user_count
        }
    except Exception as e:
        return {
            "message": "Garage Backend Running",
            "database_connected": False,
            "error": str(e)
        }

@app.get("/setup-admin")
def setup_admin(db: Session = Depends(get_db)):
    """Crée l'administrateur par défaut si aucun n'existe."""
    existing = db.query(models.Administrateur).first()
    if existing:
        return {"message": "Admin already exists", "email": existing.email}
    
    try:
        db_admin = models.Administrateur(
            nom_utilisateur="Admin", 
            prenom_utilisateur="Super", 
            email="eustachehounfodji6@gmail.com",
            telephone="0600000000", 
            mot_de_passe=auth.get_password_hash("Eustache@05"), 
            role="admin",
            premiere_connexion=False
        )
        db.add(db_admin)
        db.commit()
        return {"message": "Admin created successfully", "email": db_admin.email, "password_hint": "Eustache@05"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════
#  UTILISATEURS (tous types)
# ═══════════════════════════════════════════════════════
@app.get("/utilisateurs", response_model=list[schemas.UtilisateurResponse])
def read_utilisateurs(db: Session = Depends(get_db)):
    return crud.get_utilisateurs(db)

@app.get("/utilisateurs/{user_id}", response_model=schemas.UtilisateurResponse)
def read_utilisateur(user_id: int, db: Session = Depends(get_db)):
    u = crud.get_utilisateur(db, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return u

@app.post("/utilisateurs/{user_id}/renvoyer-email")
def renvoyer_email_activation(user_id: int, db: Session = Depends(get_db)):
    """Renvoie l'email de bienvenue avec un nouveau mot de passe provisoire."""
    success, error = crud.renvoyer_activation_utilisateur(db, user_id)
    if not success:
        raise HTTPException(status_code=400, detail=error)
    return {"detail": "Email de bienvenue renvoyé avec succès"}

@app.delete("/utilisateurs/{user_id}")
def delete_utilisateur(user_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_admin)):
    success = crud.delete_utilisateur(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return {"detail": "Utilisateur supprimé"}


# ═══════════════════════════════════════════════════════
#  AUTH
# ═══════════════════════════════════════════════════════
@app.post("/auth/definir-mot-de-passe")
def definir_mot_de_passe(body: schemas.DefinirMotDePasse, db: Session = Depends(get_db)):
    user, error = crud.definir_mot_de_passe(db, body.token, body.mot_de_passe)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"detail": "Mot de passe défini avec succès", "email": user.email}

@app.post("/auth/mot-de-passe-oublie")
def mot_de_passe_oublie(body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    crud.request_password_reset(db, body.email)
    # On renvoie toujours le même message pour éviter l'énumération d'emails
    return {"detail": "Si un compte est associé à cet email, un lien de réinitialisation vous a été envoyé."}

@app.post("/auth/changer-mot-de-passe")
def changer_mot_de_passe(body: schemas.DefinirMotDePasse, db: Session = Depends(get_db)):
    # Note: On utilise le même schéma DefinirMotDePasse pour simplifier (token sera l'email ou ignoré ici si on utilise current_user)
    # Mais pour faire simple et rapide, on va utiliser le token comme email dans ce cas précis ou passer par l'utilisateur connecté.
    user, error = crud.changer_mot_de_passe(db, body.token, body.mot_de_passe)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"detail": "Mot de passe mis à jour avec succès"}

@app.get("/auth/verifier-token/{token}")
def verifier_token(token: str, db: Session = Depends(get_db)):
    user = db.query(models.Utilisateur).filter(models.Utilisateur.token_reset == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Token invalide ou expiré")
    return {"valide": True, "prenom_utilisateur": user.prenom_utilisateur, "nom_utilisateur": user.nom_utilisateur, "email": user.email}


# ─── Login ────────────────────────────────────────────
@app.post("/login")
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Authentifie un utilisateur et retourne un JWT + infos utilisateur."""
    user = crud.authenticate_user(db, body.email, body.mot_de_passe)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
    if not user.actif:
        raise HTTPException(status_code=400, detail="Compte désactivé")
    access_token = auth.create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id_utilisateur": user.id_utilisateur,
            "nom_utilisateur": user.nom_utilisateur,
            "prenom_utilisateur": user.prenom_utilisateur,
            "email": user.email,
            "role": user.role,
            "premiere_connexion": user.premiere_connexion,
        },
    }


# ─── Changer mot de passe (utilisateur connecté) ─────
@app.post("/auth/changer-mot-de-passe-connecte")
def changer_mot_de_passe_connecte(
    body: schemas.ChangerMotDePasseRequest,
    current_user: models.Utilisateur = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Change le mot de passe de l'utilisateur connecté et désactive le flag premiere_connexion."""
    current_user.mot_de_passe = auth.get_password_hash(body.nouveau_mot_de_passe)
    current_user.premiere_connexion = False
    db.commit()
    db.refresh(current_user)
    return {"detail": "Mot de passe modifié avec succès"}


@app.put("/auth/profil")
def update_mon_profil(
    body: schemas.ProfilUpdate,
    db: Session = Depends(get_db),
    current_user: models.Utilisateur = Depends(auth.get_current_user),
):
    """Met à jour les informations de base du compte connecté."""
    if body.nom_utilisateur is not None: current_user.nom_utilisateur = body.nom_utilisateur
    if body.prenom_utilisateur is not None: current_user.prenom_utilisateur = body.prenom_utilisateur
    if body.telephone is not None: current_user.telephone = body.telephone
    
    db.commit()
    db.refresh(current_user)
    return {
        "id_utilisateur": current_user.id_utilisateur,
        "nom_utilisateur": current_user.nom_utilisateur,
        "prenom_utilisateur": current_user.prenom_utilisateur,
        "email": current_user.email,
        "telephone": current_user.telephone,
        "role": current_user.role
    }


# ═══════════════════════════════════════════════════════
#  ADMINISTRATEUR
# ═══════════════════════════════════════════════════════
@app.get("/admin", response_model=schemas.AdminResponse)
def get_admin(db: Session = Depends(get_db)):
    admin = crud.get_admin(db)
    if not admin:
        raise HTTPException(status_code=404, detail="Aucun administrateur configuré")
    return admin

@app.post("/admin", response_model=schemas.AdminResponse)
def create_admin(admin: schemas.AdminCreate, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_admin)):
    db_admin, error = crud.create_admin(db, admin)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_admin

# ═══════════════════════════════════════════════════════
#  CLIENTS
# ═══════════════════════════════════════════════════════
@app.get("/clients", response_model=list[schemas.ClientResponse])
def read_clients(db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    clients = crud.get_clients(db)
    result = []
    for c in clients:
        data = schemas.ClientResponse(
            id_client=c.id_client, nom_utilisateur=c.nom_utilisateur, prenom_utilisateur=c.prenom_utilisateur, email=c.email,
            telephone=c.telephone, adresse=c.adresse, ville=c.ville,
            role=c.role, actif=c.actif,
            vehicules_count=len(c.vehicules), created_at=c.created_at,
        )
        result.append(data)
    return result

@app.get("/clients/{client_id}", response_model=schemas.ClientResponse)
def read_client(client_id: int, db: Session = Depends(get_db)):
    db_client = crud.get_client(db, client_id)
    if not db_client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    return schemas.ClientResponse(
        id_client=db_client.id_client, nom_utilisateur=db_client.nom_utilisateur, prenom_utilisateur=db_client.prenom_utilisateur,
        email=db_client.email, telephone=db_client.telephone,
        adresse=db_client.adresse, ville=db_client.ville,
        role=db_client.role, actif=db_client.actif,
        vehicules_count=len(db_client.vehicules), created_at=db_client.created_at,
    )

@app.post("/clients", response_model=schemas.ClientResponse)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    existing = crud.get_utilisateur_by_email(db, client.email)
    if existing:
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà")
    try:
        db_client = crud.create_client(db, client)
        return schemas.ClientResponse(
            id_client=db_client.id_client, nom_utilisateur=db_client.nom_utilisateur, prenom_utilisateur=db_client.prenom_utilisateur,
            email=db_client.email, telephone=db_client.telephone,
            adresse=db_client.adresse, ville=db_client.ville,
            role=db_client.role, actif=db_client.actif,
            vehicules_count=0, created_at=db_client.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clients/inscription", response_model=schemas.ClientResponse)
def inscription_client(data: schemas.ClientInscription, db: Session = Depends(get_db)):
    """Activation du compte client — le client doit déjà exister (créé par le réceptionniste)"""
    db_client, error = crud.inscription_client(db, data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return schemas.ClientResponse(
        id_client=db_client.id_client, nom_utilisateur=db_client.nom_utilisateur, prenom_utilisateur=db_client.prenom_utilisateur,
        email=db_client.email, telephone=db_client.telephone,
        adresse=db_client.adresse, ville=db_client.ville,
        role=db_client.role, actif=db_client.actif,
        vehicules_count=len(db_client.vehicules), created_at=db_client.created_at,
    )

@app.put("/clients/{client_id}", response_model=schemas.ClientResponse)
def update_client(client_id: int, client: schemas.ClientUpdate, db: Session = Depends(get_db)):
    db_client = crud.update_client(db, client_id, client)
    if not db_client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    return schemas.ClientResponse(
        id_client=db_client.id_client, nom_utilisateur=db_client.nom_utilisateur, prenom_utilisateur=db_client.prenom_utilisateur,
        email=db_client.email, telephone=db_client.telephone,
        adresse=db_client.adresse, ville=db_client.ville,
        role=db_client.role, actif=db_client.actif,
        vehicules_count=len(db_client.vehicules), created_at=db_client.created_at,
    )

@app.delete("/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    success = crud.delete_client(db, client_id)
    if not success:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    return {"detail": "Client supprimé"}

@app.get("/clients/{client_id}/vehicules", response_model=list[schemas.VehiculeResponse])
def read_client_vehicules(client_id: int, db: Session = Depends(get_db)):
    db_client = crud.get_client(db, client_id)
    if not db_client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    return crud.get_vehicules_by_client(db, client_id)


# ═══════════════════════════════════════════════════════
#  MÉCANICIENS
# ═══════════════════════════════════════════════════════
@app.get("/mecaniciens", response_model=list[schemas.MecanicienResponse])
def read_mecaniciens(db: Session = Depends(get_db)):
    mecas = crud.get_mecaniciens(db)
    result = []
    for m in mecas:
        en_cours = db.query(models.Intervention).filter(
            models.Intervention.id_mecanicien == m.id_utilisateur,
            models.Intervention.statut == "En cours"
        ).count()
        result.append(schemas.MecanicienResponse(
            id_mecanicien=m.id_mecanicien, nom_utilisateur=m.nom_utilisateur, prenom_utilisateur=m.prenom_utilisateur, email=m.email,
            telephone=m.telephone, specialite=m.specialite,
            disponible=m.disponible, role=m.role, actif=m.actif,
            interventions_en_cours=en_cours, created_at=m.created_at,
        ))
    return result

@app.get("/mecaniciens/disponibles", response_model=list[schemas.MecanicienResponse])
def read_mecaniciens_disponibles(db: Session = Depends(get_db)):
    mecas = crud.get_mecaniciens_disponibles(db)
    result = []
    for m in mecas:
        en_cours = db.query(models.Intervention).filter(
            models.Intervention.id_mecanicien == m.id_utilisateur,
            models.Intervention.statut == "En cours"
        ).count()
        result.append(schemas.MecanicienResponse(
            id_mecanicien=m.id_mecanicien, nom_utilisateur=m.nom_utilisateur, prenom_utilisateur=m.prenom_utilisateur, email=m.email,
            telephone=m.telephone, specialite=m.specialite,
            disponible=m.disponible, role=m.role, actif=m.actif,
            interventions_en_cours=en_cours, created_at=m.created_at,
        ))
    return result

@app.post("/mecaniciens", response_model=schemas.MecanicienResponse)
def create_mecanicien(mecanicien: schemas.MecanicienCreate, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_admin)):
    existing = crud.get_utilisateur_by_email(db, mecanicien.email)
    if existing:
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà")
    try:
        db_meca = crud.create_mecanicien(db, mecanicien)
        return schemas.MecanicienResponse(
            id_mecanicien=db_meca.id_mecanicien, nom_utilisateur=db_meca.nom_utilisateur, prenom_utilisateur=db_meca.prenom_utilisateur, email=db_meca.email,
            telephone=db_meca.telephone, specialite=db_meca.specialite,
            disponible=db_meca.disponible, role=db_meca.role, actif=db_meca.actif,
            interventions_en_cours=0, created_at=db_meca.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/mecaniciens/{mecanicien_id}", response_model=schemas.MecanicienResponse)
def update_mecanicien(mecanicien_id: int, mecanicien: schemas.MecanicienUpdate, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_admin)):
    db_meca = crud.update_mecanicien(db, mecanicien_id, mecanicien)
    if not db_meca:
        raise HTTPException(status_code=404, detail="Mécanicien non trouvé")
    en_cours = db.query(models.Intervention).filter(
        models.Intervention.id_mecanicien == db_meca.id_utilisateur,
        models.Intervention.statut == "En cours"
    ).count()
    return schemas.MecanicienResponse(
        id_mecanicien=db_meca.id_mecanicien, nom_utilisateur=db_meca.nom_utilisateur, prenom_utilisateur=db_meca.prenom_utilisateur, email=db_meca.email,
        telephone=db_meca.telephone, specialite=db_meca.specialite,
        disponible=db_meca.disponible, role=db_meca.role, actif=db_meca.actif,
        interventions_en_cours=en_cours, created_at=db_meca.created_at,
    )

@app.delete("/mecaniciens/{mecanicien_id}")
def delete_mecanicien(mecanicien_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_admin)):
    success = crud.delete_mecanicien(db, mecanicien_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mécanicien non trouvé")
    return {"detail": "Mécanicien supprimé"}


# ═══════════════════════════════════════════════════════
#  RÉCEPTIONNISTES
# ═══════════════════════════════════════════════════════
@app.get("/receptionnistes", response_model=list[schemas.ReceptionnisteResponse])
def read_receptionnistes(db: Session = Depends(get_db)):
    return crud.get_receptionnistes(db)

@app.post("/receptionnistes", response_model=schemas.ReceptionnisteResponse)
def create_receptionniste(recep: schemas.ReceptionnisteCreate, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_admin)):
    existing = crud.get_utilisateur_by_email(db, recep.email)
    if existing:
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà")
    try:
        db_recep = crud.create_receptionniste(db, recep)
        return db_recep
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/receptionnistes/{recep_id}", response_model=schemas.ReceptionnisteResponse)
def update_receptionniste(recep_id: int, recep: schemas.ReceptionnisteUpdate, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_admin)):
    db_recep = crud.update_receptionniste(db, recep_id, recep)
    if not db_recep:
        raise HTTPException(status_code=404, detail="Réceptionniste non trouvé")
    return db_recep

@app.delete("/receptionnistes/{recep_id}")
def delete_receptionniste(recep_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_admin)):
    success = crud.delete_receptionniste(db, recep_id)
    if not success:
        raise HTTPException(status_code=404, detail="Réceptionniste non trouvé")
    return {"detail": "Réceptionniste supprimé"}


# ═══════════════════════════════════════════════════════
#  VÉHICULES
# ═══════════════════════════════════════════════════════
@app.get("/vehicules", response_model=list[schemas.VehiculeResponse])
def read_vehicules(db: Session = Depends(get_db)):
    return crud.get_vehicules(db)

@app.get("/vehicules/{vehicule_id}", response_model=schemas.VehiculeResponse)
def read_vehicule(vehicule_id: int, db: Session = Depends(get_db)):
    db_vehicule = crud.get_vehicule(db, vehicule_id)
    if not db_vehicule:
        raise HTTPException(status_code=404, detail="Véhicule non trouvé")
    return db_vehicule

@app.post("/vehicules", response_model=schemas.VehiculeResponse)
def create_vehicule(vehicule: schemas.VehiculeCreate, db: Session = Depends(get_db)):
    return crud.create_vehicule(db, vehicule)

@app.put("/vehicules/{vehicule_id}", response_model=schemas.VehiculeResponse)
def update_vehicule(vehicule_id: int, vehicule: schemas.VehiculeUpdate, db: Session = Depends(get_db)):
    db_vehicule = crud.update_vehicule(db, vehicule_id, vehicule)
    if not db_vehicule:
        raise HTTPException(status_code=404, detail="Véhicule non trouvé")
    return db_vehicule

@app.delete("/vehicules/{vehicule_id}")
def delete_vehicule(vehicule_id: int, db: Session = Depends(get_db)):
    success = crud.delete_vehicule(db, vehicule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Véhicule non trouvé")
    return {"detail": "Véhicule supprimé"}

@app.get("/vehicules/{vehicule_id}/reparations", response_model=list[schemas.ReparationResponse])
def read_vehicule_reparations(vehicule_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_mecanicien)):
    db_vehicule = crud.get_vehicule(db, vehicule_id)
    if not db_vehicule:
        raise HTTPException(status_code=404, detail="Véhicule non trouvé")
    return crud.get_reparations_by_vehicule(db, vehicule_id)


# ═══════════════════════════════════════════════════════
#  RÉPARATIONS
# ═══════════════════════════════════════════════════════
def _enrich_reparation(db: Session, rep: models.Reparation) -> schemas.ReparationResponse:
    v = rep.vehicule
    client = v.proprietaire if v else None
    return schemas.ReparationResponse(
        id_reparation=rep.id_reparation, id_vehicule=rep.id_vehicule, reference=rep.reference,
        description=rep.description, date_debut=rep.date_debut,
        date_fin=rep.date_fin, kilometrage=rep.kilometrage,
        montant=rep.montant, statut=rep.statut, technicien=rep.technicien,
        notes=rep.notes, created_at=rep.created_at,
        vehicule_immatriculation=v.immatriculation if v else "",
        client_nom_utilisateur=client.nom_utilisateur if client else "",
        client_prenom_utilisateur=client.prenom_utilisateur if client else "",
    )

@app.get("/reparations", response_model=list[schemas.ReparationResponse])
def read_reparations(db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_mecanicien)):
    if current_user.role == "mecanicien":
        nom_complet = f"{current_user.prenom_utilisateur} {current_user.nom_utilisateur}"
        reparations = db.query(models.Reparation).filter(models.Reparation.technicien == nom_complet).order_by(models.Reparation.date_debut.desc()).all()
    else:
        reparations = crud.get_reparations(db)
    return [_enrich_reparation(db, r) for r in reparations]

@app.post("/reparations", response_model=schemas.ReparationResponse)
def create_reparation(reparation: schemas.ReparationCreate, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_mecanicien)):
    if current_user.role == "mecanicien" and not reparation.technicien:
        reparation.technicien = f"{current_user.prenom_utilisateur} {current_user.nom_utilisateur}"
    db_rep = crud.create_reparation(db, reparation)
    return _enrich_reparation(db, db_rep)

@app.put("/reparations/{reparation_id}", response_model=schemas.ReparationResponse)
def update_reparation(reparation_id: int, reparation: schemas.ReparationUpdate, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_mecanicien)):
    db_rep = crud.update_reparation(db, reparation_id, reparation)
    if not db_rep:
        raise HTTPException(status_code=404, detail="Réparation non trouvée")
    return _enrich_reparation(db, db_rep)

@app.delete("/reparations/{reparation_id}")
def delete_reparation(reparation_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_mecanicien)):
    success = crud.delete_reparation(db, reparation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Réparation non trouvée")
    return {"detail": "Réparation supprimée"}


# ═══════════════════════════════════════════════════════
#  INTERVENTIONS
# ═══════════════════════════════════════════════════════
def _enrich_intervention(db: Session, inter: models.Intervention) -> schemas.InterventionResponse:
    v = inter.vehicule
    client = v.proprietaire if v else None
    meca = inter.mecanicien
    return schemas.InterventionResponse(
        id_intervention=inter.id_intervention, description=inter.description,
        date_creation=inter.date_creation, statut=inter.statut,
        id_vehicule=inter.id_vehicule, id_mecanicien=inter.id_mecanicien,
        vehicule_immatriculation=v.immatriculation if v else "",
        vehicule_marque=v.marque if v else "",
        vehicule_modele=v.modele if v else "",
        client_nom_utilisateur=client.nom_utilisateur if client else "",
        client_prenom_utilisateur=client.prenom_utilisateur if client else "",
        client_telephone=client.telephone if client else "",
        mecanicien_nom_utilisateur=meca.nom_utilisateur if meca else "",
        mecanicien_prenom_utilisateur=meca.prenom_utilisateur if meca else "",
        devis=[_enrich_devis(db, d) for d in db.query(models.Devis).filter(models.Devis.id_intervention == inter.id_intervention).all()],
        factures=[_enrich_facture(db, f) for f in db.query(models.Facture).filter(models.Facture.id_intervention == inter.id_intervention).all()],
        created_at=inter.created_at,
    )

@app.get("/interventions", response_model=list[schemas.InterventionResponse])
def read_interventions(db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    if current_user.role == "mecanicien":
        # Le mécanicien ne voit que ses propres interventions
        interventions = db.query(models.Intervention).filter(models.Intervention.id_mecanicien == current_user.id_utilisateur).all()
    else:
        interventions = crud.get_interventions(db)
    return [_enrich_intervention(db, i) for i in interventions]

@app.get("/interventions/{intervention_id}", response_model=schemas.InterventionResponse)
def read_intervention(intervention_id: int, db: Session = Depends(get_db)):
    db_inter = crud.get_intervention(db, intervention_id)
    if not db_inter:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")
    return _enrich_intervention(db, db_inter)

@app.post("/interventions", response_model=schemas.InterventionResponse)
def create_intervention(intervention: schemas.InterventionCreate, db: Session = Depends(get_db)):
    db_vehicule = crud.get_vehicule(db, intervention.id_vehicule)
    if not db_vehicule:
        raise HTTPException(status_code=404, detail="Véhicule non trouvé")
    db_inter = crud.create_intervention(db, intervention)
    return _enrich_intervention(db, db_inter)

@app.put("/interventions/{intervention_id}", response_model=schemas.InterventionResponse)
def update_intervention(intervention_id: int, intervention: schemas.InterventionUpdate, db: Session = Depends(get_db)):
    db_inter = crud.update_intervention(db, intervention_id, intervention)
    if not db_inter:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")
    return _enrich_intervention(db, db_inter)

@app.put("/interventions/{intervention_id}/affecter/{mecanicien_id}", response_model=schemas.InterventionResponse)
def affecter_intervention(intervention_id: int, mecanicien_id: int, db: Session = Depends(get_db)):
    db_inter, error = crud.affecter_mecanicien(db, intervention_id, mecanicien_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return _enrich_intervention(db, db_inter)

@app.put("/interventions/{intervention_id}/affecter-auto", response_model=schemas.InterventionResponse)
def affecter_auto_intervention(intervention_id: int, db: Session = Depends(get_db)):
    db_inter, error = crud.affecter_auto(db, intervention_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return _enrich_intervention(db, db_inter)

@app.post("/interventions/{intervention_id}/cloturer", response_model=schemas.InterventionResponse)
def cloturer_intervention(intervention_id: int, reparation: schemas.ReparationCreate, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_mecanicien)):
    db_inter = crud.get_intervention(db, intervention_id)
    if not db_inter:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")

    db_inter, error = crud.cloturer_intervention(db, intervention_id, reparation)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    # Notifier le réceptionniste
    try:
        enriched = _enrich_intervention(db, db_inter)
        receptionnistes = db.query(models.Utilisateur).filter(
            models.Utilisateur.role == "receptionniste",
            models.Utilisateur.actif == True
        ).all()
        for recap in receptionnistes:
            envoyer_notification_intervention_terminee(
                email_receptionniste=recap.email,
                prenom_receptionniste=recap.prenom_utilisateur,
                vehicule_immatriculation=enriched.vehicule_immatriculation,
                client_nom=f"{enriched.client_prenom_utilisateur} {enriched.client_nom_utilisateur}",
                mecanicien_nom=f"{enriched.mecanicien_prenom_utilisateur} {enriched.mecanicien_nom_utilisateur}",
                description=enriched.description,
            )
    except Exception as e:
        print(f"Erreur notification: {e}")
    
    return enriched

@app.put("/interventions/{intervention_id}/statut")
def changer_statut_intervention(intervention_id: int, statut: str, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_mecanicien)):
    valid_statuts = ["En attente", "En cours", "En pause", "Terminé", "Annulé"]
    if statut not in valid_statuts:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs possibles: {', '.join(valid_statuts)}")
    
    # Sécurité : Si on veut passer à "Terminé", on encourage l'utilisation de /cloturer
    # Mais on laisse la possibilité via statut si nécessaire (ex: correction admin)
    
    update = schemas.InterventionUpdate(statut=statut)
    db_inter = crud.update_intervention(db, intervention_id, update)
    if not db_inter:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")
    
    # Notifier le réceptionniste si intervention terminée
    if statut == "Terminé":
        enriched = _enrich_intervention(db, db_inter)
        receptionnistes = db.query(models.Utilisateur).filter(
            models.Utilisateur.role == "receptionniste",
            models.Utilisateur.actif == True
        ).all()
        for recap in receptionnistes:
            try:
                envoyer_notification_intervention_terminee(
                    email_receptionniste=recap.email,
                    prenom_receptionniste=recap.prenom_utilisateur,
                    vehicule_immatriculation=enriched.vehicule_immatriculation,
                    client_nom=f"{enriched.client_prenom_utilisateur} {enriched.client_nom_utilisateur}",
                    mecanicien_nom=f"{enriched.mecanicien_prenom_utilisateur} {enriched.mecanicien_nom_utilisateur}",
                    description=enriched.description,
                )
            except Exception as e:
                print(f"Erreur notification: {e}")
    
    return _enrich_intervention(db, db_inter)

@app.delete("/interventions/{intervention_id}")
def delete_intervention(intervention_id: int, db: Session = Depends(get_db)):
    success = crud.delete_intervention(db, intervention_id)
    if not success:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")
    return {"detail": "Intervention supprimée"}


# ═══════════════════════════════════════════════════════
#  PIÈCES (Stock)
# ═══════════════════════════════════════════════════════
@app.get("/pieces", response_model=list[schemas.PieceResponse])
def list_pieces(db: Session = Depends(get_db)):
    return crud.get_pieces(db)

@app.post("/pieces", response_model=schemas.PieceResponse)
def create_piece(piece: schemas.PieceCreate, db: Session = Depends(get_db)):
    return crud.create_piece(db, piece)

@app.put("/pieces/{piece_id}", response_model=schemas.PieceResponse)
def update_piece(piece_id: int, piece: schemas.PieceUpdate, db: Session = Depends(get_db)):
    db_piece = crud.update_piece(db, piece_id, piece)
    if not db_piece:
        raise HTTPException(status_code=404, detail="Pièce non trouvée")
    return db_piece

@app.put("/pieces/{piece_id}/prendre", response_model=schemas.PieceResponse)
def prendre_piece(piece_id: int, prise: schemas.PiecePrise, db: Session = Depends(get_db)):
    db_piece, error = crud.prendre_piece(db, piece_id, prise.quantite)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_piece

@app.delete("/pieces/{piece_id}")
def delete_piece(piece_id: int, db: Session = Depends(get_db)):
    success = crud.delete_piece(db, piece_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pièce non trouvée")
    return {"detail": "Pièce supprimée"}


# ═══════════════════════════════════════════════════════
#  DEVIS
# ═══════════════════════════════════════════════════════
def _enrich_devis(db: Session, d: models.Devis) -> schemas.DevisResponse:
    client = db.query(models.Client).filter(models.Client.id_client == d.id_client).first()
    vehicule = db.query(models.Vehicule).filter(models.Vehicule.id_vehicule == d.id_vehicule).first()
    total = sum(l.quantite * l.prix_unitaire for l in d.lignes)
    inter = None
    if d.id_intervention:
        inter = db.query(models.Intervention).filter(models.Intervention.id_intervention == d.id_intervention).first()

    return schemas.DevisResponse(
        id_devis=d.id_devis, reference=d.reference, id_client=d.id_client,
        id_vehicule=d.id_vehicule, statut=d.statut,
        facture_generee=d.facture_generee if d.facture_generee is not None else False,
        date_creation=d.date_creation, date_echeance=d.date_echeance,
        note=d.note or "", lignes=d.lignes, total=total,
        client_nom_utilisateur=client.nom_utilisateur if client else "",
        client_prenom_utilisateur=client.prenom_utilisateur if client else "",
        vehicule_immatriculation=vehicule.immatriculation if vehicule else "",
        vehicule_marque=vehicule.marque if vehicule else "",
        vehicule_modele=vehicule.modele if vehicule else "",
        id_intervention=d.id_intervention,
        intervention_desc=inter.description if inter else "",
        created_at=d.created_at,
    )

@app.get("/devis", response_model=list[schemas.DevisResponse])
def list_devis(db: Session = Depends(get_db)):
    return [_enrich_devis(db, d) for d in crud.get_devis_list(db)]

@app.post("/devis", response_model=schemas.DevisResponse)
def create_devis(devis: schemas.DevisCreate, db: Session = Depends(get_db)):
    if devis.id_intervention:
        existing = db.query(models.Devis).filter(models.Devis.id_intervention == devis.id_intervention).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cette intervention possède déjà un devis (1-to-1)")
    db_devis = crud.create_devis(db, devis)
    return _enrich_devis(db, db_devis)

@app.put("/devis/{devis_id}", response_model=schemas.DevisResponse)
def update_devis(devis_id: int, devis: schemas.DevisUpdate, db: Session = Depends(get_db)):
    if devis.id_intervention:
        existing = db.query(models.Devis).filter(
            models.Devis.id_intervention == devis.id_intervention,
            models.Devis.id_devis != devis_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cette intervention possède déjà un autre devis.")
            
    db_devis = crud.update_devis(db, devis_id, devis)
    if not db_devis:
        raise HTTPException(status_code=404, detail="Devis non trouvé")
    return _enrich_devis(db, db_devis)

@app.put("/devis/{devis_id}/statut")
def changer_statut_devis(devis_id: int, body: dict, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    statut = body.get("statut")
    if not statut:
        raise HTTPException(status_code=400, detail="Le statut est requis")
    db_devis = db.query(models.Devis).filter(models.Devis.id_devis == devis_id).first()
    if not db_devis:
        raise HTTPException(status_code=404, detail="Devis non trouvé")
    db_devis.statut = statut
    db.commit()
    db.refresh(db_devis)
    
    enriched = _enrich_devis(db, db_devis)

    if current_user.role == "client":
        receptionnistes = db.query(models.Utilisateur).filter(
            models.Utilisateur.role == "receptionniste",
            models.Utilisateur.actif == True
        ).all()
        for recap in receptionnistes:
            envoyer_notification_statut_change(
                email_receptionniste=recap.email,
                prenom_receptionniste=recap.prenom_utilisateur,
                type_document="devis",
                reference=enriched.reference,
                nouveau_statut=statut,
                client_nom=f"{enriched.client_prenom_utilisateur} {enriched.client_nom_utilisateur}"
            )

    return enriched

@app.delete("/devis/{devis_id}")
def delete_devis(devis_id: int, db: Session = Depends(get_db)):
    success = crud.delete_devis(db, devis_id)
    if not success:
        raise HTTPException(status_code=404, detail="Devis non trouvé")
    return {"detail": "Devis supprimé"}


@app.post("/devis/{devis_id}/generer-facture", response_model=schemas.FactureResponse)
def generer_facture_depuis_devis(
    devis_id: int,
    body: schemas.GenerateFactureRequest,
    db: Session = Depends(get_db),
    current_user: models.Utilisateur = Depends(auth.get_current_user)
):
    """
    Génère une facture directement à partir d'un devis confirmé.
    Déduit automatiquement le stock pour chaque ligne du devis
    dont la description correspond au nom d'une pièce en stock.
    """
    db_facture, error = crud.generer_facture_depuis_devis(db, devis_id, note=body.note)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return _enrich_facture(db, db_facture)

@app.get("/documents/devis/{devis_id}")
def download_devis_pdf(devis_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    db_devis = db.query(models.Devis).filter(models.Devis.id_devis == devis_id).first()
    if not db_devis:
        raise HTTPException(status_code=404, detail="Devis non trouvé")
    
    # Permission : Admin, Réceptionniste OU le Client concerné
    if current_user.role not in ["admin", "receptionniste"] and db_devis.id_client != current_user.id_utilisateur:
        raise HTTPException(status_code=403, detail="Accès refusé à ce document")

    enriched = _enrich_devis(db, db_devis)
    data = {
        "id": enriched.id_devis,
        "reference": enriched.reference,
        "client_nom": f"{enriched.client_prenom_utilisateur} {enriched.client_nom_utilisateur}",
        "vehicule": f"{enriched.vehicule_marque} {enriched.vehicule_modele} ({enriched.vehicule_immatriculation})",
        "date": enriched.date_creation.strftime("%d/%m/%Y") if enriched.date_creation else "N/A",
        "lignes": [{"description": l.description, "quantite": l.quantite, "prix_unitaire": l.prix_unitaire} for l in db_devis.lignes]
    }
    
    filepath = document_utils.generer_pdf_devis(data)
    return FileResponse(filepath, media_type='application/pdf', filename=f"devis_{db_devis.reference}.pdf")


# ═══════════════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════════════
@app.get("/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    # Interventions en cours
    interventions_en_cours = db.query(models.Intervention).filter(
        models.Intervention.statut == "En cours"
    ).count()

    # Total interventions par statut
    en_attente = db.query(models.Intervention).filter(models.Intervention.statut == "En attente").all()
    en_cours = db.query(models.Intervention).filter(models.Intervention.statut == "En cours").all()
    terminees = db.query(models.Intervention).filter(models.Intervention.statut == "Terminé").all()

    # Enrichir les interventions pour le kanban
    def _mini_intervention(inter):
        vehicule = db.query(models.Vehicule).filter(models.Vehicule.id_vehicule == inter.id_vehicule).first()
        client = None
        if vehicule:
            client = db.query(models.Client).filter(models.Client.id_client == vehicule.id_client).first()
        return {
            "id_intervention": inter.id_intervention,
            "plaque": vehicule.immatriculation if vehicule else "—",
            "client": f"{client.prenom_utilisateur} {client.nom_utilisateur}" if client else "—",
        }

    # 1. Nouveaux clients ce mois-ci (Actifs uniquement)
    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1)
    nb_nouveaux_clients = db.query(models.Client).filter(
        models.Client.created_at >= start_of_month,
        models.Client.actif == True
    ).count()

    # Clients total (Actifs uniquement)
    nb_clients = db.query(models.Client).filter(models.Client.actif == True).count()

    # Alertes stock
    pieces = db.query(models.Piece).all()
    alertes_stock = sum(1 for p in pieces if p.quantite <= p.seuil_alerte)

    # 1. CA PRÉVISIONNEL (Devis confirmés)
    devis_confirmes = db.query(models.Devis).filter(models.Devis.statut == "confirme").all()
    ca_previsionnel = 0.0
    for d in devis_confirmes:
        ca_previsionnel += sum(l.quantite * l.prix_unitaire for l in d.lignes)

    # 2. CA RÉEL (Hébdomadaire / Mensuel / Global)
    ca_global = db.query(func.sum(models.Facture.montant_total)).filter(models.Facture.statut != "Annulée").scalar() or 0.0
    ca_total_encaisse = db.query(func.sum(models.Facture.montant_total)).filter(models.Facture.statut == "Payée").scalar() or 0.0
    
    # CA DU MOIS EN COURS (Toutes les factures de ce mois)
    start_this_month = datetime(now.year, now.month, 1)
    ca_mensuel_total = db.query(func.sum(models.Facture.montant_total)).filter(
        models.Facture.statut != "Annulée",
        models.Facture.date_emission >= start_this_month
    ).scalar() or 0.0
    
    # 3. CA EN ATTENTE (Factures non payées)
    ca_en_attente = db.query(func.sum(models.Facture.montant_total)).filter(models.Facture.statut == "En attente").scalar() or 0.0

    # 4. RÉPARTITION MENSUELLE (De Janvier à Décembre de l'année en cours)
    stats_mensuelles = []
    mois_fr = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
    
    for target_month in range(1, 13):
        target_year = now.year
        
        # Début et fin du mois
        start_date = datetime(target_year, target_month, 1)
        _, last_day = calendar.monthrange(target_year, target_month)
        end_date = datetime(target_year, target_month, last_day, 23, 59, 59)
        
        # On ne calcule que jusqu'au mois actuel, les mois futurs restent à 0
        total_mois = 0.0
        if start_date <= now:
            total_mois = db.query(func.sum(models.Facture.montant_total)).filter(
                models.Facture.statut != "Annulée",
                models.Facture.date_emission >= start_date,
                models.Facture.date_emission <= end_date
            ).scalar() or 0.0
        
        stats_mensuelles.append({
            "mois": mois_fr[target_month-1],
            "total": round(total_mois, 2)
        })

    # Utilisateurs (Staff - Actifs uniquement)
    nb_utilisateurs = db.query(models.Utilisateur).filter(
        models.Utilisateur.role != "client",
        models.Utilisateur.actif == True
    ).count()

    # Stats Devis
    nb_devis_total = db.query(models.Devis).count()
    nb_devis_confirmes = db.query(models.Devis).filter(models.Devis.statut == "confirme").count()
    nb_devis_en_attente = db.query(models.Devis).filter(models.Devis.statut == "en_attente").count()
    nb_devis_rejetes = db.query(models.Devis).filter(models.Devis.statut == "rejete").count()

    return {
        "interventions_en_cours": interventions_en_cours,
        "ca_previsionnel": round(ca_previsionnel, 2),
        "ca_global": round(ca_global, 2),
        "ca_mensuel_total": round(ca_mensuel_total, 2),
        "ca_total_encaisse": round(ca_total_encaisse, 2),
        "ca_en_attente": round(ca_en_attente, 2),
        "stats_mensuelles": stats_mensuelles,
        "nb_clients": nb_clients,
        "nb_nouveaux_clients": nb_nouveaux_clients,
        "nb_utilisateurs": nb_utilisateurs,
        "alertes_stock": alertes_stock,
        "devis": {
            "total": nb_devis_total,
            "confirmes": nb_devis_confirmes,
            "en_attente": nb_devis_en_attente,
            "rejetes": nb_devis_rejetes,
        },
        "kanban": {
            "en_attente": [_mini_intervention(i) for i in en_attente],
            "en_cours": [_mini_intervention(i) for i in en_cours],
            "terminees": [_mini_intervention(i) for i in terminees],
        },
    }


# ═══════════════════════════════════════════════════════
#  FACTURES
# ═══════════════════════════════════════════════════════
def _enrich_facture(db: Session, f: models.Facture) -> schemas.FactureResponse:
    client = db.query(models.Client).filter(models.Client.id_client == f.id_client).first()
    inter = None
    if f.id_intervention:
        inter = db.query(models.Intervention).filter(models.Intervention.id_intervention == f.id_intervention).first()
    dev = None
    if f.id_devis:
        dev = db.query(models.Devis).filter(models.Devis.id_devis == f.id_devis).first()

    return schemas.FactureResponse(
        id_facture=f.id_facture, reference=f.reference, id_client=f.id_client,
        id_intervention=f.id_intervention, id_devis=f.id_devis,
        montant_total=f.montant_total, statut=f.statut,
        date_emission=f.date_emission, date_echeance=f.date_echeance,
        note=f.note,
        client_nom_utilisateur=client.nom_utilisateur if client else "",
        client_prenom_utilisateur=client.prenom_utilisateur if client else "",
        intervention_desc=inter.description if inter else "",
        devis_ref=dev.reference if dev else "",
        vehicule_immatriculation=(inter.vehicule.immatriculation if inter and inter.vehicule else (dev.vehicule.immatriculation if dev and dev.vehicule else "")),
        created_at=f.created_at,
    )

@app.get("/factures", response_model=list[schemas.FactureResponse])
def read_factures(db: Session = Depends(get_db)):
    return [_enrich_facture(db, f) for f in crud.get_factures(db)]

@app.post("/factures", response_model=schemas.FactureResponse)
def create_facture(facture: schemas.FactureCreate, db: Session = Depends(get_db)):
    if facture.id_intervention:
        existing = db.query(models.Facture).filter(models.Facture.id_intervention == facture.id_intervention).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cette intervention possède déjà une facture (1-to-1)")
    db_facture = crud.create_facture(db, facture)
    return _enrich_facture(db, db_facture)

@app.put("/factures/{facture_id}", response_model=schemas.FactureResponse)
def update_facture(facture_id: int, facture: schemas.FactureUpdate, db: Session = Depends(get_db)):
    # Note: On ne permet généralement pas de changer l'intervention d'une facture via Update pour plus de sécurité
    # Mais si id_intervention est présent dans le schéma, on vérifie
    db_facture = crud.update_facture(db, facture_id, facture)
    if not db_facture:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
    return _enrich_facture(db, db_facture)

@app.put("/factures/{facture_id}/statut")
def changer_statut_facture(facture_id: int, body: dict, db: Session = Depends(get_db)):
    statut = body.get("statut")
    if not statut:
        raise HTTPException(status_code=400, detail="Statut requis")
    db_facture = db.query(models.Facture).filter(models.Facture.id_facture == facture_id).first()
    if not db_facture:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
    # Pour s'assurer qu'un petit détail ne soit pas manqué (la confirmation)
    db_facture.statut = statut
    db.commit()
    db.refresh(db_facture)
    return _enrich_facture(db, db_facture)

@app.delete("/factures/{facture_id}")
def delete_facture(facture_id: int, db: Session = Depends(get_db)):
    success = crud.delete_facture(db, facture_id)
    if not success:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
    return {"detail": "Facture supprimée"}

@app.get("/documents/facture/{facture_id}")
def download_facture_pdf(facture_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    db_facture = db.query(models.Facture).filter(models.Facture.id_facture == facture_id).first()
    if not db_facture:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    # Permission : Admin, Réceptionniste OU le Client concerné
    if current_user.role not in ["admin", "receptionniste"] and db_facture.id_client != current_user.id_utilisateur:
        raise HTTPException(status_code=403, detail="Accès refusé à ce document")

    enriched = _enrich_facture(db, db_facture)

    # Récupérer les lignes du devis source (si la facture est issue d'un devis)
    lignes_pdf = []
    if db_facture.id_devis:
        db_devis = db.query(models.Devis).filter(models.Devis.id_devis == db_facture.id_devis).first()
        if db_devis:
            lignes_pdf = [
                {
                    "description": l.description,
                    "quantite": l.quantite,
                    "prix_unitaire": float(l.prix_unitaire),
                }
                for l in db_devis.lignes
            ]

    data = {
        "id": enriched.id_facture,
        "reference": enriched.reference,
        "client_nom": f"{enriched.client_prenom_utilisateur} {enriched.client_nom_utilisateur}",
        "vehicule": enriched.vehicule_immatriculation or "",
        "date": enriched.date_emission.strftime("%d/%m/%Y") if enriched.date_emission else "N/A",
        "devis_ref": enriched.devis_ref or "",
        "statut": enriched.statut,
        "lignes": lignes_pdf,
        "montant": enriched.montant_total,
        "note": enriched.note or "",
    }

    filepath = document_utils.generer_pdf_facture(data)
    return FileResponse(filepath, media_type='application/pdf', filename=f"facture_{db_facture.reference}.pdf")



# ═══════════════════════════════════════════════════════
#  RENDEZ-VOUS
# ═══════════════════════════════════════════════════════
def _enrich_rdv(db: Session, rdv: models.RendezVous) -> schemas.RendezVousResponse:
    client = db.query(models.Client).filter(models.Client.id_client == rdv.id_client).first()
    vehicule = None
    if rdv.id_vehicule:
        vehicule = db.query(models.Vehicule).filter(models.Vehicule.id_vehicule == rdv.id_vehicule).first()
    
    return schemas.RendezVousResponse(
        id_rendezvous=rdv.id_rendezvous, id_client=rdv.id_client, id_vehicule=rdv.id_vehicule,
        date_heure=rdv.date_heure, motif=rdv.motif, statut=rdv.statut,
        notes=rdv.notes,
        client_nom_utilisateur=client.nom_utilisateur if client else "",
        client_prenom_utilisateur=client.prenom_utilisateur if client else "",
        vehicule_immatriculation=vehicule.immatriculation if vehicule else "",
        vehicule_marque=vehicule.marque if vehicule else "",
        created_at=rdv.created_at,
    )

@app.get("/rendezvous", response_model=list[schemas.RendezVousResponse])
def read_rendezvous(db: Session = Depends(get_db)):
    return [_enrich_rdv(db, r) for r in crud.get_rendezvous(db)]

@app.post("/rendezvous", response_model=schemas.RendezVousResponse)
def create_rendezvous(rdv: schemas.RendezVousCreate, db: Session = Depends(get_db)):
    db_rdv = crud.create_rendezvous(db, rdv)
    
    # Notification aux réceptionnistes
    try:
        receptionnistes = crud.get_receptionnistes(db)
        emails = [r.email for r in receptionnistes]
        if emails:
            enriched = _enrich_rdv(db, db_rdv)
            email_utils.envoyer_notification_nouveau_rdv(emails, {
                "client_nom": f"{enriched.client_prenom_utilisateur} {enriched.client_nom_utilisateur}",
                "date_heure": enriched.date_heure.strftime("%d/%m/%Y %H:%M"),
                "motif": enriched.motif
            })
    except Exception as e:
        print(f"Erreur notification réceptionniste: {e}")

    return _enrich_rdv(db, db_rdv)

@app.put("/rendezvous/{rdv_id}/statut")
def changer_statut_rdv(rdv_id: int, body: schemas.RendezVousStatusUpdate, db: Session = Depends(get_db)):
    statut = body.statut
    reponse_admin = body.message
    date_alternative_str = body.date_alternative
    
    db_rdv = db.query(models.RendezVous).filter(models.RendezVous.id_rendezvous == rdv_id).first()
    if not db_rdv:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
    
    ancien_statut = db_rdv.statut
    db_rdv.statut = statut
    if reponse_admin:
        db_rdv.reponse_admin = reponse_admin
    
    date_alternative_dt = None
    if date_alternative_str:
        try:
            from datetime import datetime
            date_alternative_dt = datetime.fromisoformat(date_alternative_str)
            db_rdv.date_alternative = date_alternative_dt
        except:
            pass
        
    db.commit()
    db.refresh(db_rdv)
    
    # Notification au client
    try:
        enriched = _enrich_rdv(db, db_rdv)
        client = db.query(models.Client).filter(models.Client.id_client == db_rdv.id_client).first()
        if client and ancien_statut != statut:
            if statut == "Confirmé":
                email_utils.envoyer_notification_rdv_confirme(
                    client.email, client.prenom_utilisateur,
                    enriched.date_heure.strftime("%d/%m/%Y %H:%M"),
                    enriched.motif
                )
            elif statut == "Rejeté" and reponse_admin:
                alt_str = date_alternative_dt.strftime("%d/%m/%Y %H:%M") if date_alternative_dt else None
                email_utils.envoyer_notification_rdv_rejete(
                    client.email, client.prenom_utilisateur,
                    enriched.date_heure.strftime("%d/%m/%Y %H:%M"),
                    reponse_admin,
                    alt_str
                )
    except Exception as e:
        print(f"Erreur notification client: {e}")
        
    return _enrich_rdv(db, db_rdv)

@app.put("/rendezvous/{rdv_id}/accepter_alternative")
def accepter_alternative_rdv(rdv_id: int, db: Session = Depends(get_db)):
    db_rdv = db.query(models.RendezVous).filter(models.RendezVous.id_rendezvous == rdv_id).first()
    if not db_rdv:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
    
    if not db_rdv.date_alternative:
        raise HTTPException(status_code=400, detail="Aucune date alternative proposée")
        
    db_rdv.date_heure = db_rdv.date_alternative
    db_rdv.statut = "Confirmé"
    db_rdv.reponse_admin = ""
    db_rdv.date_alternative = None
    
    db.commit()
    db.refresh(db_rdv)
    return _enrich_rdv(db, db_rdv)

@app.delete("/rendezvous/{rdv_id}")
def delete_rendezvous(rdv_id: int, db: Session = Depends(get_db)):
    success = crud.delete_rendezvous(db, rdv_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
    return {"detail": "Rendez-vous supprimé"}


# ═══════════════════════════════════════════════════════
#  AVIS (REVIEWS)
# ═══════════════════════════════════════════════════════
def _enrich_avis(db: Session, a: models.Avis) -> schemas.AvisResponse:
    client = db.query(models.Client).filter(models.Client.id_client == a.id_client).first()
    inter = db.query(models.Intervention).filter(models.Intervention.id_intervention == a.id_intervention).first()
    return schemas.AvisResponse(
        id_avis=a.id_avis, id_client=a.id_client, id_intervention=a.id_intervention, note=a.note,
        commentaire=a.commentaire, created_at=a.created_at,
        client_nom_utilisateur=client.nom_utilisateur if client else "",
        client_prenom_utilisateur=client.prenom_utilisateur if client else "",
        intervention_desc=inter.description if inter else "",
    )

@app.get("/avis", response_model=list[schemas.AvisResponse])
def read_avis(db: Session = Depends(get_db)):
    return [_enrich_avis(db, a) for a in crud.get_avis(db)]

@app.get("/avis/client/{client_id}", response_model=list[schemas.AvisResponse])
def read_avis_client(client_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    """Retourne les avis liés à un client donné."""
    if current_user.role == "client" and current_user.id_utilisateur != client_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    avis = db.query(models.Avis).filter(models.Avis.id_client == client_id).order_by(models.Avis.created_at.desc()).all()
    return [_enrich_avis(db, a) for a in avis]

@app.post("/avis", response_model=schemas.AvisResponse)
def create_avis(
    avis: schemas.AvisCreate,
    db: Session = Depends(get_db),
    current_user: models.Utilisateur = Depends(auth.get_current_user)
):
    client_id = current_user.id_utilisateur
    if current_user.role != "client":
        if current_user.role not in ["admin", "receptionniste"]:
            raise HTTPException(status_code=403, detail="Seuls les clients, administrateurs et réceptionnistes peuvent ajouter un avis.")
        if not avis.id_client:
            raise HTTPException(status_code=400, detail="id_client est requis lorsque l'avis est saisi par un administrateur ou réceptionniste.")
        client_id = avis.id_client
        
    return _enrich_avis(db, crud.create_avis(db, avis, client_id))
@app.put("/rendezvous/{rdv_id}", response_model=schemas.RendezVousResponse)
def update_rendezvous(rdv_id: int, rdv: schemas.RendezVousUpdate, db: Session = Depends(get_db)):
    db_rdv = crud.update_rendezvous(db, rdv_id, rdv)
    if not db_rdv:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
    return _enrich_rdv(db, db_rdv)


# ═══════════════════════════════════════════════════════
#  INTERVENTIONS CLIENT (filtrage sécurisé)
# ═══════════════════════════════════════════════════════
@app.get("/interventions/client/{client_id}", response_model=list[schemas.InterventionResponse])
def read_interventions_client(client_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    """Retourne les interventions liées aux véhicules d'un client donné."""
    # Un client ne peut voir que SES interventions
    if current_user.role == "client" and current_user.id_utilisateur != client_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    vehicules = db.query(models.Vehicule).filter(models.Vehicule.id_client == client_id).all()
    vehicule_ids = [v.id_vehicule for v in vehicules]
    if not vehicule_ids:
        return []
    interventions = db.query(models.Intervention).filter(
        models.Intervention.id_vehicule.in_(vehicule_ids)
    ).order_by(models.Intervention.date_creation.desc()).all()
    return [_enrich_intervention(db, i) for i in interventions]


@app.get("/rendezvous/client/{client_id}", response_model=list[schemas.RendezVousResponse])
def read_rendezvous_client(client_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    """Retourne les rendez-vous d'un client spécifique."""
    if current_user.role == "client" and current_user.id_utilisateur != client_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    rdvs = db.query(models.RendezVous).filter(models.RendezVous.id_client == client_id).order_by(models.RendezVous.date_heure.desc()).all()
    return [_enrich_rdv(db, r) for r in rdvs]

@app.get("/devis/client/{client_id}", response_model=list[schemas.DevisResponse])
def read_devis_client(client_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    """Retourne les devis liés à un client donné."""
    if current_user.role == "client" and current_user.id_utilisateur != client_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    devis = db.query(models.Devis).filter(models.Devis.id_client == client_id).order_by(models.Devis.date_creation.desc()).all()
    return [_enrich_devis(db, d) for d in devis]

@app.get("/factures/client/{client_id}", response_model=list[schemas.FactureResponse])
def read_factures_client(client_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    """Retourne les factures liées à un client donné."""
    if current_user.role == "client" and current_user.id_utilisateur != client_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    factures = db.query(models.Facture).filter(models.Facture.id_client == client_id).order_by(models.Facture.date_emission.desc()).all()
    return [_enrich_facture(db, f) for f in factures]

@app.get("/vehicules/client/{client_id}", response_model=list[schemas.VehiculeResponse])
def read_vehicules_client(client_id: int, db: Session = Depends(get_db), current_user: models.Utilisateur = Depends(auth.get_current_user)):
    """Retourne les véhicules d'un client spécifique."""
    if current_user.role == "client" and current_user.id_utilisateur != client_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return crud.get_vehicules_by_client(db, client_id)
