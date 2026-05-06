import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext.jsx";
import api from "../../api.js";
import GarageDataTable from "../../components/DataTable.jsx";
import { FactureIcon } from "../../components/icons/AllIcon.jsx";
import { exportDocumentPDF, downloadDocumentPDF } from "../../utils/exportUtils.js";
import { toast } from "react-hot-toast";

export default function ClientFactures() {
  const { user } = useAuth();
  const [factures, setFactures] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [factureDetail, setFactureDetail] = useState(null);

  useEffect(() => {
    const fetchFactureData = async () => {
      try {
        const [resFact, resVeh] = await Promise.all([
          api.get(`/factures/client/${user.id_utilisateur}`),
          api.get(`/vehicules/client/${user.id_utilisateur}`)
        ]);
        setFactures(resFact.data);
        setVehicules(resVeh.data);
      } catch (error) {
        console.error("Erreur factures client:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFactureData();
  }, [user.id_utilisateur]);

  const telechargerPDF = async (facture, e) => {
    if (e) e.stopPropagation();
    try {
      await downloadDocumentPDF("facture", facture.id_facture, facture.reference);
    } catch {
      toast.error("Erreur de téléchargement.");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  const [filtreVehicule, setFiltreVehicule] = useState("all");
  const vehiculesUniques = Array.isArray(vehicules) ? vehicules.map(v => v.immatriculation) : [];
  const facturesFiltrées = Array.isArray(factures) 
    ? factures.filter(f => filtreVehicule === "all" || f.vehicule_immatriculation === filtreVehicule)
    : [];
  const showSidePanel = !!factureDetail;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes Factures</h1>
          <p className="text-gray-500 text-sm">Consultez l'historique de vos paiements et téléchargez vos factures.</p>
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
            <FactureIcon width="24" height="24" />
          </div>
        </div>
      </div>

      <div className={`flex flex-col ${showSidePanel ? "lg:grid lg:grid-cols-3 lg:items-start" : ""} gap-4 sm:gap-6`}>
        {/* TABLEAU */}
        <div className={`${showSidePanel ? "lg:col-span-2" : ""} bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden`}>
          <GarageDataTable
            columns={[
              { name: "Référence", selector: row => row.reference, cell: row => (
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800">{row.reference}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-medium">{row.vehicule_immatriculation || "Véhicule non spécifié"}</span>
                </div>
              )},
              { name: "Émission", selector: row => formatDate(row.date_emission) },
              { name: "Échéance", selector: row => formatDate(row.date_echeance) },
              { name: "Montant", selector: row => `${row.montant_total} FCFA`, cell: row => <span className="font-bold text-[#1E3A5F]">{row.montant_total.toLocaleString('fr-FR')} FCFA</span> },
              { name: "Statut", selector: row => row.statut, cell: row => (
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  row.statut === "Payée" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {row.statut}
                </span>
              )},
              { name: "Actions", right: true, cell: row => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setFactureDetail(row)} className="px-4 py-2 bg-[#1E3A5F] text-white text-[10px] font-bold rounded-xl hover:bg-[#162E4D] transition-all">
                        Voir
                    </button>
                    <button onClick={(e) => telechargerPDF(row, e)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all group" title="Télécharger">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>
              )}
            ]}
            data={facturesFiltrées}
            loading={loading}
            onRowClicked={f => setFactureDetail(f)}
            conditionalRowStyles={[{ when: row => factureDetail?.id_facture === row.id_facture, style: { backgroundColor: "#eff6ff" } }]}
          />
        </div>

        {/* DÉTAIL */}
        {factureDetail && (
            <div className="bg-white rounded-2xl shadow p-5 lg:col-span-1 border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Facture {factureDetail.reference}</h2>
                        <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${factureDetail.statut === "Payée" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {factureDetail.statut}
                        </span>
                    </div>
                    <button onClick={() => setFactureDetail(null)} className="text-gray-400 hover:text-gray-600">X</button>
                </div>

                <div className="space-y-3 mb-6 flex-1">
                    <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-gray-500">Véhicule</span>
                        <span className="font-semibold text-gray-800">{factureDetail.vehicule_immatriculation || "—"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-gray-500">Date d'émission</span>
                        <span className="font-semibold text-gray-800">{formatDate(factureDetail.date_emission)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-gray-500">Date d'échéance</span>
                        <span className="font-semibold text-gray-800">{formatDate(factureDetail.date_echeance)}</span>
                    </div>
                    {factureDetail.note && (
                        <div className="py-2 border-b text-sm">
                            <span className="text-gray-500 block mb-1">Notes</span>
                            <span className="text-gray-800">{factureDetail.note}</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center bg-gray-900 text-white rounded-xl p-4 mb-4 shadow-md">
                    <span className="text-sm opacity-80">Montant Total</span>
                    <span className="text-2xl font-bold">{factureDetail.montant_total.toLocaleString('fr-FR')} FCFA</span>
                </div>

                {/* Section de paiement supprimée - Consultation seule */}

                <button onClick={(e) => telechargerPDF(factureDetail, e)} className="w-full flex items-center justify-center gap-2 py-3 bg-[#1E3A5F] hover:bg-[#162E4D] text-white rounded-xl text-sm font-semibold transition-all shadow-md">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Télécharger la Facture (PDF)
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
