import React, { useState, useEffect } from "react";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { TrashIcon } from "../../components/icons/AllIcon.jsx";
import GarageDataTable from "../../components/DataTable.jsx";
import { exportCSV, exportPDF } from "../../utils/exportUtils.js";
import api from "../../api.js";
import { toast } from "react-hot-toast";

const STATUT_COLORS = {
    "Confirmé": "bg-blue-100 text-blue-700",
    "En attente": "bg-yellow-100 text-yellow-700",
    "Terminé": "bg-green-100 text-green-700",
    "Rejeté": "bg-red-100 text-red-700",
};

const STATUTS = ["En attente", "Confirmé", "Terminé", "Rejeté"];

const formVide = { id_client: "", id_vehicule: "", date_heure: "", motif: "", notes: "" };

export default function Rendezvous() {
    const [rendezvous, setRendezvous] = useState([]);
    const [clients, setClients] = useState([]);
    const [vehicules, setVehicules] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [formVisible, setFormVisible] = useState(false);
    const [rdvDetail, setRdvDetail] = useState(null);
    const [form, setForm] = useState(formVide);
    const [modalVisible, setModalVisible] = useState(false);
    const [idASupprimer, setIdASupprimer] = useState(null);
    const [rejetModalVisible, setRejetModalVisible] = useState(false);
    const [messageRejet, setMessageRejet] = useState("");
    const [datePropopee, setDateProposee] = useState("");

    const chargerDonnees = async () => {
        try {
            const [resR, resC, resV] = await Promise.all([
                api.get("/rendezvous"),
                api.get("/clients"),
                api.get("/vehicules"),
            ]);
            setRendezvous(resR.data);
            setClients(resC.data);
            setVehicules(resV.data);
        } catch (e) {
            console.error("Erreur chargement données rdv", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { chargerDonnees(); }, []);

    const ouvrirAjout = () => {
        setForm(formVide);
        setFormVisible(true);
        setRdvDetail(null);
    };

    const annuler = () => {
        setFormVisible(false);
        setForm(formVide);
    };

    const enregistrer = async () => {
        if (!form.id_client || !form.date_heure || !form.motif) return;
        const payload = {
            ...form,
            id_client: parseInt(form.id_client),
            id_vehicule: form.id_vehicule ? parseInt(form.id_vehicule) : null,
        };
        try {
            await api.post("/rendezvous", payload);
            await chargerDonnees();
            annuler();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Erreur création RDV");
        }
    };

    const changerStatut = async (id, newStatut, message = "", date_alternative = null) => {
        try {
            const res = await api.put(`/rendezvous/${id}/statut`, { 
                statut: newStatut, 
                message,
                date_alternative 
            });
            await chargerDonnees();
            if (rdvDetail?.id_rendezvous === id) setRdvDetail(res.data);
            if (newStatut === "Confirmé") toast.success("Rendez-vous confirmé !");
            if (newStatut === "Rejeté") toast.success("Rejet enregistré et email envoyé !");
        } catch (e) {
            toast.error("Erreur lors du changement de statut");
        }
    };

    const demanderSuppression = (id) => {
        setIdASupprimer(id);
        setModalVisible(true);
    };

    const confirmerSuppression = async () => {
        try {
            await api.delete(`/rendezvous/${idASupprimer}`);
            await chargerDonnees();
        } catch {}
        if (rdvDetail?.id_rendezvous === idASupprimer) setRdvDetail(null);
        setModalVisible(false);
        setIdASupprimer(null);
    };

    const formatDateTime = (d) => {
        if (!d) return "—";
        return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    };

    const showSidePanel = rdvDetail; // uniquement le detail

    const rdvAujourdhui = rendezvous.filter(r => {
        const d = new Date(r.date_heure);
        const now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const rdvAvenir = rendezvous.filter(r => new Date(r.date_heure) > new Date() && r.statut !== "Rejeté" && r.statut !== "Terminé");
    const rdvEnAttente = rendezvous.filter(r => r.statut === "En attente");

    return (
        <>
            {modalVisible && (
                <ConfirmModal 
                    message="Confirmer la suppression de ce rendez-vous ?" 
                    onConfirm={confirmerSuppression} 
                    onCancel={() => setModalVisible(false)} 
                />
            )}
            {rejetModalVisible && (
                <div className="fixed inset-0 bg-[#1E3A5F]/40 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="bg-[#1E3A5F] p-8 text-white relative">
                            <button onClick={() => { setRejetModalVisible(false); setMessageRejet(""); setDateProposee(""); }} className="absolute top-6 right-8 text-white/50 hover:text-white transition-all text-xl">✕</button>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-lg border border-white/20">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold">Proposer une alternative</h3>
                                    <p className="text-blue-100/60 font-medium">Le créneau initial ne convient pas</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Raison du rejet (Sera envoyé au client)</label>
                                <textarea 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-[1.5rem] p-5 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all min-h-[100px] resize-none font-medium text-gray-700"
                                    placeholder="Ex: Nous sommes complets sur ce créneau..."
                                    value={messageRejet}
                                    onChange={(e) => setMessageRejet(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="bg-[#1E3A5F]/5 rounded-3xl p-6 border border-[#1E3A5F]/10">
                                <label className="block text-[10px] font-bold text-[#1E3A5F] uppercase tracking-widest mb-3">Nouvelle date proposée</label>
                                <div className="relative">
                                    <input 
                                        type="datetime-local" 
                                        className="w-full bg-white border border-[#1E3A5F]/10 rounded-2xl p-4 text-sm font-bold text-[#1E3A5F] outline-none focus:ring-2 focus:ring-[#1E3A5F]/40 transition-all"
                                        value={datePropopee}
                                        onChange={(e) => setDateProposee(e.target.value)}
                                    />
                                </div>
                                <p className="text-[10px] text-[#1E3A5F]/60 mt-3 italic">Le client recevra cette proposition par email pour validation.</p>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button 
                                    onClick={() => { setRejetModalVisible(false); setMessageRejet(""); setDateProposee(""); }}
                                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                                >
                                    Annuler
                                </button>
                                <button 
                                    onClick={() => {
                                        if (!messageRejet.trim()) { toast.error("Veuillez saisir une raison"); return; }
                                        changerStatut(rdvDetail.id_rendezvous, "Rejeté", messageRejet, datePropopee);
                                        setRejetModalVisible(false);
                                        setMessageRejet("");
                                        setDateProposee("");
                                    }}
                                    className="flex-[2] py-4 bg-[#1E3A5F] text-white rounded-2xl font-bold text-sm hover:bg-[#162e4d] shadow-xl shadow-[#1E3A5F]/20 transition-all active:scale-95"
                                >
                                    Envoyer la proposition
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div>
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Gestion des Rendez-vous</h1>
                    <button onClick={ouvrirAjout} className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95">
                        Nouveau Rendez-vous
                    </button>
                </div>
                
                <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <button onClick={() => {
                        exportPDF([
                            { label: "Date", accessor: row => formatDateTime(row.date_heure) },
                            { label: "Client", accessor: row => `${row.client_prenom_utilisateur} ${row.client_nom_utilisateur}` },
                            { label: "Motif", accessor: "motif" },
                        ], rendezvous.filter(r => r.statut !== "Rejeté"), "Liste_RendezVous");
                    }} className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-white border rounded-xl shadow-sm text-gray-700 text-sm hover:bg-gray-50">
                        Télécharger PDF
                    </button>
                </div>

                <div className={`flex flex-col ${showSidePanel ? "lg:grid lg:grid-cols-3 lg:items-start" : ""} gap-4 sm:gap-6`}>
                    
                    {/* TABLEAU */}
                    {!formVisible && (
                    <div className={`${showSidePanel ? "lg:col-span-2" : ""} bg-white rounded-2xl shadow overflow-hidden`}>
                        <GarageDataTable
                            loading={loading}
                            columns={[
                                { name: "Date & Heure", selector: row => row.date_heure, sortable: true, cell: row => <span className="text-sm font-semibold text-gray-800">{formatDateTime(row.date_heure)}</span>, width: "160px" },
                                { name: "Client", selector: row => `${row.client_nom_utilisateur} ${row.client_prenom_utilisateur}`, sortable: true, grow: 1.5, cell: row => <span className="text-sm text-gray-800">{row.client_prenom_utilisateur} {row.client_nom_utilisateur}</span> },
                                { name: "Véhicule", selector: row => row.vehicule_immatriculation, cell: row => row.vehicule_immatriculation ? <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-medium">{row.vehicule_immatriculation}</span> : "—" },
                                { name: "Motif", selector: row => row.motif, sortable: true, cell: row => <span className="text-sm text-gray-600 truncate">{row.motif}</span> },
                                { name: "Statut", selector: row => row.statut, sortable: true, cell: row => <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${STATUT_COLORS[row.statut] || "bg-gray-100 text-gray-600"}`}>{row.statut}</span> },
                                { name: "Actions", button: true, width: "100px", cell: row => (
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <button 
                                            onClick={() => { setRdvDetail(row); setFormVisible(false); }}
                                            className="bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#162e4d] transition-all shadow-sm"
                                        >
                                            Gérer
                                        </button>
                                    </div>
                                ), ignoreRowClick: true },
                            ]}
                            data={rendezvous}
                            onRowClicked={r => { setRdvDetail(r); setFormVisible(false); }}
                            conditionalRowStyles={[
                                { when: row => rdvDetail?.id_rendezvous === row.id_rendezvous, style: { backgroundColor: "#eff6ff" } },
                                { when: row => row.statut === "En attente", style: { backgroundColor: "#fffbeb" } }
                            ]}
                            noDataMessage="Aucun rendez-vous"
                        />
                    </div>
                    )}

                    {/* DÉTAIL */}
                    {rdvDetail && !formVisible && (
                        <div className="bg-white rounded-2xl shadow p-5 lg:col-span-1 border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">Détail du Rendez-vous</h2>
                                    <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-medium ${STATUT_COLORS[rdvDetail.statut] || ""}`}>
                                        {rdvDetail.statut}
                                    </span>
                                </div>
                                <button onClick={() => setRdvDetail(null)} className="text-gray-400 hover:text-gray-600">X</button>
                            </div>

                            <div className="bg-blue-50/50 rounded-xl p-4 mb-4 text-center border border-blue-100">
                                <p className="text-sm font-semibold text-blue-800 tracking-wider uppercase mb-1">Date Prévue</p>
                                <p className="text-2xl font-bold text-blue-900">{formatDateTime(rdvDetail.date_heure)}</p>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                <p className="text-sm font-semibold text-gray-700 mb-1">Informations Client</p>
                                <p className="text-sm text-gray-600">{rdvDetail.client_prenom_utilisateur} {rdvDetail.client_nom_utilisateur}</p>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                <p className="text-sm font-semibold text-gray-700 mb-1">Véhicule et Motif</p>
                                {rdvDetail.vehicule_immatriculation ? (
                                    <p className="text-sm text-gray-600 mb-2">{rdvDetail.vehicule_immatriculation} - {rdvDetail.vehicule_marque}</p>
                                ) : (
                                    <p className="text-sm text-gray-400 mb-2 italic">Aucun véhicule lié</p>
                                )}
                                <p className="text-sm font-medium text-gray-800 border-l-2 border-gray-300 pl-2">{rdvDetail.motif}</p>
                            </div>

                            {rdvDetail.notes && (
                                <div className="bg-yellow-50 rounded-xl p-4 mb-4">
                                    <p className="text-xs font-bold text-yellow-800 uppercase tracking-widest mb-1 opacity-60">Notes</p>
                                    <p className="text-xs text-yellow-900 italic">"{rdvDetail.notes}"</p>
                                </div>
                            )}

                            {rdvDetail.reponse_admin && (
                                <div className="bg-[#1E3A5F]/5 rounded-xl p-4 mb-4 border border-[#1E3A5F]/10">
                                    <p className="text-xs font-bold text-[#1E3A5F] uppercase tracking-widest mb-1">Dernière réponse</p>
                                    <p className="text-xs text-[#1E3A5F]/80">{rdvDetail.reponse_admin}</p>
                                    {rdvDetail.date_alternative && (
                                        <p className="text-[10px] text-[#1E3A5F] mt-1 font-bold italic">Alternative proposée : {new Date(rdvDetail.date_alternative).toLocaleString()}</p>
                                    )}
                                </div>
                            )}

                            {/* Statut buttons */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Changer le statut</p>
                                
                                {rdvDetail.statut === "En attente" ? (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => changerStatut(rdvDetail.id_rendezvous, "Confirmé")}
                                            className="flex-1 px-3 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                        >
                                            Valider
                                        </button>
                                        <button 
                                            onClick={() => setRejetModalVisible(true)}
                                            className="flex-1 px-3 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                                        >
                                            Rejeter
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {STATUTS.filter(s => s !== rdvDetail.statut).map(s => (
                                            <button key={s} onClick={() => changerStatut(rdvDetail.id_rendezvous, s)} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${STATUT_COLORS[s]} hover:opacity-80`}>
                                                → "{s}"
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* FORMULAIRE */}
                    {formVisible && (
                        <div className="bg-white rounded-2xl shadow p-6 lg:p-8 w-full max-w-4xl mx-auto border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800 mb-6">Nouveau Rendez-vous</h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Date et Heure *</label>
                                    <input type="datetime-local" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 font-semibold" value={form.date_heure} onChange={e => setForm({...form, date_heure: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Client *</label>
                                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.id_client} onChange={e => setForm({...form, id_client: e.target.value})}>
                                        <option value="">-- Sélectionner --</option>
                                        {clients.map(c => <option key={c.id_client} value={c.id_client}>{c.prenom_utilisateur} {c.nom_utilisateur}</option>)}
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Véhicule concerné</label>
                                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.id_vehicule} onChange={e => setForm({...form, id_vehicule: e.target.value})}>
                                        <option value="">-- Aucun --</option>
                                        {vehicules.filter(v => form.id_client ? v.id_client === parseInt(form.id_client) : true).map(v => (
                                            <option key={v.id_vehicule} value={v.id_vehicule}>{v.immatriculation} - {v.marque}</option>
                                        ))}
                                    </select>
                                </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Motif du RDV *</label>
                                    <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Ex: Vidange, Contrôle technique, etc." value={form.motif} onChange={e => setForm({...form, motif: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Notes supplémentaires</label>
                                    <textarea rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Informations utiles..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                                </div>
                                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t">
                                    <button onClick={annuler} className="px-5 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95">Annuler</button>
                                    <button onClick={enregistrer} disabled={!form.id_client || !form.date_heure || !form.motif} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50">Valider</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* KPI */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
                    <div className="bg-amber-50 p-5 rounded-2xl shadow-sm border border-amber-100 animate-pulse">
                        <p className="text-sm font-medium text-amber-800">En attente</p>
                        <p className="text-2xl font-bold text-amber-600 mt-1">{rdvEnAttente.length} Demandes</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500">Aujourd'hui</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{rdvAujourdhui.length} RDV</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500">À venir</p>
                        <p className="text-2xl font-bold text-gray-800 mt-1">{rdvAvenir.length} RDV</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500">Total terminés</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{rendezvous.filter(r => r.statut === "Terminé").length}</p>
                    </div>
                </div>
            </div>
        </>
    );
}
