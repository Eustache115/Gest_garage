import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext.jsx";
import api from "../../api.js";
import GarageDataTable from "../../components/DataTable.jsx";
import { ToolIcon, CarIcon, DevisIcon, FactureIcon } from "../../components/icons/AllIcon.jsx";
import { toast } from "react-hot-toast";

export default function ClientInterventions() {
  const { user } = useAuth();
  const [interventions, setInterventions] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [avisList, setAvisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInter, setSelectedInter] = useState(null);
  
  // États pour le modal d'avis
  const [showAvisModal, setShowAvisModal] = useState(false);
  const [noteAvis, setNoteAvis] = useState(5);
  const [commentaireAvis, setCommentaireAvis] = useState("");
  const [submittingAvis, setSubmittingAvis] = useState(false);

  const chargerInterventions = async () => {
    try {
      const [resInter, resVeh, resAvis] = await Promise.all([
        api.get(`/interventions/client/${user.id_utilisateur}`),
        api.get(`/vehicules/client/${user.id_utilisateur}`),
        api.get(`/avis/client/${user.id_utilisateur}`)
      ]);
      setInterventions(Array.isArray(resInter.data) ? resInter.data : []);
      setVehicules(Array.isArray(resVeh.data) ? resVeh.data : []);
      setAvisList(Array.isArray(resAvis.data) ? resAvis.data : []);
    } catch (error) {
      console.error("Erreur interventions client:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerInterventions();
  }, [user.id_utilisateur]);

  const handleSoumettreAvis = async (e) => {
    e.preventDefault();
    if (!selectedInter) return;
    
    setSubmittingAvis(true);
    try {
      const payload = {
        id_intervention: selectedInter.id_intervention,
        note: noteAvis,
        commentaire: commentaireAvis
      };
      await api.post("/avis", payload);
      toast.success("Votre avis a été enregistré avec succès !");
      setShowAvisModal(false);
      setNoteAvis(5);
      setCommentaireAvis("");
      // Recharger les avis pour mettre à jour l'interface
      const resAvis = await api.get(`/avis/client/${user.id_utilisateur}`);
      setAvisList(Array.isArray(resAvis.data) ? resAvis.data : []);
    } catch (error) {
      console.error("Erreur soumission avis:", error);
    } finally {
      setSubmittingAvis(false);
    }
  };

  const [filtreVehicule, setFiltreVehicule] = useState("all");
  const vehiculesUniques = Array.isArray(vehicules) ? vehicules.map(v => v.immatriculation) : [];
  const interventionsFiltrées = Array.isArray(interventions) 
    ? interventions.filter(i => filtreVehicule === "all" || i.vehicule_immatriculation === filtreVehicule)
    : [];
  const showSide = !!selectedInter;

  // Récupérer l'avis existant pour l'intervention sélectionnée
  const avisExistant = selectedInter ? avisList.find(a => a.id_intervention === selectedInter.id_intervention) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes Interventions</h1>
          <p className="text-gray-500 text-sm">Suivez l'état d'avancement des réparations de vos véhicules.</p>
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
            <ToolIcon width="24" height="24" />
          </div>
        </div>
      </div>

      <div className={`flex flex-col ${showSide ? "lg:grid lg:grid-cols-3 lg:items-start" : ""} gap-4 sm:gap-6`}>

        <div className={`${showSide ? "lg:col-span-2" : ""} bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden`}>
        <GarageDataTable
          columns={[
            { 
              name: "Véhicule", 
              selector: row => `${row.vehicule_marque} ${row.vehicule_modele}`,
              cell: row => (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                    <CarIcon width="16" height="16" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{row.vehicule_immatriculation}</p>
                    <p className="text-[10px] text-gray-400 uppercase">{row.vehicule_marque} {row.vehicule_modele}</p>
                  </div>
                </div>
              )
            },
            { name: "Description", selector: row => row.description, grow: 2 },
            { name: "Mécanicien", selector: row => `${row.mecanicien_prenom_utilisateur} ${row.mecanicien_nom_utilisateur}` },
            { 
              name: "Statut", 
              selector: row => row.statut,
              cell: row => (
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  row.statut === "Terminé" ? "bg-green-100 text-green-700" : 
                  row.statut === "En cours" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {row.statut}
                </span>
              )
            },
            { name: "Date", selector: row => new Date(row.date_creation).toLocaleDateString("fr-FR") },
            { 
              name: "Actions", 
              right: true, 
              cell: row => (
                <button onClick={() => setSelectedInter(row)} className="px-4 py-2 bg-[#1E3A5F] text-white text-[10px] font-bold rounded-xl hover:bg-[#162E4D] transition-all">Détails</button>
              )
            }
          ]}
          data={interventionsFiltrées}
          loading={loading}
          onRowClicked={row => setSelectedInter(row)}
          conditionalRowStyles={[{ when: row => selectedInter?.id_intervention === row.id_intervention, style: { backgroundColor: "#eff6ff" } }]}
        />
        </div>

        {/* PANNEAU DE DÉTAILS */}
        {selectedInter && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6 lg:sticky lg:top-6 animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Intervention N°{selectedInter.id_intervention}</h2>
                        <p className="text-xs text-gray-400 font-mono italic">Du {new Date(selectedInter.date_creation).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => setSelectedInter(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">✕</button>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Véhicule</p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-600">
                            <CarIcon width="20" height="20" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800">{selectedInter.vehicule_immatriculation}</p>
                            <p className="text-xs text-gray-500">{selectedInter.vehicule_marque} {selectedInter.vehicule_modele}</p>
                        </div>
                    </div>
                </div>

                {/* BLOC AVIS (SI TERMINÉ) */}
                {selectedInter.statut === "Terminé" && (
                  <div className="border border-[#1E3A5F]/20 bg-[#1E3A5F]/5 rounded-2xl p-4">
                    {avisExistant ? (
                      <div>
                        <h3 className="text-sm font-bold text-[#1E3A5F] mb-1">Votre avis :</h3>
                        <div className="flex items-center gap-1 mb-2">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <span key={idx} className={`text-lg ${idx < avisExistant.note ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 italic">"{avisExistant.commentaire || 'Aucun commentaire'}"</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center space-y-2 py-2">
                        <p className="text-xs font-semibold text-gray-700">Cette intervention est terminée.</p>
                        <button 
                          onClick={() => setShowAvisModal(true)}
                          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold rounded-xl text-sm transition-all shadow-sm"
                        >
                          ⭐ Laisser un avis
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* DEVIS LIÉS */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <DevisIcon width="16" height="16" className="text-blue-500" />
                        <h3 className="text-sm font-bold text-gray-700">Devis associés</h3>
                    </div>
                    {(!selectedInter.devis || selectedInter.devis.length === 0) ? (
                        <p className="text-xs text-gray-400 italic bg-gray-50 rounded-xl p-3">Aucun devis lié à cette intervention.</p>
                    ) : (
                        <div className="space-y-2">
                            {selectedInter.devis.map(d => (
                                <div key={d.id_devis} className="border border-gray-100 rounded-2xl p-3 hover:shadow-sm transition-all bg-white group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">{d.reference}</p>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                d.statut === "confirme" ? "bg-green-100 text-green-700" :
                                                d.statut === "rejete" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                                            }`}>
                                                {d.statut}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-blue-600 font-mono">{(d.total || 0).toLocaleString()} FCFA</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FACTURES LIÉES */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <FactureIcon width="16" height="16" className="text-green-500" />
                        <h3 className="text-sm font-bold text-gray-700">Factures rattachées</h3>
                    </div>
                    {(!selectedInter.factures || selectedInter.factures.length === 0) ? (
                        <p className="text-xs text-gray-400 italic bg-gray-50 rounded-xl p-3">Aucune facture émise pour le moment.</p>
                    ) : (
                        <div className="space-y-2">
                            {selectedInter.factures.map(f => (
                                <div key={f.id_facture} className="border border-gray-100 rounded-2xl p-3 bg-white flex justify-between items-center shadow-sm">
                                    <div>
                                        <p className="text-xs font-bold text-gray-800">{f.reference}</p>
                                        <p className="text-[10px] text-gray-400 italic">{new Date(f.date_emission).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-green-600 font-mono">{(f.montant_total || 0).toLocaleString()} FCFA</p>
                                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${f.statut === "Payée" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{f.statut}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* MODAL LAISSER UN AVIS */}
      {showAvisModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Donner votre avis</h3>
              <button onClick={() => setShowAvisModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSoumettreAvis} className="p-6 space-y-6">
              <div className="flex flex-col items-center space-y-3">
                <p className="text-sm text-gray-600 font-semibold">Notez la prestation :</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNoteAvis(star)}
                      className={`text-4xl transition-transform hover:scale-110 ${star <= noteAvis ? 'text-yellow-400' : 'text-gray-200'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <p className="text-xs font-bold text-[#1E3A5F]">
                  {noteAvis === 1 ? 'Très déçu 😡' : noteAvis === 2 ? 'Déçu 😕' : noteAvis === 3 ? 'Correct 😐' : noteAvis === 4 ? 'Satisfait 🙂' : 'Très satisfait 🤩'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Commentaire (optionnel)</label>
                <textarea
                  value={commentaireAvis}
                  onChange={(e) => setCommentaireAvis(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] outline-none transition-all"
                  rows="4"
                  placeholder="Partagez votre expérience..."
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAvisModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingAvis}
                  className="flex-1 py-3 bg-yellow-400 text-yellow-950 font-bold rounded-xl hover:bg-yellow-500 transition-all text-sm flex items-center justify-center gap-2"
                >
                  {submittingAvis ? (
                    <div className="w-5 h-5 border-2 border-yellow-950/20 border-t-yellow-950 rounded-full animate-spin"></div>
                  ) : "Valider l'avis"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
