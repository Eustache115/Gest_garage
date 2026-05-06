
import smtplib
import os
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Chemin vers le logo E-GARAGE
_LOGO_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "logonouveau.png"))

def _attacher_logo(msg: MIMEMultipart):
    """Attache le logo E-GARAGE au message en tant qu'image liée (CID)."""
    try:
        from email.mime.image import MIMEImage
        with open(_LOGO_PATH, "rb") as f:
            img = MIMEImage(f.read())
            img.add_header('Content-ID', '<logo_image>')
            img.add_header('Content-Disposition', 'inline', filename='logo.png')
            msg.attach(img)
    except Exception as e:
        print(f"Erreur d'attachement du logo: {e}")

def _header_email(sous_titre: str = "Votre compte") -> str:
    """Génère l'en-tête HTML commun de tous les emails E-GARAGE."""
    logo_html = '<img src="cid:logo_image" alt="E-GARAGE" style="height:48px; display:block; margin-bottom:8px;">'
    return f"""
    <div style="background: linear-gradient(135deg,#1E3A5F 0%,#2a4f80 100%); color: white;
                padding: 24px 30px; border-radius: 14px 14px 0 0; text-align:center;">
        {logo_html}
        <p style="margin:0; opacity:0.75; font-size:12px; letter-spacing:0.06em; text-transform:uppercase;">{sous_titre}</p>
    </div>"""

def _footer_email() -> str:
    return """
    <p style="text-align:center; font-size:11px; color:#aaa; margin-top:20px; line-height:1.6;">
        Cet email a été envoyé automatiquement.<br>Ne pas répondre à cet email.
    </p>"""


def _get_smtp_config():
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "465")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_email": os.getenv("SMTP_USER", ""),
    }

def _envoyer_email_base(config, destinataires, msg):
    """Fonction centrale pour l'envoi SMTP (gère SSL ou TLS)."""
    if isinstance(destinataires, str):
        destinataires = [destinataires]
        
    try:
        if config["port"] == 465:
            # Mode SSL (recommandé pour éviter les blocages host)
            server = smtplib.SMTP_SSL(config["host"], config["port"], timeout=30)
        else:
            # Mode TLS (STARTTLS)
            server = smtplib.SMTP(config["host"], config["port"], timeout=10)
            server.set_debuglevel(0)
            server.ehlo()
            server.starttls()
            server.ehlo()
            
        with server:
            server.login(config["user"], config["password"])
            for dest in destinataires:
                # On s'assure que le header "To" correspond à la personne envoyée
                # si c'est un envoi groupé simple.
                # Note: .sendmail() prend la liste réelle des destinataires.
                server.sendmail(config["from_email"], dest, msg.as_string())
        return True
    except Exception as e:
        print(f"❌ Erreur SMTP critique ({config['port']}): {e}")
        return False

def envoyer_email_bienvenue(email_destinataire: str, prenom_utilisateur: str, nom_utilisateur: str, token: str):
    """Envoie un email de bienvenue avec le lien pour définir le mot de passe."""
    config = _get_smtp_config()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    lien = f"{frontend_url}/definir-mot-de-passe?token={token}"

    sujet = "Bienvenue sur E-GARAGE — Définissez votre mot de passe"
    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif; max-width:600px; margin:0 auto; padding:30px;">
        {_header_email('Bienvenue !')}
        <div style="background:#f9f9f9; padding:30px; border:1px solid #e0e0e0; border-top:none; border-radius:0 0 14px 14px;">
            <p style="font-size:16px; color:#333;">Bonjour <strong>{prenom_utilisateur} {nom_utilisateur}</strong>,</p>
            <p style="font-size:14px; color:#555; line-height:1.7;">
                Votre compte a été créé sur la plateforme <strong>E-GARAGE</strong>.<br>
                Pour accéder à votre espace, définissez votre mot de passe :
            </p>
            <div style="text-align:center; margin:30px 0;">
                <a href="{lien}" style="background:#1E3A5F; color:white; padding:14px 36px;
                   border-radius:10px; text-decoration:none; font-weight:bold; font-size:15px;
                   display:inline-block;">
                    Définir mon mot de passe
                </a>
            </div>
            <p style="font-size:12px; color:#999;">
                Si le bouton ne fonctionne pas :<br>
                <a href="{lien}" style="color:#1E3A5F;">{lien}</a>
            </p>
        </div>
        {_footer_email()}
    </div>
    """

    msg = MIMEMultipart("related")
    msg["Subject"] = sujet
    msg["From"] = config["from_email"]
    msg["To"] = email_destinataire

    msg_alt = MIMEMultipart("alternative")
    msg.attach(msg_alt)
    msg_alt.attach(MIMEText(html, "html"))

    _attacher_logo(msg)

    if not config["user"] or not config["password"]:
        print(f"\n📧 [CONSOLE] BIENVENUE : {lien}")
        return True

    return _envoyer_email_base(config, email_destinataire, msg)

def envoyer_email_creation_compte(email_destinataire: str, prenom_utilisateur: str, nom_utilisateur: str, mot_de_passe: str):
    """Envoie les identifiants de connexion lors de la création d'un compte."""
    config = _get_smtp_config()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    lien = f"{frontend_url}/login"

    sujet = "Bienvenue sur E-GARAGE — Vos identifiants de connexion"
    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif; max-width:600px; margin:0 auto; padding:30px;">
        {_header_email('Votre compte a été créé')}
        <div style="background:#f9f9f9; padding:30px; border:1px solid #e0e0e0; border-top:none; border-radius:0 0 14px 14px;">
            <p style="font-size:16px; color:#333;">Bonjour <strong>{prenom_utilisateur} {nom_utilisateur}</strong>,</p>
            <p style="font-size:14px; color:#555; line-height:1.7;">
                Un administrateur a créé votre compte sur la plateforme <strong>E-GARAGE</strong>.<br>
                Voici vos identifiants de connexion :
            </p>
            <div style="background:#fff; border:1px solid #e0e0e0; border-left:4px solid #1E3A5F;
                        border-radius:10px; padding:20px; margin:20px 0;">
                <p style="margin:6px 0; font-size:14px;"><strong>Email :</strong> {email_destinataire}</p>
                <p style="margin:6px 0; font-size:14px;">
                    <strong>Mot de passe :</strong>
                    <span style="background:#f0f4f8; padding:4px 12px; border-radius:6px;
                                font-family:monospace; font-size:15px; letter-spacing:2px;">{mot_de_passe}</span>
                </p>
            </div>
            <div style="text-align:center; margin-top:28px;">
                <a href="{lien}" style="background:#1E3A5F; color:white; padding:14px 36px;
                   border-radius:10px; text-decoration:none; font-weight:bold; font-size:15px;
                   display:inline-block;">
                    Se connecter &rarr;
                </a>
            </div>
        </div>
        {_footer_email()}
    </div>
    """

    msg = MIMEMultipart("related")
    msg["Subject"] = sujet
    msg["From"] = config["from_email"]
    msg["To"] = email_destinataire
    msg_alt = MIMEMultipart("alternative")
    msg.attach(msg_alt)
    msg_alt.attach(MIMEText(html, "html"))
    _attacher_logo(msg)

    if not config["user"] or not config["password"]:
        print(f"\n📧 [CONSOLE] CRÉATION COMPTE : {mot_de_passe}")
        return True

    return _envoyer_email_base(config, email_destinataire, msg)

def envoyer_email_reinitialisation(email_destinataire: str, prenom_utilisateur: str, token: str):
    """Envoie un email de réinitialisation de mot de passe."""
    config = _get_smtp_config()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    lien = f"{frontend_url}/definir-mot-de-passe?token={token}"

    sujet = "Réinitialisation de votre mot de passe"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
        {_header_email('Sécurité du compte')}
        <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; color: #333;">Bonjour <strong>{prenom_utilisateur}</strong>,</p>
            <p style="font-size: 14px; color: #555; line-height: 1.6;">
                Cliquez pour choisir un nouveau mot de passe :
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{lien}" style="background: #1E3A5F; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 15px;">
                    Réinitialiser mon mot de passe
                </a>
            </div>
        </div>
        {_footer_email()}
    </div>
    """

    msg = MIMEMultipart("related")
    msg["Subject"] = sujet
    msg["From"] = config["from_email"]
    msg["To"] = email_destinataire
    msg_alt = MIMEMultipart("alternative")
    msg.attach(msg_alt)
    msg_alt.attach(MIMEText(html, "html"))
    _attacher_logo(msg)

    if not config["user"] or not config["password"]:
        print(f"\n📧 [CONSOLE] RESET : {lien}")
        return True

    return _envoyer_email_base(config, email_destinataire, msg)

def envoyer_notification_intervention_terminee(
    email_receptionniste: str,
    prenom_receptionniste: str,
    vehicule_immatriculation: str,
    client_nom: str,
    mecanicien_nom: str,
    description: str,
):
    """Notifie le réceptionniste qu'une intervention est terminée."""
    config = _get_smtp_config()
    sujet = f"✅ Intervention terminée — {vehicule_immatriculation}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
        {_header_email("Notification d'intervention")}
        <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 14px 14px;">
            <p style="font-size: 14px; color: #333 text-align:center;">Bonjour <strong>{prenom_receptionniste}</strong>,</p>
            <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 15px; color: #2e7d32; font-weight: bold;">L'intervention sur {vehicule_immatriculation} est finie.</p>
            </div>
        </div>
        {_footer_email()}
    </div>
    """
    msg = MIMEMultipart("related")
    msg["Subject"] = sujet
    msg["From"] = config["from_email"]
    msg["To"] = email_receptionniste
    msg_alt = MIMEMultipart("alternative")
    msg.attach(msg_alt)
    msg_alt.attach(MIMEText(html, "html"))
    _attacher_logo(msg)

    if not config["user"] or not config["password"]:
        print(f"📧 [CONSOLE] INTERVENTION TERMINEE : {vehicule_immatriculation}")
        return True

    return _envoyer_email_base(config, email_receptionniste, msg)

def envoyer_notification_statut_change(
    email_receptionniste: str,
    prenom_receptionniste: str,
    type_document: str,
    reference: str,
    nouveau_statut: str,
    client_nom: str
):
    """Notifie le réceptionniste qu'un client a modifié le statut d'un document."""
    config = _get_smtp_config()
    sujet = f"📄 Statut modifié : {type_document.capitalize()} {reference}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
        {_header_email("Notification Client")}
        <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 14px 14px;">
            <p style="font-size: 14px; color: #333;">Le client {client_nom} a passé {type_document} {reference} en {nouveau_statut}.</p>
        </div>
        {_footer_email()}
    </div>
    """
    msg = MIMEMultipart("related")
    msg["Subject"] = sujet
    msg["From"] = config["from_email"]
    msg["To"] = email_receptionniste
    msg_alt = MIMEMultipart("alternative")
    msg.attach(msg_alt)
    msg_alt.attach(MIMEText(html, "html"))
    _attacher_logo(msg)

    if not config["user"] or not config["password"]:
        print(f"📧 [CONSOLE] STATUT CHANGE : {reference}")
        return True

    return _envoyer_email_base(config, email_receptionniste, msg)

def envoyer_notification_nouveau_rdv(emails_receptionnistes: list[str], rdv_data: dict):
    """Notifie les réceptionnistes d'une nouvelle demande de rendez-vous."""
    config = _get_smtp_config()
    sujet = f"📅 Nouveau RDV — {rdv_data['client_nom']}"
    html = f"<p>Nouveau RDV le {rdv_data['date_heure']} pour {rdv_data['client_nom']}. Motif: {rdv_data['motif']}</p>"
    
    msg = MIMEMultipart("related")
    msg["Subject"] = sujet
    msg["From"] = config["from_email"]
    msg_alt = MIMEMultipart("alternative")
    msg.attach(msg_alt)
    msg_alt.attach(MIMEText(html, "html"))

    if not config["user"] or not config["password"]:
        print(f"📧 [CONSOLE] NOUVEAU RDV : {rdv_data['client_nom']}")
        return True

    return _envoyer_email_base(config, emails_receptionnistes, msg)

def envoyer_notification_rdv_confirme(email_client: str, prenom_client: str, date_heure: str, motif: str):
    """Informe le client que son rendez-vous est confirmé."""
    config = _get_smtp_config()
    sujet = "✅ Votre rendez-vous est confirmé — E-GARAGE"
    html = f"<p>Bonjour {prenom_client}, votre RDV du {date_heure} est validé.</p>"
    
    msg = MIMEMultipart("related")
    msg["Subject"] = sujet
    msg["From"] = config["from_email"]
    msg["To"] = email_client
    msg_alt = MIMEMultipart("alternative")
    msg.attach(msg_alt)
    msg_alt.attach(MIMEText(html, "html"))

    if not config["user"] or not config["password"]:
        print(f"📧 [CONSOLE] RDV CONFIRMÉ : {date_heure}")
        return True

    return _envoyer_email_base(config, email_client, msg)

def envoyer_notification_rdv_rejete(email_client: str, prenom_client: str, date_initiale: str, proposition: str, date_alternative: str = None):
    """Informe le client que son RDV est rejeté et propose une alternative."""
    config = _get_smtp_config()
    sujet = "📅 À propos de votre rendez-vous — E-GARAGE"
    html = f"<p>Bonjour {prenom_client}, le RDV du {date_initiale} n'est pas possible. Proposition: {proposition}</p>"
    
    msg = MIMEMultipart("related")
    msg["Subject"] = sujet
    msg["From"] = config["from_email"]
    msg["To"] = email_client
    msg_alt = MIMEMultipart("alternative")
    msg.attach(msg_alt)
    msg_alt.attach(MIMEText(html, "html"))

    if not config["user"] or not config["password"]:
        print(f"📧 [CONSOLE] RDV REJETÉ : {date_initiale}")
        return True

    return _envoyer_email_base(config, email_client, msg)
