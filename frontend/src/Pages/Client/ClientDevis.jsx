import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext.jsx";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import GarageDataTable from "../../components/DataTable.jsx";
import { DevisIcon } from "../../components/icons/AllIcon.jsx";
import { exportDocumentPDF, downloadDocumentPDF } from "../../utils/exportUtils.js";

export default function ClientDevis() {
  const { user } = useAuth();
  const [devis, setDevis] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devisDetail, setDevisDetail] = useState(null);

  useEffect(() => {
    const fetchDevis = async () => {
      try {
        const [resDevis, resVeh] = await Promise.all([
          api.get(`/devis/client/${user.id_utilisateur}`),
          api.get(`/vehicules/client/${user.id_utilisateur}`)
        ]);
        setDevis(resDevis.data);
        setVehicules(resVeh.data);
      } catch (error) {
        console.error("Erreur devis client:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDevis();
  }, [user.id_utilisateur]);

  const changerStatut = async (id, nouveauStatut) => {
    try {
      const res = await api.put(`/devis/${id}/statut`, { statut: nouveauStatut });
      setDevis(prev => prev.map(d => d.id_devis === id ? res.data : d));
      if (devisDetail?.id_devis === id) setDevisDetail(res.data);
      toast.success(nouveauStatut === "confirme" ? "Devis accepté !" : "Devis refusé.");
    } catch (e) {
      console.error("Erreur changement statut", e);
      toast.error("Une erreur est survenue lors de la modification du statut.");
    }
  };

  const telechargerPDF = async (d, e) => {
    if (e) e.stopPropagation();
    try {
      await downloadDocumentPDF("devis", d.id_devis, d.reference);
    } catch (err) {
      toast.error("Erreur lors du téléchargement du PDF.");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  const [filtreVehicule, setFiltreVehicule] = useState("all");
  const vehiculesUniques = Array.isArray(vehicules) ? vehicules.map(v => v.immatriculation) : [];
  const devisFiltrés = Array.isArray(devis) 
    ? devis.filter(d => filtreVehicule === "all" || d.vehicule_immatriculation === filtreVehicule)
    : [];
  const showSidePanel = !!devisDetail;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes Devis</h1>
          <p className="text-gray-500 text-sm">Consultez et validez vos devis en ligne.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Filtrer par véhicule</span>
            <select 
              value={filtreVehicule} 
              onChange={e => setFiltreVehicule(e.target.value)}
              className="text-xs font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
            >
              <option value="all">Tous les véhicules</option>
              {vehiculesUniques.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DevisIcon width="24" height="24" />
          </div>
        </div>
      </div>

      <div className={`flex flex-col ${showSidePanel ? "lg:grid lg:grid-cols-3 lg:items-start" : ""} gap-4 sm:gap-6`}>
        {/* TABLEAU */}
        <div className={`${showSidePanel ? "lg:col-span-2" : ""} bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden`}>
          <GarageDataTable
            columns={[
              { name: "N°", selector: row => row.reference, cell: row => <span className="font-bold text-blue-600">{row.reference}</span> },
              { name: "Véhicule", selector: row => `${row.vehicule_marque || ''} ${row.vehicule_modele || ''}`, cell: row => (
                <div>
                    <p className="font-semibold text-gray-800">{row.vehicule_immatriculation}</p>
                    <p className="text-[10px] text-gray-400 uppercase">{row.vehicule_marque} {row.vehicule_modele}</p>
                </div>
              )},
              { name: "Date", selector: row => formatDate(row.date_creation) },
              { name: "Validité", selector: row => formatDate(row.date_echeance) },
              { name: "Montant", selector: row => `${(row.total || 0)} FCFA`, cell: row => <span className="font-bold text-gray-800">{(row.total || 0).toLocaleString('fr-FR')} FCFA</span> },
              { name: "Statut", selector: row => row.statut, cell: row => (
                <div className="flex flex-col gap-1">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    row.statut === "confirme" ? "bg-green-100 text-green-700" :
                    row.statut === "rejete" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    {row.statut === "confirme" ? "Confirmé" : row.statut === "rejete" ? "Refusé" : "En attente"}
                  </span>
                  {row.facture_generee && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 flex items-center gap-1 w-fit">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      Facture émise
                    </span>
                  )}
                </div>
              )},
              { name: "Actions", right: true, cell: row => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setDevisDetail(row)} className="px-4 py-2 bg-[#1E3A5F] text-white text-[10px] font-bold rounded-xl hover:bg-[#162E4D] transition-all">
                      Voir
                  </button>
                  <button onClick={(e) => telechargerPDF(row, e)} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all" title="Télécharger">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                </div>
              )}
            ]}
            data={devisFiltrés}
            loading={loading}
            onRowClicked={d => setDevisDetail(d)}
            conditionalRowStyles={[{ when: row => devisDetail?.id_devis === row.id_devis, style: { backgroundColor: "#eff6ff" } }]}
          />
        </div>

        {/* DÉTAIL */}
        {devisDetail && (
            <div className="bg-white rounded-2xl shadow p-5 lg:col-span-1 border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Devis {devisDetail.reference}</h2>
                        <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${devisDetail.statut === "confirme" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {devisDetail.statut}
                        </span>
                    </div>
                    <button onClick={() => setDevisDetail(null)} className="text-gray-400 hover:text-gray-600">X</button>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Véhicule concerné</p>
                    <p className="text-sm text-gray-600">{devisDetail.vehicule_marque} {devisDetail.vehicule_modele}</p>
                </div>

                <div className="space-y-3 mb-6 flex-1">
                    <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-gray-500">Créé le</span>
                        <span className="font-semibold text-gray-800">{formatDate(devisDetail.date_creation)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-gray-500">Valable jusqu'au</span>
                        <span className="font-semibold text-gray-800">{formatDate(devisDetail.date_echeance)}</span>
                    </div>
                </div>

                {devisDetail.lignes && devisDetail.lignes.length > 0 && (
                    <div className="mb-6">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Détail des pièces & main d'œuvre</p>
                        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Description</th>
                                        <th className="px-3 py-2 font-medium text-center">Qté</th>
                                        <th className="px-3 py-2 font-medium text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {devisDetail.lignes.map((l, i) => (
                                        <tr key={i}>
                                            <td className="px-3 py-2 text-gray-700">{l.description}</td>
                                            <td className="px-3 py-2 text-center text-gray-600">{l.quantite}</td>
                                            <td className="px-3 py-2 text-right font-medium text-gray-800">{((l.quantite || 0) * (parseFloat(l.prix_unitaire) || 0)).toLocaleString('fr-FR')} FCFA</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center bg-gray-900 text-white rounded-xl p-4 mb-4 shadow-md">
                    <span className="text-sm opacity-80">Total estimé</span>
                    <span className="text-2xl font-bold">{(devisDetail.total || 0).toLocaleString('fr-FR')} FCFA</span>
                </div>

                {devisDetail.statut === "en_attente" && (
                    <div className="flex gap-2 mb-4">
                        <button onClick={() => changerStatut(devisDetail.id_devis, "rejete")} className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold border border-red-200 transition-all">
                            Refuser
                        </button>
                        <button onClick={() => changerStatut(devisDetail.id_devis, "confirme")} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all">
                            Accepter le Devis
                        </button>
                    </div>
                )}

                {devisDetail.statut === "confirme" && devisDetail.facture_generee && (
                    <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Votre facture a été émise — consultez l'onglet Mes Factures
                    </div>
                )}

                <button onClick={(e) => telechargerPDF(devisDetail, e)} className="w-full flex items-center justify-center gap-2 py-3 bg-[#1E3A5F] hover:bg-[#162E4D] text-white rounded-xl text-sm font-semibold transition-all shadow-md">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Télécharger le Devis (PDF)
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
