import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAuth } from "../../AuthContext.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import GarageDataTable from "../../components/DataTable.jsx";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import { PencilIcon, CalendarIcon, TrashIcon, PlusIcon } from "../../components/icons/AllIcon.jsx";
import { exportCSV, exportPDF } from "../../utils/exportUtils.js";
import api from "../../api.js";

const ETATS = [
    { label: "Bon état général", couleur: "bg-green-100 text-green-700" },
    { label: "Quelques rayures", couleur: "bg-yellow-100 text-yellow-700" },
    { label: "Carrosserie endommagée", couleur: "bg-orange-100 text-orange-700" },
    { label: "En panne", couleur: "bg-red-100 text-red-700" },
    { label: "Accidenté", couleur: "bg-red-200 text-red-800" },
];

const STATUT_COLORS = {
    "Terminé": "bg-green-100 text-green-700",
    "En cours": "bg-yellow-100 text-yellow-700",
    "En attente pièces": "bg-orange-100 text-orange-700",
};



const formVide = { numero_chassis: "", immatriculation: "", marque: "", modele: "", annee: "", etat: "", description: "", id_client: "" };

export default function GestionVehicules() {
    const { user } = useAuth();
    const isMecanicien = user?.role === "mecanicien";
    const location = useLocation();
    const [vehicules, setVehicules] = useState([]);
    const [clients, setClients] = useState([]);
    const [formVisible, setFormVisible] = useState(false);
    const [modeEdition, setModeEdition] = useState(false);
    const [vehiculeSelectionne, setVehiculeSelectionne] = useState(null);
    const [form, setForm] = useState(formVide);
    const [modalVisible, setModalVisible] = useState(false);
    const [idASupprimer, setIdASupprimer] = useState(null);
    const [loading, setLoading] = useState(true);

    // Historique réparations
    const [vehiculeDetail, setVehiculeDetail] = useState(null);
    const [reparations, setReparations] = useState([]);
    const [loadingReparations, setLoadingReparations] = useState(false);

    // Ajout réparation manuelle
    const [isAjoutantReparation, setIsAjoutantReparation] = useState(false);
    const [nouvelleReparation, setNouvelleReparation] = useState({ reference: "", description: "", kilometrage: "", notes: "" });

    // Filtres historique
    const [repSearch, setRepSearch] = useState("");
    const [repDateStart, setRepDateStart] = useState("");
    const [repDateEnd, setRepDateEnd] = useState("");

    const chargerVehicules = async () => {
        try {
            const [resV, resC] = await Promise.all([
                api.get("/vehicules"),
                api.get("/clients"),
            ]);
            setVehicules(resV.data);
            setClients(resC.data);
        } catch {
            setVehicules([]);
            setClients([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { chargerVehicules(); }, []);

    // Ouvrir un véhicule s'il est passé dans le state (depuis la barre de recherche)
    useEffect(() => {
        if (vehicules.length > 0 && location.state?.selectedId) {
            const v = vehicules.find(veh => veh.id_vehicule === location.state.selectedId);
            if (v) voirReparations(v);
            window.history.replaceState({}, document.title);
        }
    }, [vehicules, location.state]);

    // Voir l'historique de réparations d'un véhicule
    const voirReparations = async (vehicule) => {
        if (!isMecanicien) {
            toast.error("Seuls les mécaniciens peuvent consulter l'historique des réparations.");
            return;
        }
        if (vehiculeDetail?.id_vehicule === vehicule.id_vehicule) {
            setVehiculeDetail(null);
            setReparations([]);
            return;
        }
        setVehiculeDetail(vehicule);
        setLoadingReparations(true);
        setFormVisible(false);
        setRepSearch(""); // Reset filtres
        setRepDateStart("");
        setRepDateEnd("");
        try {
            const res = await api.get(`/vehicules/${vehicule.id_vehicule}/reparations`);
            setReparations(res.data);
        } catch {
            setReparations([]);
        } finally {
            setLoadingReparations(false);
        }
    };

    const handleAjouterReparation = async () => {
        try {
            const payload = {
                ...nouvelleReparation,
                id_vehicule: vehiculeDetail.id_vehicule,
                technicien: `${user.prenom_utilisateur} ${user.nom_utilisateur}`,
                date_debut: new Date().toISOString(),
                statut: "Terminé"
            };
            await api.post("/reparations", payload);
            setIsAjoutantReparation(false);
            setNouvelleReparation({ reference: "", description: "", kilometrage: "", notes: "" });
            toast.success("Réparation ajoutée avec succès");

            // Recharger l'historique
            const res = await api.get(`/vehicules/${vehiculeDetail.id_vehicule}/reparations`);
            setReparations(res.data);
        } catch (e) {
            console.error("Erreur ajout réparation", e);
            toast.error("Erreur lors de l'ajout de la réparation");
        }
    };

    // Filtrage local de l'historique
    const reparationsFiltrees = reparations.filter(rep => {
        const matchSearch = !repSearch ||
            rep.reference.toLowerCase().includes(repSearch.toLowerCase()) ||
            rep.description.toLowerCase().includes(repSearch.toLowerCase()) ||
            rep.technicien?.toLowerCase().includes(repSearch.toLowerCase()) ||
            rep.notes?.toLowerCase().includes(repSearch.toLowerCase());

        const dateRep = rep.date_debut ? new Date(rep.date_debut).getTime() : null;
        const matchStart = !repDateStart || (dateRep && dateRep >= new Date(repDateStart).getTime());
        const matchEnd = !repDateEnd || (dateRep && dateRep <= new Date(repDateEnd).getTime() + 86400000); // +1 jour pour inclure la date de fin

        return matchSearch && matchStart && matchEnd;
    });

    const ouvrirAjout = () => { setForm(formVide); setModeEdition(false); setVehiculeSelectionne(null); setFormVisible(true); setVehiculeDetail(null); };

    const ouvrirEdition = (v) => {
        setForm({
            numero_chassis: v.numero_chassis, immatriculation: v.immatriculation,
            marque: v.marque, modele: v.modele, annee: v.annee ? v.annee.toString().slice(0, 4) : "",
            etat: v.etat || "", description: v.description || "", id_client: v.id_client || "",
        });
        setModeEdition(true); setVehiculeSelectionne(v.id_vehicule); setFormVisible(true); setVehiculeDetail(null);
    };

    const annuler = () => { setFormVisible(false); setForm(formVide); setModeEdition(false); setVehiculeSelectionne(null); };

    const enregistrer = async () => {
        if (!form.id_client) { toast.error("Veuillez sélectionner un client propriétaire"); return; }
        const payload = { ...form, id_client: parseInt(form.id_client) };
        try {
            let res;
            if (modeEdition) {
                res = await api.put(`/vehicules/${vehiculeSelectionne}`, payload);
            } else {
                res = await api.post("/vehicules", payload);
            }

            // Gestion Optimiste Hors-Ligne : si la requête a été mise en file d'attente
            if (res && res._local_queued) {
                if (modeEdition) {
                    setVehicules(prev => prev.map(v => v.id_vehicule === vehiculeSelectionne ? { ...v, ...payload } : v));
                } else {
                    setVehicules(prev => [...prev, { ...payload, id_vehicule: "⏳ En attente..." }]);
                }
            } else {
                // Fonctionnement normal en ligne
                await chargerVehicules();
            }
            
            annuler();

        } catch (error) {
            console.error("Erreur lors de l'enregistrement du véhicule:", error);
            const msg = error.response?.data?.detail || "Une erreur est survenue lors de l'enregistrement.";
            toast.error(`Erreur: ${msg}`);
        }
    };

    const demanderSuppression = (id) => { setIdASupprimer(id); setModalVisible(true); };

    const confirmerSuppression = async () => {
        try {
            await api.delete(`/vehicules/${idASupprimer}`);
            await chargerVehicules();
            if (vehiculeDetail?.id_vehicule === idASupprimer) { setVehiculeDetail(null); setReparations([]); }
        } catch (error) {
            console.error("Erreur lors de la suppression du véhicule:", error);
            const msg = error.response?.data?.detail || "Une erreur est survenue lors de la suppression.";
            toast.error(`Erreur: ${msg}`);
        }
        setModalVisible(false); setIdASupprimer(null);
    };

    const annulerSuppression = () => { setModalVisible(false); setIdASupprimer(null); };

    // Stats dynamiques
    const enPanne = vehicules.filter(v => v.etat === "En panne" || v.etat === "Accidenté").length;
    const bonEtat = vehicules.filter(v => v.etat === "Bon état général").length;
    const showSidePanel = vehiculeDetail; // uniquement le panneau de détail réduit le tableau

    const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <>
            {modalVisible && (
                <ConfirmModal
                    message="Êtes-vous sûr de vouloir supprimer ce véhicule ? Cette action est irréversible."
                    onConfirm={confirmerSuppression}
                    onCancel={annulerSuppression}
                />
            )}
            <div>
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Gestion des Véhicules</h1>
                    {!isMecanicien && (
                        <button onClick={ouvrirAjout} className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95">
                            Ajouter un Véhicule
                        </button>
                    )}
                </div>

                {/* Boutons */}
                <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <button onClick={() => {
                        const cols = [
                            { label: "N° Châssis", accessor: "numero_chassis" },
                            { label: "Immatriculation", accessor: "immatriculation" },
                            { label: "Marque", accessor: "marque" },
                            { label: "Modèle", accessor: "modele" },
                            { label: "Année", accessor: "annee" },
                            { label: "Client", accessor: row => { const cli = clients.find(c => c.id_client === row.id_client); return cli ? `${cli.prenom_utilisateur} ${cli.nom_utilisateur}` : ""; } },
                            { label: "État", accessor: "etat" },
                            { label: "Description", accessor: "description" },
                        ];
                        exportPDF(cols, vehicules, "Liste des Véhicules");
                    }} className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-white border rounded-xl shadow-sm text-gray-700 text-sm hover:bg-gray-50">
                        Télécharger la Liste
                    </button>
                    <button onClick={() => {
                        const cols = [
                            { label: "N° Châssis", accessor: "numero_chassis" },
                            { label: "Immatriculation", accessor: "immatriculation" },
                            { label: "Marque", accessor: "marque" },
                            { label: "Modèle", accessor: "modele" },
                            { label: "Année", accessor: "annee" },
                            { label: "Client", accessor: row => { const cli = clients.find(c => c.id_client === row.id_client); return cli ? `${cli.prenom_utilisateur} ${cli.nom_utilisateur}` : ""; } },
                            { label: "État", accessor: "etat" },
                            { label: "Description", accessor: "description" },
                        ];
                        exportCSV(cols, vehicules, "vehicules");
                    }} className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-white border rounded-xl shadow-sm text-gray-700 text-sm hover:bg-gray-50">
                        Exporter CSV
                    </button>
                </div>

                {/* Grille tableau + panel latéral */}
                <div className={`flex flex-col ${showSidePanel ? "lg:grid lg:grid-cols-3 lg:items-start" : ""} gap-4 sm:gap-6`}>

                    {/* ===== TABLEAU ===== */}
                    {!formVisible && (
                    <div className={`${showSidePanel ? "lg:col-span-2" : ""} bg-white rounded-2xl shadow overflow-x-auto`}>
                        <GarageDataTable
                            loading={loading}
                            columns={[
                                { name: "N° Châssis", selector: row => row.numero_chassis, sortable: true, cell: row => <span className="font-mono text-xs text-gray-700">{row.numero_chassis}</span>, width: "160px" },
                                { name: "Immatriculation", selector: row => row.immatriculation, sortable: true, cell: row => <span className="font-medium text-gray-800">{row.immatriculation}</span> },
                                { name: "Marque", selector: row => row.marque, sortable: true },
                                { name: "Modèle", selector: row => row.modele, sortable: true },
                                { name: "Année", selector: row => row.annee, sortable: true, width: "90px" },
                                { name: "Client", selector: row => { const cli = clients.find(c => c.id_client === row.id_client); return cli ? `${cli.prenom_utilisateur} ${cli.nom_utilisateur}` : ""; }, sortable: true, cell: row => { const cli = clients.find(c => c.id_client === row.id_client); return cli ? <span>{cli.prenom_utilisateur} {cli.nom_utilisateur}</span> : <span className="text-xs text-orange-500 italic">Non lié</span>; } },
                                { name: "État", selector: row => row.etat || "", sortable: true, cell: row => row.etat ? <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${ETATS.find(e => e.label === row.etat)?.couleur || "bg-gray-100 text-gray-600"}`}>{row.etat}</span> : "—" },
                                ...(!isMecanicien ? [{
                                    name: "Actions", right: true, cell: row => (
                                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => ouvrirEdition(row)} title="Modifier" className="flex items-center justify-center w-7 h-7 bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-lg transition-all"><PencilIcon /></button>
                                            <button onClick={() => demanderSuppression(row.id_vehicule)} title="Supprimer" className="flex items-center justify-center w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"><TrashIcon /></button>
                                        </div>
                                    ), ignoreRowClick: true, width: "100px"
                                }] : []),
                            ]}
                            data={vehicules}
                            onRowClicked={isMecanicien ? voirReparations : null}
                            conditionalRowStyles={[{ when: row => isMecanicien && vehiculeDetail?.id_vehicule === row.id_vehicule, style: { backgroundColor: "#eff6ff", boxShadow: "inset 0 0 0 1px #bfdbfe" } }]}
                            noDataMessage="Aucun véhicule enregistré"
                        />
                    </div>
                    )}

                    {/* ===== PANEL HISTORIQUE RÉPARATIONS ===== */}
                    {vehiculeDetail && !formVisible && (
                        <div className="bg-white rounded-2xl shadow p-4 sm:p-5 lg:col-span-1 max-h-[80vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-semibold text-gray-800">
                                    Historique réparations
                                </h2>
                                <button onClick={() => { setVehiculeDetail(null); setReparations([]); }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                            </div>

                            {/* Info véhicule */}
                            <div className="bg-gray-50 rounded-xl p-3 mb-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold">{vehiculeDetail.immatriculation}</div>
                                    {vehiculeDetail.etat && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ETATS.find(e => e.label === vehiculeDetail.etat)?.couleur || "bg-gray-100 text-gray-600"}`}>
                                            {vehiculeDetail.etat}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600">{vehiculeDetail.marque} {vehiculeDetail.modele} · {vehiculeDetail.annee}</p>
                                <p className="font-mono text-xs text-gray-400 mt-1">{vehiculeDetail.numero_chassis}</p>
                            </div>

                            {/* Actions Historique */}
                            {!loadingReparations && (
                                <button
                                    onClick={() => setIsAjoutantReparation(!isAjoutantReparation)}
                                    className={`w-full mb-4 py-2.5 px-4 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center justify-center gap-2 ${isAjoutantReparation ? "bg-red-50 text-red-600 border-red-200 shadow-red-200/20" : "bg-orange-500 text-white border-orange-500 shadow-orange-500/20 hover:bg-orange-600"}`}
                                >
                                    {isAjoutantReparation ? "Annuler l'ajout" : "Ajouter une réparation"}
                                </button>
                            )}

                            {/* Formulaire d'ajout rapide (dans le volet) */}
                            {isAjoutantReparation && (
                                <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200 shadow-inner space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nouveaux travaux</h4>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Kilométrage</label>
                                        <input
                                            type="number"
                                            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="ex: 125000"
                                            value={nouvelleReparation.kilometrage}
                                            onChange={e => setNouvelleReparation({ ...nouvelleReparation, kilometrage: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Description technique</label>
                                        <textarea
                                            rows={3}
                                            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                            placeholder="Qu'est-ce qui a été fait ?"
                                            value={nouvelleReparation.description}
                                            onChange={e => setNouvelleReparation({ ...nouvelleReparation, description: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Notes / Observations</label>
                                        <textarea
                                            rows={2}
                                            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                            placeholder="Pièces, conseils..."
                                            value={nouvelleReparation.notes}
                                            onChange={e => setNouvelleReparation({ ...nouvelleReparation, notes: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        onClick={handleAjouterReparation}
                                        disabled={!nouvelleReparation.description}
                                        className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-95"
                                    >
                                        Enregistrer dans l'historique
                                    </button>
                                </div>
                            )}

                            {/* Filtres Historique */}
                            {!loadingReparations && reparations.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Rechercher (mécanicien, description...)"
                                        className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={repSearch}
                                        onChange={e => setRepSearch(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1 text-[10px] text-gray-400 uppercase font-bold">
                                            Du
                                            <input type="date" className="w-full border rounded-lg px-2 py-1 text-xs mt-0.5" value={repDateStart} onChange={e => setRepDateStart(e.target.value)} />
                                        </div>
                                        <div className="flex-1 text-[10px] text-gray-400 uppercase font-bold">
                                            Au
                                            <input type="date" className="w-full border rounded-lg px-2 py-1 text-xs mt-0.5" value={repDateEnd} onChange={e => setRepDateEnd(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {loadingReparations ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                                </div>
                            ) : reparations.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <p className="text-sm">Aucune réparation enregistrée</p>
                                </div>
                            ) : reparationsFiltrees.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <p className="text-sm italic">Aucun résultat pour ces filtres</p>
                                    <button onClick={() => { setRepSearch(""); setRepDateStart(""); setRepDateEnd(""); }} className="text-blue-500 text-xs mt-2 font-bold uppercase underline">Effacer les filtres</button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {reparationsFiltrees.map((rep) => (
                                        <div key={rep.id_reparation} className="border rounded-xl p-3 hover:bg-gray-50 transition-all">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <p className="font-medium text-gray-800 text-sm">{rep.reference}</p>
                                                    <p className="text-xs text-gray-500">{rep.description}</p>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ml-2 ${STATUT_COLORS[rep.statut] || "bg-gray-100 text-gray-600"}`}>
                                                    {rep.statut}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 mt-2">
                                                <p>Début : {formatDate(rep.date_debut)}</p>
                                                <p>Fin : {formatDate(rep.date_fin)}</p>
                                                {rep.kilometrage && <p>{rep.kilometrage.toLocaleString()} km</p>}
                                                <p className="font-semibold text-gray-700">{rep.montant > 0 ? `${rep.montant.toLocaleString('fr-FR')} FCFA` : "Devis en cours"}</p>
                                            </div>
                                            {rep.technicien && <p className="text-xs text-gray-400 mt-1">{rep.technicien}</p>}
                                            {rep.notes && <p className="text-xs text-gray-400 mt-1 italic">{rep.notes}</p>}
                                        </div>
                                    ))}

                                    {/* Résumé */}
                                    <div className="border-t pt-3 mt-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Total réparations :</span>
                                            <span className="font-semibold text-gray-800">{reparations.length}</span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-1">
                                            <span className="text-gray-500">Montant total :</span>
                                            <span className="font-semibold text-green-700">{reparations.reduce((s, r) => s + r.montant, 0).toLocaleString('fr-FR')} FCFA</span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-1">
                                            <span className="text-gray-500">En cours :</span>
                                            <span className="font-semibold text-yellow-600">{reparations.filter(r => r.statut !== "Terminé").length}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== FORMULAIRE ===== */}
                    {formVisible && (
                        <div className="bg-white rounded-2xl shadow p-6 lg:p-8 w-full max-w-4xl mx-auto">
                            <h2 className="font-semibold text-gray-800 mb-4 text-xl">
                                {modeEdition ? "Modifier le Véhicule" : "Ajouter un Véhicule"}
                            </h2>
                            <div className="flex flex-col gap-4 mt-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FieldGroup label="N° Châssis (VIN)">
                                        <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder="Numero chassis du vehicule" value={form.numero_chassis} onChange={e => setForm({ ...form, numero_chassis: e.target.value })} />
                                    </FieldGroup>
                                    <FieldGroup label="Immatriculation">
                                        <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Immatriculation" value={form.immatriculation} onChange={e => setForm({ ...form, immatriculation: e.target.value })} />
                                    </FieldGroup>
                                    <FieldGroup label="Marque">
                                        <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Marque du vehicule" value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} />
                                    </FieldGroup>
                                    <FieldGroup label="Modèle">
                                        <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Modele du vehicule" value={form.modele} onChange={e => setForm({ ...form, modele: e.target.value })} />
                                    </FieldGroup>
                                    <FieldGroup label="Année de mise en circulation">
                                        <input type="number" min="1900" max="2099" className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder="ex: 2024" value={form.annee} onChange={e => setForm({ ...form, annee: e.target.value })} />
                                    </FieldGroup>
                                    <FieldGroup label="État à l'arrivée">
                                    <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={form.etat} onChange={e => setForm({ ...form, etat: e.target.value })}>
                                        <option value="">-- Sélectionner l'état --</option>
                                        {ETATS.map(e => <option key={e.label} value={e.label}>{e.label}</option>)}
                                    </select>
                                </FieldGroup>
                                <div className="sm:col-span-2">
                                    <FieldGroup label="Client propriétaire">
                                        <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={form.id_client} onChange={e => setForm({ ...form, id_client: e.target.value })}>
                                            <option value="">-- Sélectionner un client --</option>
                                            {clients.map(c => <option key={c.id_client} value={c.id_client}>{c.prenom_utilisateur} {c.nom_utilisateur}</option>)}
                                        </select>
                                    </FieldGroup>
                                </div>
                                <div className="sm:col-span-2">
                                    <FieldGroup label="Description / Observations">
                                        <textarea rows={3} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Ex : Choc avant droit, bruit moteur..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                                    </FieldGroup>
                                </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t">
                                    <button onClick={annuler} className="px-5 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95">Annuler</button>
                                    <button onClick={enregistrer} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md shadow-green-500/20 transition-all active:scale-95">
                                        Valider
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
                    <div className="bg-white rounded-2xl shadow p-4">
                        <p className="text-sm text-gray-500">Total véhicules enregistrés</p>
                        <p className="text-xl font-semibold text-gray-800">{vehicules.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-4">
                        <p className="text-sm text-gray-500">En bon état</p>
                        <p className="text-xl font-semibold text-green-600">{bonEtat}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-4">
                        <p className="text-sm text-gray-500">En panne / Accidenté</p>
                        <p className="text-xl font-semibold text-red-600">{enPanne}</p>
                    </div>
                </div>
            </div>
        </>
    );
}

function FieldGroup({ label, children }) {
    return (
        <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
