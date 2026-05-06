import React, { useState, useEffect } from "react";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { PencilIcon, TrashIcon } from "../../components/icons/AllIcon.jsx";
import GarageDataTable from "../../components/DataTable.jsx";
import api from "../../api.js";

const formVide = { nom_piece: "", quantite: "", seuilAlerte: "", dateEnregistrement: new Date().toISOString().split("T")[0] };

export default function Stock() {
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formVisible, setFormVisible] = useState(false);
    const [modeEdition, setModeEdition] = useState(false);
    const [itemSelectionne, setItemSelectionne] = useState(null);
    const [form, setForm] = useState(formVide);
    const [modalVisible, setModalVisible] = useState(false);
    const [idASupprimer, setIdASupprimer] = useState(null);
    const [modalPrise, setModalPrise] = useState(false);
    const [itemEnPrise, setItemEnPrise] = useState(null);
    const [qtePrise, setQtePrise] = useState(1);
    const [filtre, setFiltre] = useState("tous");
    const [erreur, setErreur] = useState("");

    const chargerStock = async () => {
        try {
            const res = await api.get("/pieces");
            setStock(res.data.map(p => ({
                id_piece: p.id_piece, nom_piece: p.nom_piece, quantite: p.quantite,
                seuilAlerte: p.seuil_alerte,
                dateEnregistrement: p.date_enregistrement ? p.date_enregistrement.split("T")[0] : "",
            })));
        } catch (e) {
            console.error("Erreur chargement données stock", e);
            setStock([]);
        }
        finally { setLoading(false); }
    };

    useEffect(() => { chargerStock(); }, []);

    const ouvrirAjout = () => { setForm(formVide); setModeEdition(false); setItemSelectionne(null); setFormVisible(true); setErreur(""); };

    const ouvrirEdition = (item) => {
        setForm({ nom_piece: item.nom_piece, quantite: item.quantite, seuilAlerte: item.seuilAlerte, dateEnregistrement: item.dateEnregistrement });
        setModeEdition(true); setItemSelectionne(item.id_piece); setFormVisible(true); setErreur("");
    };

    const annuler = () => { setFormVisible(false); setForm(formVide); setModeEdition(false); setItemSelectionne(null); setErreur(""); };

    const enregistrer = async () => {
        if (!form.nom_piece) { setErreur("Le nom est obligatoire"); return; }
        const payload = {
            nom_piece: form.nom_piece,
            quantite: parseInt(form.quantite) || 0,
            seuil_alerte: parseInt(form.seuilAlerte) || 0,
            date_enregistrement: form.dateEnregistrement || null,
        };
        try {
            if (modeEdition) {
                await api.put(`/pieces/${itemSelectionne}`, payload);
            } else {
                await api.post("/pieces", payload);
            }
            await chargerStock();
            annuler();
        } catch (e) {
            setErreur(e.response?.data?.detail || "Erreur");
        }
    };

    const demanderSuppression = (id) => { setIdASupprimer(id); setModalVisible(true); };
    const confirmerSuppression = async () => {
        try { await api.delete(`/pieces/${idASupprimer}`); await chargerStock(); }
        catch { }
        setModalVisible(false); setIdASupprimer(null);
    };
    const annulerSuppression = () => { setModalVisible(false); setIdASupprimer(null); };

    const ouvrirPrise = (item) => { setItemEnPrise(item); setQtePrise(1); setModalPrise(true); };

    const confirmerPrise = async () => {
        const qte = parseInt(qtePrise) || 0;
        if (qte <= 0) return;
        try {
            await api.put(`/pieces/${itemEnPrise.id_piece}/prendre`, { quantite: qte });
            await chargerStock();
        } catch { }
        setModalPrise(false); setItemEnPrise(null); setQtePrise(1);
    };

    const enAlerte = stock.filter(i => i.quantite <= i.seuilAlerte);
    const stockFiltre = filtre === "alerte" ? enAlerte
        : filtre === "ok" ? stock.filter(i => i.quantite > i.seuilAlerte)
            : stock;

    const badgeEtat = (item) => {
        if (item.quantite === 0) return { label: "Rupture", cls: "bg-red-200 text-red-800" };
        if (item.quantite <= item.seuilAlerte) return { label: "Alerte", cls: "bg-orange-100 text-orange-700" };
        return { label: "OK", cls: "bg-green-100 text-green-700" };
    };

    return (
        <>
            {modalVisible && (
                <ConfirmModal
                    message="Supprimer cet article du stock ? Cette action est irréversible."
                    onConfirm={confirmerSuppression}
                    onCancel={annulerSuppression}
                />
            )}

            {modalPrise && itemEnPrise && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                        <h3 className="font-semibold text-gray-800 mb-1">Prendre des pièces</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Article : <span className="font-medium text-gray-700">{itemEnPrise.nom_piece}</span>
                            <br />Stock disponible : <span className="font-bold text-gray-800">{itemEnPrise.quantite}</span>
                        </p>

                        <label className="text-xs font-medium text-gray-500 mb-1 block">Quantité à prendre</label>
                        <div className="flex items-center gap-3 mb-5">
                            <button onClick={() => setQtePrise(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center">−</button>
                            <input type="number" min="1" max={itemEnPrise.quantite} value={qtePrise}
                                onChange={e => setQtePrise(Math.min(itemEnPrise.quantite, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="w-full text-center border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                            <button onClick={() => setQtePrise(q => Math.min(itemEnPrise.quantite, q + 1))} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center">+</button>
                        </div>

                        {qtePrise > itemEnPrise.quantite - itemEnPrise.seuilAlerte && itemEnPrise.quantite > itemEnPrise.seuilAlerte && (
                            <p className="text-xs text-orange-500 mb-3">Cette prise passera la pièce en alerte stock.</p>
                        )}

                        <div className="flex justify-between">
                            <button onClick={() => setModalPrise(false)} className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-100">Annuler</button>
                            <button onClick={confirmerPrise} disabled={itemEnPrise.quantite === 0}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-xl text-sm transition-all">
                                Confirmer la prise
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Gestion du Stock</h1>
                    <button onClick={ouvrirAjout} className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95">
                        Ajouter une pièce
                    </button>
                </div>

                {enAlerte.length > 0 && (
                    <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-5">
                        <div>
                            <p className="text-sm font-semibold text-orange-700">{enAlerte.length} article(s) en alerte ou rupture</p>
                            <p className="text-xs text-orange-500 mt-0.5">{enAlerte.map(i => i.nom_piece).join(" · ")}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <StatBox label="Total articles" value={stock.length} color="text-gray-800" />
                    <StatBox label="En stock OK" value={stock.filter(i => i.quantite > i.seuilAlerte).length} color="text-green-600" />
                    <StatBox label="En alerte" value={enAlerte.filter(i => i.quantite > 0).length} color="text-orange-500" />
                    <StatBox label="Rupture totale" value={stock.filter(i => i.quantite === 0).length} color="text-red-600" />
                </div>

                <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm w-fit mb-5">
                    {[["tous", "Tous"], ["ok", "OK"], ["alerte", "Alerte"]].map(([val, lbl]) => (
                        <button key={val} onClick={() => setFiltre(val)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filtre === val ? "bg-[#1E3A5F] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
                        >{lbl}</button>
                    ))}
                </div>

                <div className="flex flex-col gap-4 sm:gap-6">
                    {!formVisible && (
                        <div className="bg-white rounded-2xl shadow overflow-hidden">
                            <GarageDataTable
                                loading={loading}
                                columns={[
                                    { name: "Pièce / Article", selector: row => row.nom_piece, sortable: true, cell: row => <span className="font-medium text-gray-800">{row.nom_piece}</span>, grow: 2 },
                                    { name: "Quantité", selector: row => row.quantite, sortable: true, cell: row => <span className={`font-bold text-lg ${row.quantite === 0 ? "text-red-600" : row.quantite <= row.seuilAlerte ? "text-orange-500" : "text-gray-800"}`}>{row.quantite}</span>, width: "100px" },
                                    { name: "Seuil alerte", selector: row => row.seuilAlerte, sortable: true, cell: row => <span className="text-gray-500">{row.seuilAlerte}</span>, width: "110px" },
                                    { name: "Date enreg.", selector: row => row.dateEnregistrement || "", sortable: true, cell: row => <span className="text-xs text-gray-500">{row.dateEnregistrement ? new Date(row.dateEnregistrement).toLocaleDateString("fr-FR") : "—"}</span>, width: "110px" },
                                    { name: "État", selector: row => badgeEtat(row).label, sortable: true, cell: row => { const { label, cls } = badgeEtat(row); return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{label}</span>; }, width: "90px" },
                                    {
                                        name: "Actions", right: true, cell: row => (
                                            <div className="flex gap-2">
                                                <button onClick={() => ouvrirPrise(row)} disabled={row.quantite === 0} title="Prendre" className="flex items-center justify-center w-8 h-8 bg-orange-400 hover:bg-orange-500 disabled:bg-gray-200 text-white rounded-lg transition-all text-sm font-bold">−</button>
                                                <button onClick={() => ouvrirEdition(row)} title="Modifier" className="flex items-center justify-center w-8 h-8 bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-lg transition-all"><PencilIcon /></button>
                                                <button onClick={() => demanderSuppression(row.id_piece)} title="Supprimer" className="flex items-center justify-center w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"><TrashIcon /></button>
                                            </div>
                                        ), ignoreRowClick: true, width: "140px"
                                    },
                                ]}
                                data={stockFiltre}
                                conditionalRowStyles={[{ when: row => row.quantite <= row.seuilAlerte, style: { backgroundColor: "rgba(255,237,213,0.4)" } }]}
                                noDataMessage="Aucune pièce dans cette catégorie"
                            />
                        </div>
                    )}

                    {formVisible && (
                        <div className="bg-white rounded-2xl shadow p-6 lg:p-8 w-full max-w-4xl mx-auto">
                            <h2 className="font-semibold text-gray-800 mb-4 text-xl">
                                {modeEdition ? "Modifier la pièce" : "Ajouter une pièce"}
                            </h2>
                            {erreur && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2 mb-3">{erreur}</div>}
                            <div className="flex flex-col gap-3">
                                <Field label="Nom de la pièce / Article">
                                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex : Filtre à huile" value={form.nom_piece} onChange={e => setForm({ ...form, nom_piece: e.target.value })} />
                                </Field>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Quantité">
                                        <input type="number" min="0" className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" value={form.quantite} onChange={e => setForm({ ...form, quantite: e.target.value })} />
                                    </Field>
                                    <Field label="Seuil d'alerte">
                                        <input type="number" min="0" className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" placeholder="0" value={form.seuilAlerte} onChange={e => setForm({ ...form, seuilAlerte: e.target.value })} />
                                    </Field>
                                </div>
                                <p className="text-xs text-gray-400 -mt-1">Une alerte s'affiche quand la quantité ≤ seuil.</p>

                                <Field label="Date d'enregistrement">
                                    <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.dateEnregistrement} onChange={e => setForm({ ...form, dateEnregistrement: e.target.value })} />
                                </Field>

                                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t">
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

function StatBox({ label, value, color }) {
    return (
        <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
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
