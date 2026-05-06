import React, { useState, useEffect } from "react";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import { TrashIcon, PencilIcon } from "../../components/icons/AllIcon.jsx";
import GarageDataTable from "../../components/DataTable.jsx";
import { exportPDF, downloadDocumentPDF } from "../../utils/exportUtils.js";
import api from "../../api.js";
import { toast } from "react-hot-toast";

const STATUT_COLORS = {
    "En attente": "bg-orange-100 text-orange-700",
    "Payée": "bg-green-100 text-green-700",
    "Annulée": "bg-red-100 text-red-700",
};
const STATUTS = ["En attente", "Payée", "Annulée"];

export default function Facturation() {
    const [factures, setFactures] = useState([]);
    const [devisList, setDevisList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [factureDetail, setFactureDetail] = useState(null);
    const [devisDetail, setDevisDetail] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [idASupprimer, setIdASupprimer] = useState(null);
    const [filtreStatut, setFiltreStatut] = useState("tous");

    // Formulaire édition (modification de note / échéance uniquement)
    const [editVisible, setEditVisible] = useState(false);
    const [editForm, setEditForm] = useState({ note: "", date_echeance: "" });
    const [editId, setEditId] = useState(null);

    const chargerDonnees = async () => {
        try {
            const [resF, resD] = await Promise.all([
                api.get("/factures"),
                api.get("/devis"),
            ]);
            setFactures(resF.data);
            setDevisList(resD.data);
        } catch (e) {
            console.error("Erreur chargement données facturation", e);
            toast.error("Erreur de chargement des données");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { chargerDonnees(); }, []);

    const selectionnerFacture = async (f) => {
        setFactureDetail(f);
        setEditVisible(false);
        if (f.id_devis) {
            try {
                // Appel direct pour avoir les lignes complètes avec id_piece
                const res = await api.get(`/devis/${f.id_devis}`);
                setDevisDetail(res.data);
            } catch (e) {
                console.error("Impossible de charger le devis lié", e);
                setDevisDetail(null);
            }
        } else {
            setDevisDetail(null);
        }
    };

    const changerStatut = async (id, newStatut) => {
        try {
            const res = await api.put(`/factures/${id}/statut`, { statut: newStatut });
            await chargerDonnees();
            if (factureDetail?.id_facture === id) setFactureDetail(res.data);
            toast.success(`Statut mis à jour : ${newStatut}`);
        } catch (e) {
            toast.error("Erreur lors du changement de statut");
        }
    };

    const ouvrirEdition = (f) => {
        setEditId(f.id_facture);
        setEditForm({
            note: f.note || "",
            date_echeance: f.date_echeance ? f.date_echeance.split("T")[0] : ""
        });
        setEditVisible(true);
    };

    const enregistrerEdit = async () => {
        try {
            const res = await api.put(`/factures/${editId}`, {
                note: editForm.note,
                date_echeance: editForm.date_echeance || null,
            });
            await chargerDonnees();
            if (factureDetail?.id_facture === editId) setFactureDetail(res.data);
            setEditVisible(false);
            toast.success("Facture mise à jour");
        } catch (e) {
            toast.error(e.response?.data?.detail || "Erreur");
        }
    };

    const demanderSuppression = (id) => { setIdASupprimer(id); setModalVisible(true); };
    const confirmerSuppression = async () => {
        try { await api.delete(`/factures/${idASupprimer}`); await chargerDonnees(); } catch {}
        if (factureDetail?.id_facture === idASupprimer) setFactureDetail(null);
        setModalVisible(false); setIdASupprimer(null);
    };

    const formatDate = (d) => { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR"); };

    const facturesFiltrees = filtreStatut === "tous" ? factures : factures.filter(f => f.statut === filtreStatut);

    const caTotal = factures.filter(f => f.statut === "Payée").reduce((s, f) => s + f.montant_total, 0);
    const caAttente = factures.filter(f => f.statut === "En attente").reduce((s, f) => s + f.montant_total, 0);
    const showPanel = !!factureDetail;

    return (
        <>
            {modalVisible && (
                <ConfirmModal
                    message="Confirmer la suppression de cette facture ?"
                    onConfirm={confirmerSuppression}
                    onCancel={() => setModalVisible(false)}
                />
            )}

            <div className="space-y-6">
                {/* HEADER */}
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Facturation</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Les factures sont générées automatiquement depuis les devis confirmés.</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => exportPDF([
                                { label: "Référence", accessor: "reference" },
                                { label: "Client", accessor: row => `${row.client_prenom_utilisateur} ${row.client_nom_utilisateur}` },
                                { label: "Devis", accessor: row => row.devis_ref || "—" },
                                { label: "Montant", accessor: row => `${(row.montant_total || 0).toLocaleString('fr-FR')} FCFA` },
                                { label: "Date", accessor: row => formatDate(row.date_emission) },
                                { label: "Statut", accessor: "statut" }
                            ], factures, "Liste_Factures")}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-700 text-sm hover:bg-gray-50 transition-all"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Exporter PDF
                        </button>
                    </div>
                </div>

                {/* KPI */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-400 font-medium">Total factures</p>
                        <p className="text-2xl font-bold text-gray-800 mt-1">{factures.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-400 font-medium">Encaissé</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{caTotal.toLocaleString('fr-FR')} <span className="text-xs font-normal">FCFA</span></p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-400 font-medium">En attente</p>
                        <p className="text-2xl font-bold text-orange-500 mt-1">{caAttente.toLocaleString('fr-FR')} <span className="text-xs font-normal">FCFA</span></p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-400 font-medium">Depuis devis</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{factures.filter(f => f.id_devis).length}</p>
                    </div>
                </div>

                {/* FILTRE STATUT */}
                <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm w-fit border border-gray-100">
                    {["tous", ...STATUTS].map(s => (
                        <button
                            key={s}
                            onClick={() => setFiltreStatut(s)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${filtreStatut === s ? "bg-[#1E3A5F] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            {s === "tous" ? `Toutes (${factures.length})` : `${s} (${factures.filter(f => f.statut === s).length})`}
                        </button>
                    ))}
                </div>

                {/* CONTENU PRINCIPAL */}
                <div className={`flex flex-col ${showPanel ? "lg:grid lg:grid-cols-3 lg:items-start" : ""} gap-4 sm:gap-6`}>

                    {/* TABLEAU */}
                    <div className={`${showPanel ? "lg:col-span-2" : ""} bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden`}>
                        <GarageDataTable
                            loading={loading}
                            columns={[
                                {
                                    name: "Référence", selector: row => row.reference, sortable: true,
                                    cell: row => (
                                        <div>
                                            <span className="font-mono font-bold text-[#1E3A5F] text-sm">{row.reference}</span>
                                            {row.devis_ref && (
                                                <p className="text-[9px] text-gray-400 font-mono">↑ {row.devis_ref}</p>
                                            )}
                                        </div>
                                    )
                                },
                                {
                                    name: "Client", selector: row => `${row.client_nom_utilisateur} ${row.client_prenom_utilisateur}`, sortable: true, grow: 1.2,
                                    cell: row => <span className="text-sm text-gray-800">{row.client_prenom_utilisateur} {row.client_nom_utilisateur}</span>
                                },
                                {
                                    name: "Montant", selector: row => row.montant_total, sortable: true,
                                    cell: row => <span className="font-bold text-gray-800 text-sm">{(row.montant_total || 0).toLocaleString('fr-FR')} FCFA</span>
                                },
                                {
                                    name: "Date", selector: row => row.date_emission, sortable: true,
                                    cell: row => <span className="text-xs text-gray-500">{formatDate(row.date_emission)}</span>
                                },
                                {
                                    name: "Statut", selector: row => row.statut, sortable: true,
                                    cell: row => <span className={`text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap ${STATUT_COLORS[row.statut] || "bg-gray-100 text-gray-600"}`}>{row.statut}</span>
                                },
                                {
                                    name: "Actions", right: true, ignoreRowClick: true, width: "120px",
                                    cell: row => (
                                        <div className="flex gap-1.5 items-center" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={async () => {
                                                    try { await downloadDocumentPDF("facture", row.id_facture, row.reference); }
                                                    catch (e) { toast.error(e.message); }
                                                }}
                                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Télécharger PDF"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            </button>
                                            <button onClick={() => ouvrirEdition(row)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-all" title="Modifier note">
                                                <PencilIcon />
                                            </button>
                                            <button onClick={() => demanderSuppression(row.id_facture)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all" title="Supprimer">
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    )
                                },
                            ]}
                            data={facturesFiltrees}
                            onRowClicked={f => selectionnerFacture(f)}
                            conditionalRowStyles={[{ when: row => factureDetail?.id_facture === row.id_facture, style: { backgroundColor: "#eff6ff" } }]}
                            noDataMessage="Aucune facture — Générez-en depuis un devis confirmé"
                        />
                    </div>

                    {/* PANNEAU DÉTAIL FACTURE */}
                    {factureDetail && !editVisible && (
                        <div className="bg-white rounded-2xl shadow-sm p-5 lg:col-span-1 border border-gray-100 max-h-[85vh] overflow-y-auto custom-scrollbar">
                            {/* En-tête */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">{factureDetail.reference}</h2>
                                    <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-semibold ${STATUT_COLORS[factureDetail.statut] || ""}`}>
                                        {factureDetail.statut}
                                    </span>
                                </div>
                                <button onClick={() => setFactureDetail(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                            </div>

                            {/* Client */}
                            <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                <p className="text-xs text-gray-400 font-medium mb-1">Client</p>
                                <p className="text-sm font-semibold text-gray-800">{factureDetail.client_prenom_utilisateur} {factureDetail.client_nom_utilisateur}</p>
                                {factureDetail.vehicule_immatriculation && (
                                    <p className="text-xs text-gray-500 mt-0.5">Véhicule : {factureDetail.vehicule_immatriculation}</p>
                                )}
                            </div>

                            {/* Devis d'origine */}
                            {factureDetail.devis_ref && (
                                <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
                                    <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Devis d'origine</p>
                                    <p className="text-sm font-mono font-semibold text-blue-700">{factureDetail.devis_ref}</p>
                                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-green-700 bg-green-50 rounded-lg px-2 py-1.5 border border-green-100">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                        Stock déduit automatiquement à la génération
                                    </div>
                                </div>
                            )}

                            {/* Lignes du devis lié */}
                            {devisDetail?.lignes?.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Détail des prestations</p>
                                    <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-100 text-gray-500">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">Désignation</th>
                                                    <th className="px-3 py-2 text-center font-medium">Qté</th>
                                                    <th className="px-3 py-2 text-right font-medium">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {devisDetail.lignes.map((l, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 text-gray-700">
                                                            {l.description}
                                                            {l.id_piece && <span className="ml-1 text-[9px] text-green-600 font-semibold">📦</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-gray-600">{l.quantite}</td>
                                                        <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                                            {((l.quantite || 0) * (parseFloat(l.prix_unitaire) || 0)).toLocaleString('fr-FR')} FCFA
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Dates */}
                            <div className="space-y-2 mb-4 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span className="text-gray-400">Émise le</span>
                                    <span className="font-medium">{formatDate(factureDetail.date_emission)}</span>
                                </div>
                                {factureDetail.date_echeance && (
                                    <div className="flex justify-between text-gray-600">
                                        <span className="text-gray-400">Échéance</span>
                                        <span className="font-medium">{formatDate(factureDetail.date_echeance)}</span>
                                    </div>
                                )}
                                {factureDetail.note && (
                                    <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl">{factureDetail.note}</p>
                                )}
                            </div>

                            {/* Montant */}
                            <div className="flex justify-between items-center bg-gray-900 text-white rounded-xl p-4 mb-5 shadow-md">
                                <span className="text-sm opacity-70">Montant Total</span>
                                <span className="text-2xl font-bold">{(factureDetail.montant_total || 0).toLocaleString('fr-FR')} FCFA</span>
                            </div>

                            {/* Actions statut */}
                            <div className="space-y-3 mb-4">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Changer le statut</p>
                                <div className="flex flex-wrap gap-2">
                                    {STATUTS.filter(s => s !== factureDetail.statut).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => changerStatut(factureDetail.id_facture, s)}
                                            className={`flex-1 min-w-[90px] px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${STATUT_COLORS[s]} hover:opacity-80`}
                                        >
                                            Marquer "{s}"
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Boutons bas */}
                            <div className="flex gap-2 pt-3 border-t">
                                <button
                                    onClick={() => ouvrirEdition(factureDetail)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold transition-all"
                                >
                                    <PencilIcon /> Modifier note
                                </button>
                                <button
                                    onClick={async () => {
                                        try { await downloadDocumentPDF("facture", factureDetail.id_facture, factureDetail.reference); }
                                        catch (e) { toast.error(e.message); }
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-xl text-xs font-semibold transition-all"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    PDF
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FORMULAIRE ÉDITION NOTE/ECHÉANCE */}
                    {editVisible && (
                        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4">Modifier la facture</h3>
                            <p className="text-xs text-gray-400 mb-4 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                                ℹ Le montant est calculé automatiquement depuis le devis et ne peut pas être modifié manuellement.
                            </p>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Date d'échéance</label>
                                    <input
                                        type="date"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none"
                                        value={editForm.date_echeance}
                                        onChange={e => setEditForm(f => ({ ...f, date_echeance: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Note additionnelle</label>
                                    <textarea
                                        rows={3}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none resize-none"
                                        placeholder="Informations complémentaires..."
                                        value={editForm.note}
                                        onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                                    />
                                </div>
                                <div className="flex gap-2 pt-2 border-t">
                                    <button onClick={() => setEditVisible(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Annuler</button>
                                    <button onClick={enregistrerEdit} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-all">Valider</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
