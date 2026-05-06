import React, { useState, useEffect } from "react";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAuth } from "../../AuthContext.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { PencilIcon, TrashIcon } from "../../components/icons/AllIcon.jsx";
import GarageDataTable from "../../components/DataTable.jsx";
import api from "../../api.js";

const STATUT_COLORS = {
    "En attente": "bg-gray-100 text-gray-600",
    "En cours": "bg-yellow-100 text-yellow-700",
    "En pause": "bg-orange-100 text-orange-700",
    "Terminé": "bg-green-100 text-green-700",
    "Annulé": "bg-red-100 text-red-700",
};

const STATUTS = ["En attente", "En cours", "En pause", "Terminé", "Annulé"];

const formVide = { description: "", id_vehicule: "", id_mecanicien: "" };

export default function Interventions() {
    const { user } = useAuth();
    const isMecanicien = user?.role === "mecanicien";
    const location = useLocation();
    const navigate = useNavigate();
    const [interventions, setInterventions] = useState([]);
    const [vehicules, setVehicules] = useState([]);
    const [clients, setClients] = useState([]);
    const [mecaniciens, setMecaniciens] = useState([]);
    const [avisList, setAvisList] = useState([]);
    const [filteredVehicules, setFilteredVehicules] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [idASupprimer, setIdASupprimer] = useState(null);

    // Formulaire création / édition
    const [formVisible, setFormVisible] = useState(false);
    const [modeEdition, setModeEdition] = useState(false);
    const [interventionSelectionnee, setInterventionSelectionnee] = useState(null);
    const [form, setForm] = useState(formVide);

    // Détail intervention
    const [interventionDetail, setInterventionDetail] = useState(null);
    const [tempStatut, setTempStatut] = useState(null);
    const [reparationForm, setReparationForm] = useState({ reference: "", description: "", kilometrage: "", notes: "" });

    const chargerDonnees = async () => {
        try {
            const [resInter, resMeca, resClients, resVehicules, resAvis] = await Promise.all([
                api.get("/interventions"),
                api.get("/mecaniciens"),
                api.get("/clients"),
                api.get("/vehicules"),
                api.get("/avis"),
            ]);
            setInterventions(resInter.data);
            setMecaniciens(resMeca.data);
            setClients(resClients.data);
            setVehicules(resVehicules.data);
            setAvisList(resAvis.data);
        } catch {
            setInterventions([]);
            setVehicules([]);
            setMecaniciens([]);
            setClients([]);
            setAvisList([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        chargerDonnees();
        const interval = setInterval(chargerDonnees, 30000);
        return () => clearInterval(interval);
    }, []);

    // Ouvrir automatiquement une intervention si demandée via le state (ex: depuis le dashboard)
    useEffect(() => {
        if (interventions.length > 0 && location.state?.openId) {
            const doc = interventions.find(i => i.id_intervention === location.state.openId);
            if (doc) {
                setInterventionDetail(doc);
                setFormVisible(false);
            }
            // Nettoyer le state pour éviter de réouvrir à chaque refresh
            window.history.replaceState({}, document.title);
        }
    }, [interventions, location.state]);

    // Ouvrir automatiquement le formulaire si ?action=new
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get("action") === "new") {
            ouvrirAjout();
            navigate("/interventions", { replace: true });
        }
    }, [location.search]);

    // ─── Créer / Modifier une intervention ──────────
    // Filtrage des véhicules par client sélectionné
    useEffect(() => {
        if (selectedClientId) {
            setFilteredVehicules(vehicules.filter(v => v.id_client === parseInt(selectedClientId)));
        } else {
            setFilteredVehicules(vehicules);
        }
    }, [selectedClientId, vehicules]);

    const ouvrirAjout = () => {
        setForm(formVide);
        setSelectedClientId("");
        setModeEdition(false);
        setInterventionSelectionnee(null);
        setFormVisible(true);
        setInterventionDetail(null);
    };

    const ouvrirEdition = (inter) => {
        setForm({
            description: inter.description || "",
            id_vehicule: String(inter.id_vehicule || ""),
            id_mecanicien: inter.id_mecanicien ? String(inter.id_mecanicien) : "",
        });
        setSelectedClientId(String(inter.id_client || ""));
        setModeEdition(true);
        setInterventionSelectionnee(inter.id_intervention);
        setFormVisible(true);
        setInterventionDetail(null);
    };

    const annuler = () => {
        setFormVisible(false);
        setForm(formVide);
        setModeEdition(false);
        setInterventionSelectionnee(null);
        setSelectedClientId("");
    };

    const enregistrer = async () => {
        if (!form.description || !form.id_vehicule) return;

        if (modeEdition) {
            // Modifier une intervention existante
            const payload = {
                description: form.description,
                statut: undefined,  // pas de changement de statut via ce formulaire
            };
            // Si on change le mécanicien dans le formulaire
            if (form.id_mecanicien) {
                payload.id_mecanicien = parseInt(form.id_mecanicien);
            }
            try {
                await api.put(`/interventions/${interventionSelectionnee}`, payload);
                await chargerDonnees();
            } catch (e) {
                console.error("Erreur modification intervention", e);
            }
        } else {
            // Créer une nouvelle intervention
            const payload = {
                description: form.description,
                id_vehicule: parseInt(form.id_vehicule),
                id_mecanicien: form.id_mecanicien ? parseInt(form.id_mecanicien) : null,
            };
            try {
                await api.post("/interventions", payload);
                await chargerDonnees();
            } catch (e) {
                console.error("Erreur création intervention", e);
            }
        }
        annuler();
    };

    // ─── Affecter automatiquement ───────────────────
    const affecterAuto = async (interventionId) => {
        try {
            const res = await api.put(`/interventions/${interventionId}/affecter-auto`);
            await chargerDonnees();
            // Mettre à jour le détail si c'est l'intervention sélectionnée
            if (interventionDetail?.id_intervention === interventionId) {
                setInterventionDetail(res.data);
            }
        } catch (e) {
            toast.error(e.response?.data?.detail || "Aucun mécanicien disponible");
        }
    };

    // ─── Affecter manuellement ──────────────────────
    const affecterManuel = async (interventionId, mecaId) => {
        try {
            const res = await api.put(`/interventions/${interventionId}/affecter/${mecaId}`);
            await chargerDonnees();
            if (interventionDetail?.id_intervention === interventionId) {
                setInterventionDetail(res.data);
            }
        } catch (e) {
            toast.error(e.response?.data?.detail || "Erreur d'affectation");
        }
    };

    // ─── Changer le statut ──────────────────────────
    const changerStatut = async (id, newStatut) => {
        try {
            await api.put(`/interventions/${id}/statut?statut=${encodeURIComponent(newStatut)}`);
            await chargerDonnees();
            // Redirection vers le tableau (ferme le détail)
            setInterventionDetail(null);
            setTempStatut(null);
        } catch (e) {
            console.error("Erreur changement statut", e);
        }
    };

    // ─── Clôturer et valider l'historique ──────────
    const handleCloturer = async (overrideForm = null) => {
        if (!interventionDetail) return;
        // Correction : si overrideForm est un événement React (ex: clique sur Confirmer), on l'ignore
        const isEvent = overrideForm && (overrideForm.preventDefault || overrideForm.nativeEvent);
        const data = (overrideForm && !isEvent) ? overrideForm : reparationForm;
        try {
            const payload = {
                ...data,
                description: data.description || interventionDetail.description,
                kilometrage: data.kilometrage ? parseInt(data.kilometrage) : null,
                technicien: "Garage",
                id_vehicule: interventionDetail.id_vehicule,
                statut: "Terminé"
            };
            const res = await api.post(`/interventions/${interventionDetail.id_intervention}/cloturer`, payload);
            await chargerDonnees();
            // Redirection vers le tableau (ferme le détail)
            setInterventionDetail(null);
            setTempStatut(null);
            setReparationForm({ reference: "", description: "", kilometrage: "", notes: "" });
        } catch (e) {
            toast.error(e.response?.data?.detail || "Erreur lors de la clôture");
        }
    };

    // ─── Voir détail ────────────────────────────────
    const voirDetail = (inter) => {
        if (interventionDetail?.id_intervention === inter.id_intervention) {
            setInterventionDetail(null);
            setTempStatut(null);
            return;
        }
        setInterventionDetail(inter);
        setTempStatut(inter.statut);
        setFormVisible(false);
    };

    // ─── Suppression ────────────────────────────────
    const demanderSuppression = (id) => { setIdASupprimer(id); setModalVisible(true); };
    const confirmerSuppression = async () => {
        try {
            await api.delete(`/interventions/${idASupprimer}`);
            await chargerDonnees();
        } catch { }
        if (interventionDetail?.id_intervention === idASupprimer) setInterventionDetail(null);
        setModalVisible(false); setIdASupprimer(null);
    };

    const formatDate = (d) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const enAttente = interventions.filter(i => i.statut === "En attente").length;
    const enCours = interventions.filter(i => i.statut === "En cours").length;
    const terminees = interventions.filter(i => i.statut === "Terminé").length;
    const showSidePanel = interventionDetail; // uniquement le détail

    return (
        <>
            {modalVisible && (
                <ConfirmModal
                    message="Êtes-vous sûr de vouloir supprimer cette intervention ? Cette action est irréversible."
                    onConfirm={confirmerSuppression}
                    onCancel={() => { setModalVisible(false); setIdASupprimer(null); }}
                />
            )}
            <div>
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Gestion des Interventions</h1>
                    {!isMecanicien && (
                        <button onClick={ouvrirAjout} className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95">
                            Nouvelle Intervention
                        </button>
                    )}
                </div>
                {/* Boutons */}
                <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <button 
                        onClick={chargerDonnees}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border rounded-xl shadow-sm text-gray-700 text-sm hover:bg-gray-50 transition-all font-medium"
                    >
                        Rafraîchir les données
                    </button>
                </div>

                {/* Grille */}
                <div className={`flex flex-col ${showSidePanel ? "lg:grid lg:grid-cols-3 lg:items-start" : ""} gap-4 sm:gap-6`}>

                    {/* ===== TABLEAU ===== */}
                    {!formVisible && (
                    <div className={`${showSidePanel ? "lg:col-span-2" : ""} bg-white rounded-2xl shadow overflow-hidden`}>
                        <GarageDataTable
                            loading={loading}
                            columns={[
                                { name: "N°", selector: row => row.id_intervention, sortable: true, width: "60px", cell: row => <span className="font-mono text-xs text-gray-400">{row.id_intervention}</span> },
                                { name: "Description", selector: row => row.description || "", sortable: true, cell: row => <span className="text-gray-800 truncate" title={row.description || ""}>{row.description || "Sans description"}</span>, grow: 2 },
                                { name: "Véhicule", selector: row => row.vehicule_immatriculation || "", sortable: true, cell: row => (<div><span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">{row.vehicule_immatriculation || "—"}</span><span className="text-xs text-gray-400 ml-1">{row.vehicule_marque || ""}</span></div>) },
                                { name: "Client", selector: row => `${row.client_nom_utilisateur || ""} ${row.client_prenom_utilisateur || ""}`, sortable: true, cell: row => <span className="text-sm text-gray-600">{(row.client_nom_utilisateur || row.client_prenom_utilisateur) ? `${row.client_nom_utilisateur || ""} ${row.client_prenom_utilisateur || ""}` : "—"}</span> },
                                { name: "Mécanicien", selector: row => row.mecanicien_nom_utilisateur || "", sortable: true, cell: row => row.mecanicien_nom_utilisateur ? (
                                    <span className="text-sm text-gray-700">{row.mecanicien_prenom_utilisateur || ""} {row.mecanicien_nom_utilisateur}</span>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-orange-500 italic">Non affecté</span>
                                        {!isMecanicien && (
                                            <button onClick={(e) => { e.stopPropagation(); voirDetail(row); }} className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded hover:bg-orange-200 transition-colors">
                                                Modifier
                                            </button>
                                        )}
                                    </div>
                                ) },
                                { name: "Date", selector: row => row.date_creation || "", sortable: true, cell: row => <span className="text-xs text-gray-500">{formatDate(row.date_creation)}</span>, width: "100px" },
                                { name: "Statut", selector: row => row.statut || "", sortable: true, cell: row => <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_COLORS[row.statut] || "bg-gray-100 text-gray-600"}`}>{row.statut || "Inconnu"}</span>, width: "120px" },
                                // On n'affiche pas les actions rapides de suppression pour le mécanicien
                                ...(!isMecanicien ? [{
                                    name: "Actions", right: true, cell: row => (
                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => ouvrirEdition(row)} title="Modifier" className="flex items-center justify-center w-7 h-7 bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-lg transition-all"><PencilIcon /></button>
                                            <button onClick={() => demanderSuppression(row.id_intervention)} title="Supprimer" className="flex items-center justify-center w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"><TrashIcon /></button>
                                        </div>
                                    ), ignoreRowClick: true, width: "80px"
                                }] : []),
                            ]}
                            data={interventions}
                            onRowClicked={voirDetail}
                            conditionalRowStyles={[{ when: row => interventionDetail?.id_intervention === row.id_intervention, style: { backgroundColor: "#eff6ff", boxShadow: "inset 0 0 0 1px #bfdbfe" } }]}
                            noDataMessage="Aucune intervention enregistrée"
                        />
                    </div>
                    )}

                    {/* ===== PANEL DÉTAIL ===== */}
                    {interventionDetail && !formVisible && (
                        <div className="bg-white rounded-2xl shadow p-4 sm:p-5 lg:col-span-1 max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-semibold text-gray-800">Intervention N°{interventionDetail.id_intervention}</h2>
                                <button onClick={() => setInterventionDetail(null)} className="text-gray-400 hover:text-gray-600 text-lg">X</button>
                            </div>

                            {/* Statut */}
                            <div className="mb-4">
                                <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUT_COLORS[interventionDetail.statut] || ""}`}>
                                    {interventionDetail.statut}
                                </span>
                            </div>

                            {/* Description */}
                            <div className="bg-gray-50 rounded-xl p-3 mb-3">
                                <p className="text-xs font-medium text-gray-400 mb-1">Description du problème</p>
                                <p className="text-sm text-gray-700">{interventionDetail.description}</p>
                            </div>

                            {/* Véhicule */}
                            <div className="bg-blue-50 rounded-xl p-3 mb-3">
                                <p className="text-xs font-medium text-blue-400 mb-1">Véhicule</p>
                                <p className="font-semibold text-gray-800">{interventionDetail.vehicule_immatriculation}</p>
                                <p className="text-sm text-gray-600">{interventionDetail.vehicule_marque} {interventionDetail.vehicule_modele}</p>
                            </div>

                            {/* Client */}
                            <div className="bg-green-50 rounded-xl p-3 mb-3">
                                <p className="text-xs font-medium text-green-400 mb-1">Client</p>
                                <p className="font-semibold text-gray-800">{interventionDetail.client_nom_utilisateur} {interventionDetail.client_prenom_utilisateur}</p>
                                {interventionDetail.client_telephone && (
                                    <p className="text-sm text-gray-600">{interventionDetail.client_telephone}</p>
                                )}
                            </div>

                            {/* Mécanicien */}
                            <div className="bg-orange-50 rounded-xl p-3 mb-3">
                                <p className="text-xs font-medium text-orange-400 mb-1">Mécanicien</p>
                                {interventionDetail.mecanicien_nom_utilisateur || interventionDetail.id_mecanicien ? (
                                    <p className="font-semibold text-gray-800">{interventionDetail.mecanicien_prenom_utilisateur || ""} {interventionDetail.mecanicien_nom_utilisateur || "Affecté"}</p>
                                ) : (
                                    <p className="text-sm text-orange-600 italic">Non affecté</p>
                                )}
                            </div>

                            <p className="text-xs text-gray-400 mb-4">Créé le {formatDate(interventionDetail.date_creation)}</p>

                            {/* Avis du client */}
                            {interventionDetail.statut === "Terminé" && (() => {
                                const avis = avisList.find(a => a.id_intervention === interventionDetail.id_intervention);
                                if (!avis) return null;
                                return (
                                    <div className="bg-yellow-50 rounded-xl p-3 mb-4 border border-yellow-100">
                                        <p className="text-xs font-bold text-yellow-600 mb-1 flex items-center gap-1">
                                            <span>⭐ Avis du client</span>
                                        </p>
                                        <div className="flex items-center gap-1 mb-1">
                                            {Array.from({ length: 5 }).map((_, idx) => (
                                                <span key={idx} className={`text-base ${idx < avis.note ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                                            ))}
                                            <span className="text-xs font-bold text-yellow-700 ml-2">{avis.note}/5</span>
                                        </div>
                                        {avis.commentaire && (
                                            <p className="text-sm text-gray-700 italic">"{avis.commentaire}"</p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* ─── ACTIONS ─── */}
                            <div className="space-y-4 border-t pt-3">
                                {/* Affecter (Priorité UX) */}
                                {!isMecanicien && interventionDetail.statut !== "Terminé" && interventionDetail.statut !== "Annulé" && (
                                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                        <label className="text-xs font-bold text-blue-600 mb-2 block uppercase tracking-wider">Affectation Mécanicien</label>
                                        
                                        <div className="mb-2">
                                            <select
                                                className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
                                                value=""
                                                onChange={(e) => {
                                                    if (e.target.value) affecterManuel(interventionDetail.id_intervention, parseInt(e.target.value));
                                                }}
                                            >
                                                <option value="">-- Choisir un mécanicien --</option>
                                                {mecaniciens.map(m => (
                                                    <option key={m.id_utilisateur} value={m.id_utilisateur}>
                                                        {m.prenom_utilisateur} {m.nom_utilisateur} ({m.specialite}) — {m.interventions_en_cours} en cours
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            onClick={() => affecterAuto(interventionDetail.id_intervention)}
                                            className="w-full px-4 py-3 bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                        >
                                            Affectation Auto (Recommandée)
                                        </button>
                                    </div>
                                )}

                                {/* DOCUMENTATION FINANCIÈRE LIÉE (1-to-1) */}
                                <div className="space-y-3 pt-3 border-t">
                                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Documents associés</h3>
                                    
                                    {/* Devis */}
                                    <div className="flex flex-col gap-2">
                                        <div className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                            <span>Devis :</span>
                                        </div>
                                        {interventionDetail.devis && interventionDetail.devis.length > 0 ? (
                                            <div className="bg-white border rounded-xl p-3 flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="text-xs font-bold text-blue-600">{interventionDetail.devis[0].reference}</p>
                                                    <p className="text-[10px] text-gray-400 capitalize">{interventionDetail.devis[0].statut}</p>
                                                </div>
                                                <p className="text-xs font-bold text-gray-800">{(interventionDetail.devis[0].total || 0).toLocaleString()} FCFA</p>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => navigate(`/devis?new_inter=${interventionDetail.id_intervention}`)} 
                                                className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-[10px] font-bold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all"
                                            >
                                                + Créer un devis
                                            </button>
                                        )}
                                    </div>

                                    {/* Facture */}
                                    <div className="flex flex-col gap-2">
                                        <div className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                            <span>Facture :</span>
                                        </div>
                                        {interventionDetail.factures && interventionDetail.factures.length > 0 ? (
                                            <div className="bg-white border rounded-xl p-3 flex justify-between items-center shadow-sm border-l-4 border-l-green-500">
                                                <div>
                                                    <p className="text-xs font-bold text-green-600">{interventionDetail.factures[0].reference}</p>
                                                    <p className="text-[10px] text-gray-400">{interventionDetail.factures[0].statut}</p>
                                                </div>
                                                <p className="text-xs font-bold text-gray-800">{(interventionDetail.factures[0].montant_total || 0).toLocaleString()} FCFA</p>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => navigate(`/facturation?new_inter=${interventionDetail.id_intervention}`)}
                                                className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-[10px] font-bold text-gray-400 hover:border-green-300 hover:text-green-500 transition-all"
                                                disabled={!interventionDetail.devis || interventionDetail.devis.length === 0}
                                                title={(!interventionDetail.devis || interventionDetail.devis.length === 0) ? "Créez d'abord un devis" : ""}
                                            >
                                                + Émettre une facture
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Modifier l'intervention */}
                                {!isMecanicien && (
                                    <button
                                        onClick={() => ouvrirEdition(interventionDetail)}
                                        className="w-full px-4 py-2 bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        Modifier les détails
                                    </button>
                                )}

                                {/* Statuts (Uniquement pour le mécanicien) */}
                                {isMecanicien && (
                                    <div className="mt-4 border-t pt-4">
                                        <label className="text-xs font-bold text-gray-400 mb-3 block uppercase tracking-wider">État d'avancement :</label>
                                        
                                        {/* Picker de Statut */}
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {STATUTS.map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => { setTempStatut(s); }}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${tempStatut === s ? `${STATUT_COLORS[s]} border-current ring-2 ring-offset-1 ring-current` : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Actions de Validation */}
                                        {tempStatut && (
                                            <div className="mt-2">
                                                <button
                                                    onClick={() => {
                                                        if (tempStatut === "Terminé") {
                                                            handleCloturer({ description: interventionDetail.description });
                                                        } else {
                                                            changerStatut(interventionDetail.id_intervention, tempStatut);
                                                        }
                                                    }}
                                                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-sm flex items-center justify-center gap-1 border ${tempStatut === interventionDetail.statut ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-[#1E3A5F] text-white border-[#162e4d] hover:bg-[#162e4d] active:scale-95"}`}
                                                    disabled={tempStatut === interventionDetail.statut}
                                                >
                                                    Valider le changement
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ===== FORMULAIRE CRÉATION / ÉDITION ===== */}
                    {formVisible && (
                        <div className="bg-white rounded-2xl shadow p-6 lg:p-8 w-full max-w-4xl mx-auto max-h-[85vh] overflow-y-auto">
                            <h2 className="font-semibold text-gray-800 mb-6 text-xl">
                                {modeEdition ? "Modifier l'Intervention" : "Nouvelle Intervention"}
                            </h2>
                            <div className="flex flex-col gap-4">
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Description du problème *</label>
                                    <textarea
                                        rows={3}
                                        className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        placeholder="Ex: Bruit moteur, vidange..."
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Client</label>
                                    <select
                                        className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                        value={selectedClientId}
                                        onChange={e => setSelectedClientId(e.target.value)}
                                    >
                                        <option value="">-- Tous les clients --</option>
                                        {clients.map(c => (
                                            <option key={c.id_client} value={c.id_client}>{c.prenom_utilisateur} {c.nom_utilisateur}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Véhicule concerné *</label>
                                    <select
                                        className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                        value={form.id_vehicule}
                                        onChange={e => setForm({ ...form, id_vehicule: e.target.value })}
                                    >
                                        <option value="">-- Sélectionner un véhicule --</option>
                                        {filteredVehicules.map(v => (
                                            <option key={v.id_vehicule} value={v.id_vehicule}>
                                                {v.immatriculation} ({v.marque} {v.modele})
                                            </option>
                                        ))}
                                    </select>
                                    {modeEdition && <p className="text-xs text-gray-400 mt-1">Le véhicule ne peut pas être changé après création</p>}
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Client sélectionné automatiquement</label>
                                    <input
                                        type="text"
                                        readOnly
                                        className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none text-gray-700 cursor-default"
                                        placeholder="— Aucun véhicule sélectionné —"
                                        value={(() => {
                                            if (!form.id_vehicule || !vehicules.length) return "";
                                            const vId = parseInt(form.id_vehicule);
                                            const veh = vehicules.find(v => v.id_vehicule === vId);
                                            if (!veh) return "";
                                            const cli = clients.find(c => c.id_client === veh.id_client);
                                            return cli ? `${cli.prenom_utilisateur || ""} ${cli.nom_utilisateur || ""}` : "Client inconnu";
                                        })()}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Mécanicien (optionnel)</label>
                                    <select
                                        className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        value={form.id_mecanicien}
                                        onChange={e => setForm({ ...form, id_mecanicien: e.target.value })}
                                    >
                                        <option value="">-- Affecter plus tard --</option>
                                        {mecaniciens.map(m => (
                                            <option key={m.id_utilisateur} value={m.id_utilisateur}>
                                                {m.prenom_utilisateur} {m.nom_utilisateur} ({m.specialite}) — {m.interventions_en_cours} en cours {!m.disponible ? "(Indisponible)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t">
                                    <button onClick={annuler} className="px-5 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95">
                                        Annuler
                                    </button>
                                    <button
                                        onClick={enregistrer}
                                        disabled={!form.description || !form.id_vehicule}
                                        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        Valider
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 sm:mt-6">
                    <div className="bg-white rounded-2xl shadow p-4">
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="text-xl font-semibold text-gray-800">{interventions.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-4">
                        <p className="text-sm text-gray-500">En attente</p>
                        <p className="text-xl font-semibold text-orange-600">{enAttente}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-4">
                        <p className="text-sm text-gray-500">En cours</p>
                        <p className="text-xl font-semibold text-yellow-600">{enCours}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-4">
                        <p className="text-sm text-gray-500">Terminées</p>
                        <p className="text-xl font-semibold text-green-600">{terminees}</p>
                    </div>
                </div>
            </div>
        </>
    );
}
