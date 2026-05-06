import React, { useState, useEffect } from "react";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import logo from "../../logonouveau.png";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import { exportDocumentPDF, downloadDocumentPDF } from "../../utils/exportUtils.js";
import GarageDataTable from "../../components/DataTable.jsx";
import { EyeIcon, EditIcon, TrashIcon } from "../../components/icons/AllIcon.jsx";

/* ══ STATUTS ══ */
const STATUTS = {
    brouillon: { label: "Brouillon", cls: "bg-gray-100 text-gray-600" },
    en_attente: { label: "En attente", cls: "bg-yellow-100 text-yellow-700" },
    confirme: { label: "Confirmé", cls: "bg-green-100 text-green-700" },
    rejete: { label: "Rejeté", cls: "bg-red-100 text-red-700" },
};

const ligneVide = () => ({ id: Math.random(), description: "", qte: 1, prixUnitaire: 0, id_piece: null });
const formVide = {
    id_client: "", id_vehicule: "", id_intervention: "", statut: "brouillon",
    dateCreation: new Date().toISOString().split("T")[0],
    dateEcheance: "",
    lignes: [ligneVide()],
    note: "",
};

const calcTotal = (lignes) => lignes.reduce((s, l) => s + (parseFloat(l.qte) || 0) * (parseFloat(l.prixUnitaire) || 0), 0);

export default function Devis() {
    const [devisList, setDevisList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formVisible, setFormVisible] = useState(false);
    const [modeEdition, setModeEdition] = useState(false);
    const [devisSelectionne, setDevisSelectionne] = useState(null);
    const [form, setForm] = useState(formVide);
    const [modalVisible, setModalVisible] = useState(false);
    const [idASupprimer, setIdASupprimer] = useState(null);
    const [devisApercu, setDevisApercu] = useState(null);
    const [filtre, setFiltre] = useState("tous");
    const [ficheAImprimer, setFicheAImprimer] = useState(null);
    const [erreur, setErreur] = useState("");
    const [generationEnCours, setGenerationEnCours] = useState(false);

    // Listes pour sélecteurs
    const [clients, setClients] = useState([]);
    const [vehicules, setVehicules] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [pieces, setPieces] = useState([]);  // pièces du stock

    const chargerDonnees = async () => {
        try {
            const [resDevis, resClients, resVehicules, resInter, resPieces] = await Promise.all([
                api.get("/devis"),
                api.get("/clients"),
                api.get("/vehicules"),
                api.get("/interventions"),
                api.get("/pieces"),
            ]);
            setDevisList(resDevis.data);
            setClients(resClients.data);
            setVehicules(resVehicules.data);
            setInterventions(resInter.data);
            setPieces(resPieces.data);
        } catch (e) {
            console.error("Erreur chargement données devis", e);
        }
        finally { setLoading(false); }
    };

    useEffect(() => { chargerDonnees(); }, []);

    const imprimerFiche = async (d) => {
        try {
            await downloadDocumentPDF("devis", d.id_devis, d.reference);
        } catch (e) {
            alert(e.message);
        }
    };

    const genererFacture = async (devis) => {
        if (generationEnCours) return;
        setGenerationEnCours(true);
        try {
            await api.post(`/devis/${devis.id_devis}/generer-facture`, { note: "" });
            toast.success(`Facture générée avec succès depuis le devis ${devis.reference} !`);
            await chargerDonnees();
            // Mettre à jour l'aperçu avec les nouvelles données
            setDevisApercu(prev => prev ? { ...prev, facture_generee: true } : prev);
        } catch (e) {
            toast.error(e.response?.data?.detail || "Erreur lors de la génération de la facture");
        } finally {
            setGenerationEnCours(false);
        }
    };


    /* ── CRUD ── */
    const ouvrirAjout = () => {
        const params = new URLSearchParams(window.location.search);
        const interId = params.get("new_inter");
        
        let initialForm = { ...formVide, lignes: [ligneVide()] };
        
        if (interId) {
            const inter = interventions.find(i => i.id_intervention === parseInt(interId));
            if (inter) {
                initialForm = {
                    ...initialForm,
                    id_client: inter.id_client,
                    id_vehicule: inter.id_vehicule,
                    id_intervention: inter.id_intervention,
                    note: `Devis lié à l'intervention N°${inter.id_intervention}`
                };
            }
        }
        
        setForm(initialForm);
        setModeEdition(false); setDevisSelectionne(null); setFormVisible(true); setDevisApercu(null); setErreur("");
    };

    const ouvrirEdition = (d) => {
        setForm({
            id_client: d.id_client, id_vehicule: d.id_vehicule, id_intervention: d.id_intervention || "", statut: d.statut,
            dateCreation: d.date_creation ? d.date_creation.split("T")[0] : "",
            dateEcheance: d.date_echeance ? d.date_echeance.split("T")[0] : "",
            lignes: d.lignes.map(l => ({ id: Math.random(), description: l.description, qte: l.quantite, prixUnitaire: l.prix_unitaire, id_piece: l.id_piece || null })),
            note: d.note || "",
        });
        setModeEdition(true); setDevisSelectionne(d.id_devis); setFormVisible(true); setDevisApercu(null); setErreur("");
    };

    const annuler = () => { setFormVisible(false); setForm(formVide); setModeEdition(false); setDevisSelectionne(null); setErreur(""); };

    const enregistrer = async () => {
        if (!form.id_client || !form.id_vehicule) { setErreur("Client et véhicule obligatoires"); return; }
        const payload = {
            id_client: parseInt(form.id_client),
            id_vehicule: parseInt(form.id_vehicule),
            id_intervention: form.id_intervention ? parseInt(form.id_intervention) : null,
            statut: form.statut,
            date_creation: form.dateCreation || null,
            date_echeance: form.dateEcheance || null,
            note: form.note,
            lignes: form.lignes.map(l => ({
                description: l.description,
                quantite: parseInt(l.qte) || 1,
                prix_unitaire: parseFloat(l.prixUnitaire) || 0,
                id_piece: l.id_piece ? parseInt(l.id_piece) : null,  // lien vers le stock
            })),
        };
        try {
            if (modeEdition) {
                await api.put(`/devis/${devisSelectionne}`, payload);
            } else {
                await api.post("/devis", payload);
            }
            await chargerDonnees();
            annuler();
        } catch (e) {
            setErreur(e.response?.data?.detail || "Erreur");
        }
    };

    const demanderSuppression = (id) => { setIdASupprimer(id); setModalVisible(true); };
    const confirmerSuppression = async () => {
        try { await api.delete(`/devis/${idASupprimer}`); await chargerDonnees(); } catch { }
        setModalVisible(false); setIdASupprimer(null);
    };
    const annulerSuppression = () => { setModalVisible(false); setIdASupprimer(null); };

    const changerStatut = async (id, statut) => {
        try {
            const res = await api.put(`/devis/${id}/statut`, { statut });
            setDevisList(prev => prev.map(d => d.id_devis === id ? res.data : d));
            if (devisApercu?.id_devis === id) setDevisApercu(res.data);
        } catch { }
    };

    /* ── Lignes ── */
    const ajouterLigne = () => setForm(f => ({ ...f, lignes: [...f.lignes, ligneVide()] }));
    const supprimerLigne = (id) => { if (form.lignes.length === 1) return; setForm(f => ({ ...f, lignes: f.lignes.filter(l => l.id !== id) })); };
    const updateLigne = (id, field, val) => setForm(f => ({ ...f, lignes: f.lignes.map(l => l.id === id ? { ...l, [field]: val } : l) }));

    /* ── Helpers ── */
    const liste = filtre === "tous" ? devisList : devisList.filter(d => d.statut === filtre);
    const clientLabel = (d) => `${d.client_prenom_utilisateur} ${d.client_nom_utilisateur}`;
    const vehiculeLabel = (d) => `${d.vehicule_marque} ${d.vehicule_modele} — ${d.vehicule_immatriculation}`;

    const vehiculesDuClient = form.id_client
        ? vehicules.filter(v => Number(v.id_client) === Number(form.id_client))
        : vehicules;

    const interventionsDisponibles = interventions.filter(i => {
        // En mode création, on cache celles qui ont déjà un devis
        // En mode édition, on affiche celle de l'intervention actuelle + celles qui n'en ont pas
        const aDejaUnDevis = devisList.some(d => d.id_intervention === i.id_intervention);
        if (modeEdition) {
            const currentDevis = devisList.find(d => d.id_devis === devisSelectionne);
            return !aDejaUnDevis || (currentDevis && currentDevis.id_intervention === i.id_intervention);
        }
        return !aDejaUnDevis;
    });

    return (
        <>
            {modalVisible && (
                <ConfirmModal message="Supprimer ce devis ? Cette action est irréversible." onConfirm={confirmerSuppression} onCancel={annulerSuppression} />
            )}

            {/* ══ MODALE APERÇU DEVIS ══ */}
            {devisApercu && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 py-10 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">{devisApercu.reference}</h2>
                                <p className="text-sm text-gray-400">Créé le {devisApercu.date_creation ? new Date(devisApercu.date_creation).toLocaleDateString("fr-FR") : "—"}</p>
                            </div>
                            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUTS[devisApercu.statut]?.cls}`}>
                                {STATUTS[devisApercu.statut]?.label}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4 mb-6 text-sm">
                            <div><p className="text-gray-400 text-xs mb-0.5">Client</p><p className="font-semibold text-gray-800">{clientLabel(devisApercu)}</p></div>
                            <div><p className="text-gray-400 text-xs mb-0.5">Véhicule</p><p className="font-semibold text-gray-800">{vehiculeLabel(devisApercu)}</p></div>
                            <div><p className="text-gray-400 text-xs mb-0.5">Date de création</p><p className="text-gray-700">{devisApercu.date_creation ? new Date(devisApercu.date_creation).toLocaleDateString("fr-FR") : "—"}</p></div>
                            {devisApercu.date_echeance && <div><p className="text-gray-400 text-xs mb-0.5">Échéance</p><p className="text-gray-700">{new Date(devisApercu.date_echeance).toLocaleDateString("fr-FR")}</p></div>}
                        </div>

                        <table className="w-full text-sm mb-2">
                            <thead>
                                <tr className="text-left text-gray-400 border-b text-xs uppercase">
                                    <th className="pb-2 pr-4">Désignation</th>
                                    <th className="pb-2 pr-4 text-right">Qté</th>
                                    <th className="pb-2 pr-4 text-right">P.U.</th>
                                    <th className="pb-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {devisApercu.lignes.map((l, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="py-2 pr-4 text-gray-700">{l.description}</td>
                                        <td className="py-2 pr-4 text-right text-gray-600">{l.quantite}</td>
                                        <td className="py-2 pr-4 text-right text-gray-600">{(parseFloat(l.prix_unitaire) || 0).toLocaleString('fr-FR')} FCFA</td>
                                        <td className="py-2 text-right font-medium text-gray-800">{((l.quantite || 0) * (parseFloat(l.prix_unitaire) || 0)).toLocaleString('fr-FR')} FCFA</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex justify-end mb-4">
                            <div className="bg-[#1E3A5F] text-white px-6 py-3 rounded-2xl">
                                <span className="text-sm opacity-80">Total TTC</span>
                                <p className="text-2xl font-bold">{(devisApercu.total || 0).toLocaleString('fr-FR')} FCFA</p>
                            </div>
                        </div>

                        {devisApercu.note && (
                            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 mb-5 italic">{devisApercu.note}</p>
                        )}

                        <div className="flex flex-wrap gap-3 justify-between items-center pt-4 border-t">
                            <button onClick={() => setDevisApercu(null)} className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-100">Fermer</button>
                            <div className="flex flex-wrap gap-2">
                                {devisApercu.statut !== "confirme" && devisApercu.statut !== "rejete" && (
                                    <>
                                        <button onClick={() => changerStatut(devisApercu.id_devis, "rejete")} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm transition-all">Rejeter</button>
                                        <button onClick={() => changerStatut(devisApercu.id_devis, "confirme")} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm transition-all">Valider</button>
                                    </>
                                )}
                                {((devisApercu.statut === "confirme" || devisApercu.statut === "rejete")) && (
                                    <button onClick={() => changerStatut(devisApercu.id_devis, "en_attente")} className="px-4 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-xl text-sm">Remettre en attente</button>
                                )}

                                {/* ── BOUTON GÉNÉRER FACTURE ── */}
                                {devisApercu.statut === "confirme" && !devisApercu.facture_generee && (
                                    <button
                                        onClick={() => genererFacture(devisApercu)}
                                        disabled={generationEnCours}
                                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-500/30 ring-2 ring-green-300"
                                        title="Génère une facture et déduit le stock automatiquement"
                                    >
                                        {generationEnCours ? (
                                            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                                        )}
                                        Générer la Facture
                                    </button>
                                )}
                                {devisApercu.statut === "confirme" && !!devisApercu.facture_generee && (
                                    <span className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-semibold flex items-center gap-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                        Facture générée
                                    </span>
                                )}
                                {devisApercu.statut !== "confirme" && devisApercu.statut !== "rejete" && (
                                    <span className="px-3 py-2 bg-yellow-50 text-yellow-600 border border-yellow-200 rounded-xl text-xs font-medium">
                                        ⚠ Devis non confirmé par le client
                                    </span>
                                )}


                                <button onClick={() => { setDevisApercu(null); ouvrirEdition(devisApercu); }} className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-sm flex items-center gap-2">
                                    <EditIcon width="14" height="14" /> Modifier
                                </button>
                                <button onClick={() => imprimerFiche(devisApercu)} className="px-4 py-2 bg-[#1E3A5F] text-white hover:bg-[#162e4d] rounded-xl text-sm flex items-center gap-2 transition-all">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Télécharger PDF
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ══ PAGE ══ */}
            <div>
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Gestion des Devis</h1>
                    <button onClick={ouvrirAjout} className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95">
                        Nouveau Devis
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    {Object.entries(STATUTS).map(([key, s]) => (
                        <button key={key} onClick={() => setFiltre(filtre === key ? "tous" : key)}
                            className={`bg-white rounded-2xl shadow p-4 text-left transition-all hover:shadow-md ${filtre === key ? "ring-2 ring-[#1E3A5F]" : ""}`}>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                            <p className="text-2xl font-bold text-gray-800 mt-2">{devisList.filter(d => d.statut === key).length}</p>
                        </button>
                    ))}
                </div>

                {/* Filtre */}
                <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm w-fit mb-5">
                    <button onClick={() => setFiltre("tous")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filtre === "tous" ? "bg-[#1E3A5F] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
                        Tous ({devisList.length})
                    </button>
                    {Object.entries(STATUTS).map(([key, s]) => (
                        <button key={key} onClick={() => setFiltre(filtre === key ? "tous" : key)}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all hidden sm:block ${filtre === key ? "bg-[#1E3A5F] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Liste + Formulaire */}
                <div className="flex flex-col gap-4 sm:gap-6">
                    {!formVisible && (
                    <div className="space-y-3">
                        <GarageDataTable
                            loading={loading}
                            columns={[
                                { name: "N°", selector: d => d.reference, sortable: true, cell: d => <span className="font-bold text-[#1E3A5F]">{d.reference}</span>, width: "120px" },
                                { name: "Client", selector: d => clientLabel(d), sortable: true },
                                { name: "Total", selector: d => d.total, sortable: true, cell: d => <span className="font-bold text-gray-800">{(d.total || 0).toLocaleString('fr-FR')} FCFA</span> },
                                { 
                                    name: "Statut", 
                                    selector: d => d.statut, 
                                    cell: d => {
                                        const { label, cls } = STATUTS[d.statut] || {};
                                        return (
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${cls}`}>{label}</span>
                                                {d.facture_generee && (
                                                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                        Facturé
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    }
                                },
                                {
                                    name: "Actions",
                                    right: true,
                                    cell: d => (
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); setDevisApercu(d); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Aperçu">
                                                <EyeIcon width="16" height="16" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); ouvrirEdition(d); }} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Modifier">
                                                <EditIcon width="16" height="16" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); demanderSuppression(d.id_devis); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Supprimer">
                                                <TrashIcon width="16" height="16" />
                                            </button>
                                        </div>
                                    )
                                }
                            ]}
                            data={liste}
                            onRowClicked={setDevisApercu}
                            noDataMessage="Aucun devis dans cette catégorie."
                        />
                    </div>
                    )}

                    {/* ══ FORMULAIRE ══ */}
                    {formVisible && (
                        <div className="bg-white rounded-2xl shadow p-6 lg:p-8 w-full max-w-4xl mx-auto max-h-[85vh] overflow-y-auto">
                            <h2 className="font-semibold text-gray-800 mb-4 text-xl">
                                {modeEdition ? "Modifier le Devis" : "Nouveau Devis"}
                            </h2>
                            {erreur && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2 mb-3">{erreur}</div>}

                            <div className="flex flex-col gap-3">
                                <Field label="Client">
                                    <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none bg-white" value={form.id_client} onChange={e => setForm(f => ({ ...f, id_client: e.target.value, id_vehicule: "" }))}>
                                        <option value="">— Sélectionner un client —</option>
                                        {clients.map(c => <option key={c.id_client} value={c.id_client}>{c.prenom_utilisateur} {c.nom_utilisateur}</option>)}
                                    </select>
                                </Field>
                                <Field label="Véhicule">
                                    <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none bg-white" value={form.id_vehicule} onChange={e => setForm(f => ({ ...f, id_vehicule: e.target.value }))}>
                                        <option value="">— Sélectionner un véhicule —</option>
                                        {vehiculesDuClient.map(v => <option key={v.id_vehicule} value={v.id_vehicule}>{v.marque} {v.modele} — {v.immatriculation}</option>)}
                                    </select>
                                </Field>
                                <Field label="Intervention liée (Optionnel)">
                                    <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none bg-white font-mono" value={form.id_intervention} onChange={e => setForm(f => ({ ...f, id_intervention: e.target.value }))}>
                                        <option value="">— Aucune intervention —</option>
                                        {interventionsDisponibles.filter(i => i.id_vehicule === parseInt(form.id_vehicule)).map(i => (
                                            <option key={i.id_intervention} value={i.id_intervention}>
                                                Int. N°{i.id_intervention} ({new Date(i.date_creation).toLocaleDateString()})
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Date de création">
                                        <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none" value={form.dateCreation} onChange={e => setForm(f => ({ ...f, dateCreation: e.target.value }))} />
                                    </Field>
                                    <Field label="Échéance">
                                        <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none" value={form.dateEcheance} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))} />
                                    </Field>
                                </div>

                                <Field label="Statut">
                                    <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none bg-white" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                                        {Object.entries(STATUTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                                    </select>
                                </Field>

                                {/* Lignes */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-medium text-gray-500">Lignes de prestation</label>
                                        <button onClick={ajouterLigne} className="text-xs text-[#1E3A5F] font-semibold hover:underline">Ajouter une ligne</button>
                                    </div>
                                    <div className="space-y-2 bg-gray-50 p-3 rounded-xl border">
                                        <div className="grid grid-cols-12 gap-1 text-xs text-gray-400 font-medium px-1">
                                            <span className="col-span-1 text-center">#</span>
                                            <span className="col-span-3">Pièce stock (optionnel)</span>
                                            <span className="col-span-3">Description / Prestation</span>
                                            <span className="col-span-1 text-center">Qté</span>
                                            <span className="col-span-2 text-right">P.U. (FCFA)</span>
                                            <span className="col-span-2 text-right">Total</span>
                                        </div>
                                        {form.lignes.map((ligne, i) => (
                                            <div key={ligne.id} className="grid grid-cols-12 gap-1 items-center bg-white rounded-lg p-1.5 border border-gray-100">
                                                <span className="col-span-1 text-center text-[10px] font-bold text-gray-400">{i + 1}</span>
                                                {/* Sélecteur pièce stock */}
                                                <select
                                                    className="col-span-3 border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-green-500 outline-none bg-white"
                                                    value={ligne.id_piece || ""}
                                                    onChange={e => {
                                                        const id = e.target.value ? parseInt(e.target.value) : null;
                                                        const piece = pieces.find(p => p.id_piece === id);
                                                        updateLigne(ligne.id, "id_piece", id);
                                                        if (piece) {
                                                            updateLigne(ligne.id, "description", piece.nom_piece);
                                                            updateLigne(ligne.id, "prixUnitaire", piece.prix_unitaire || 0);
                                                        }
                                                    }}
                                                >
                                                    <option value="">— Prestation libre —</option>
                                                    {pieces.map(p => (
                                                        <option key={p.id_piece} value={p.id_piece}>
                                                            {p.nom_piece} (stock: {p.quantite})
                                                        </option>
                                                    ))}
                                                </select>
                                                {/* Description */}
                                                <input
                                                    className="col-span-3 border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1E3A5F] outline-none"
                                                    placeholder="Prestation / description..."
                                                    value={ligne.description}
                                                    onChange={e => updateLigne(ligne.id, "description", e.target.value)}
                                                />
                                                <input type="number" min="1" className="col-span-1 border rounded-lg px-2 py-1.5 text-xs text-center focus:ring-1 focus:ring-[#1E3A5F] outline-none" value={ligne.qte} onChange={e => updateLigne(ligne.id, "qte", e.target.value)} />
                                                <input type="number" min="0" step="0.01" className="col-span-2 border rounded-lg px-2 py-1.5 text-xs text-right focus:ring-1 focus:ring-[#1E3A5F] outline-none" value={ligne.prixUnitaire} onChange={e => updateLigne(ligne.id, "prixUnitaire", e.target.value)} />
                                                <div className="col-span-2 flex items-center justify-end gap-1">
                                                    <div className="text-right">
                                                        <span className="text-xs font-medium text-gray-700 block">
                                                            {((parseFloat(ligne.qte) || 0) * (parseFloat(ligne.prixUnitaire) || 0)).toLocaleString('fr-FR')} FCFA
                                                        </span>
                                                        {ligne.id_piece && (
                                                            <span className="text-[9px] text-green-600 font-semibold">📦 Stock lié</span>
                                                        )}
                                                    </div>
                                                    {form.lignes.length > 1 && (
                                                        <button onClick={() => supprimerLigne(ligne.id)} className="text-red-400 hover:text-red-600 text-sm leading-none ml-1">✕</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center pt-2 border-t">
                                            <span className="text-[10px] text-gray-400 italic">
                                                {form.lignes.filter(l => l.id_piece).length > 0
                                                    ? `${form.lignes.filter(l => l.id_piece).length} pièce(s) liée(s) au stock — déduction automatique à la facturation`
                                                    : "Aucune pièce liée au stock"
                                                }
                                            </span>
                                            <span className="text-sm font-bold text-[#1E3A5F]">
                                                Total : {calcTotal(form.lignes).toLocaleString('fr-FR')} FCFA
                                            </span>
                                        </div>

                                    </div>
                                </div>

                                <Field label="Note / Observation">
                                    <textarea rows={2} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none resize-none" placeholder="Informations supplémentaires..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                                </Field>

                                <div className="flex items-center justify-between gap-3 mt-4 pt-2 border-t mt-4">
                                    <button onClick={annuler} className="px-5 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95">Annuler</button>
                                    <button onClick={enregistrer} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md shadow-green-500/20 transition-all active:scale-95">
                                        Valider
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
