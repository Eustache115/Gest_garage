# Règles de Gestion et Fonctionnalités de l'Application E-Garage

Ce document recense l'ensemble des règles métiers et le résumé détaillé des fonctionnalités présentes dans l'application E-Garage, divisées selon les périmètres des différents acteurs.

## PARTIE 1 : Règles de Gestion (Par Acteur)

### 1. Rôle : Administrateur (Manager / Patron)
**Responsabilité :** Superviseur global et garant de la sécurité et des finances du garage.
- **RG-ADM-01 (Contrôle absolu) :** L'Administrateur possède tous les privilèges (Création, Lecture, Modification, Suppression - CRUD) sur l'intégralité des modules de la base de données.
- **RG-ADM-02 (Gestion du personnel) :** L'Administrateur est le seul acteur habilité à créer, modifier ou révoquer les accès des comptes "Employés" (Mécaniciens et Réceptionnistes).
- **RG-ADM-03 (Indicateurs clés) :** L'Administrateur est le seul à accéder au Dashboard Analytique affichant le Chiffre d'Affaires financier, le flux client et les interventions en cours.
- **RG-ADM-04 (Intégrité des données) :** La suppression d'un utilisateur depuis le panel administrateur ne détruit pas en cascade les factures, devis, ni l'historique liés ; la base est préservée.

### 2. Rôle : Réceptionniste (Accueil / Secrétariat)
**Responsabilité :** Tête de pont de la relation client, de la tarification et de la facturation.
- **RG-REC-01 (Dossiers Clients & Véhicules) :** Le réceptionniste immatricule de nouveaux clients et gère leur parc automobile.
- **RG-REC-02 (Maître de l'Agenda) :** Il gère le planning des rendez-vous. Il approuve, planifie ou propose des alternatives.
- **RG-REC-03 (Responsabilité Commerciale) :** Il édite les "Devis" rattachés à une intervention, quantifie les coûts. 
- **RG-REC-04 (Conversion Financière) :** Ce n'est que lui (ou l'Admin) qui bascule un Devis validé en "Facture" et l'encaisse.
- **RG-REC-05 (Assignation d'Atelier) :** Il crée les dossiers d'"Interventions" et les assigne formellement aux Mécaniciens.

### 3. Rôle : Mécanicien (Agent d'atelier)
**Responsabilité :** Producteur de la main d'œuvre, diagnosticien.
- **RG-MEC-01 (Visibilité restreinte) :** N'a accès qu'à la liste exclusive des interventions qui lui ont été *assignées nominativement*.
- **RG-MEC-02 (Flux de travail Kanban) :** Modifie le statut des véhicules ("En attente" -> "En cours" -> "Terminé").
- **RG-MEC-03 (Journalisation de l'Expertise) :** Enregistre les "Réparations" effectuées avec de façon précise.
- **RG-MEC-04 (Interaction au Stock) :** Spécifie les pièces utilisées, décrémentant automatiquement le stock.
- **RG-MEC-05 (Restriction Commerciale) :** Ne voit aucun chiffre, aucun devis, ni la base clients.

### 4. Rôle : Client (Utilisateur Final)
**Responsabilité :** Propriétaire du véhicule, décisionnaire économique.
- **RG-CLI-01 (Confidentialité stricte) :** L'Espace Client est hermétique, restreint à ses propres véhicules et historiques.
- **RG-CLI-02 (Droit de validation) :** Le client est décisionnaire sur ses devis : il peut accepter ou rejeter numériquement.
- **RG-CLI-03 (Visibilité en temps réel) :** Traductions de la progression de l'atelier sur sa voiture.
- **RG-CLI-04 (Transparence et Export) :** Téléchargement de documents (Devis, Factures) en PDF.

### 5. Règles Globales du Système (Transversales)
- **RG-SYS-01 (Alerte Stock) :** Le système lève une alerte aux Admins quand le seuil critique d'une pièce est atteint.
- **RG-SYS-02 (Résilience Hors-Ligne) :** Fonctionnement sans internet persistant via une file d'attente (IndexedDB) avec resynchronisation réseau transparente.

---

## PARTIE 2 : Résumé des Fonctionnalités par Module

### A. Espace Administration / Réception (Back-Office)
1. **Tableau de Bord Analytique (Dashboard) :**
   - KPI Financiers : Chiffre d'affaires mensuel/annuel.
   - Statistiques générales (nombre de clients, de véhicules, d'interventions en cours).
2. **Gestion des Utilisateurs :**
   - Ajout, modification, et suppression de comptes employés et clients (intégrité préservée).
   - Affectation des rôles par niveau d'habilitation pour sécuriser les accès.
3. **Module Clients & Véhicules :**
   - Annuaire CRM complet pour conserver la base de données des clients du garage.
   - Pluralité des profils : Un client peut avoir plusieurs véhicules (plaque, marque, modèle).
4. **Gestion des Rendez-vous :**
   - Calendrier dynamique des demandes clients.
   - Modification de statuts (Validation, Report, Annulation).
5. **Gestion Opérationnelle des Interventions :**
   - Création de fiches missions, description détaillée de pannes.
   - **Moteur d'Assignation :** Attribution manuelle des tâches à des mécaniciens spécifiques.
6. **Moteur Commercial (Devis & Facturation) :**
   - Édition des montants, taxes et détails des prestations.
   - Processus d'encaissement avec bascule de statut de Devis vers Facture.
   - Export comptable via génération automatique en format PDF.
7. **Gestion de Stock (Pièces) :**
   - Ajout au catalogue des pièces (Prix unitaire, etc).
   - Suivi en temps réel de la quantité disponible et déclencheur intelligent d'Alertes pour prévisions de rupture.

### B. Espace Mécanicien (Atelier)
1. **Dashboard Personnel :**
   - Synthèse de sa charge de travail et des missions assignées.
2. **Tableau de Bord des Interventions (Flux Travail) :**
   - Accès exclusif aux seuls véhicules dont il a la charge.
   - Modification d'état instantanée pour informer la chaîne : *En attente, En cours, Terminé*.
3. **Saisie des Réparations Technique :**
   - Formulaire d'interaction avec le stockage : Saisie des "Réparations" et retrait/consommation simultané(e) des pièces disponibles du stock central.
4. **Historique du Mécanicien :** Archive de pérennité listant toutes ses missions passées terminées.

### C. Espace Client (Front-Office)
1. **Tableau de Bord Client :** Synthèse visuelle de l'état de son/ses véhicule(s).
2. **Espace "Mes Véhicules" & "Rendez-vous" :**
   - Immatriculation déclarative d'un nouveau véhicule à distance par le client lui-même.
   - Formulaire digital interactif pour soumettre une demande de rendez-vous d'entretien selon ses disponibilités.
3. **Espace "Mes Interventions" :** Suivi live des travaux en cours par le garage, le dispensant ainsi de relancer.
4. **Espace Financier Numérique :**
   - **"Mes Devis"** : Panel de validation dématérialisée et unilatérale (le client clique sur "Accepter" ou "Refuser").
   - **"Mes Factures"** : Historique de paiement et conservation/téléchargements automatiques de ses factures (PDF) sur son espace.

### D. Fonctionnalités Transversales Avancées
1. **Mode Hors-Ligne (Offline First) :** Implémentation robuste d'IndexedDB pour emmagasiner en local les données des utilisateurs, des devis et factures. L'application reste ainsi toujours consultable par tous les profils, même sans réseau internet.
2. **Design UI/UX unifié :** Uniformisation professionnelle de l'apparence des interfaces avec codes couleurs consistants et terminologies communes (Ex: Boutons "Valider" bleus, animations de panneaux modales).
3. **Création automatisée de PDF :** Intégration d'un module de dessin digital permettant des exports rapides et normalisés.
4. **Notifications E-mail :** Système de courrier automatisé (côté Backend) informant des étapes clés (ex: Fin d'intervention d'une voiture).
