import React, { useState, useEffect } from "react";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import GarageDataTable from "../../components/DataTable.jsx";

export default function MesInterventions() {
  const [interventions, setInterventions] = useState([]);
  const [avisList, setAvisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("all"); // "all", "actives", "terminees"

  const fetchInterventions = async () => {
    setLoading(true);
    try {
      const [resInter, resAvis] = await Promise.all([
        api.get("/interventions"),
        api.get("/avis")
      ]);
      setInterventions(resInter.data);
      setAvisList(resAvis.data);
    } catch (err) {
      toast.error("Erreur lors du chargement des interventions");
      console.error("Erreur chargement interventions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterventions();
    const interval = setInterval(fetchInterventions, 30000);
    return () => clearInterval(interval);
  }, []);

  // Modal statut
  const [selectedInter, setSelectedInter] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCloture, setShowCloture] = useState(false);
  const [kilometrage, setKilometrage] = useState("");
  const [notes, setNotes] = useState("");

  const [showHistory, setShowHistory] = useState(false);
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyVehiculeInfo, setHistoryVehiculeInfo] = useState(null);

  const handleOpenHistory = async (inter) => {
    setHistoryVehiculeInfo(inter);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/vehicules/${inter.id_vehicule}/reparations`);
      setVehicleHistory(res.data);
    } catch (e) {
      toast.error("Impossible de charger l'historique");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenModal = (inter) => {
    setSelectedInter(inter);
    setNewStatus(inter.statut);
    setShowModal(true);
    setShowCloture(false);
    setKilometrage("");
    setNotes("");
    setNotes("");
  };

  const handleSaveStatus = async () => {
    if (!selectedInter) return;
    setSaving(true);
    try {
      if (newStatus === "Terminé") {
        setShowCloture(true);
        setSaving(false);
        return;
      }
      await api.put(`/interventions/${selectedInter.id_intervention}/statut`, null, {
        params: { statut: newStatus },
      });
      fetchInterventions();
      setShowModal(false);
      toast.success("Statut mis à jour !");
    } catch (err) {
      toast.error("Erreur lors de la mise à jour du statut");
      console.error("Erreur mise à jour statut", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCloturer = async () => {
    if (!kilometrage) { toast.error("Le kilométrage est obligatoire !"); return; }
    if (!notes || notes.length < 5) { toast.error("Veuillez saisir des observations détaillées."); return; }

    setSaving(true);
    try {
      await api.post(`/interventions/${selectedInter.id_intervention}/cloturer`, {
        id_vehicule: selectedInter.id_vehicule,
        description: selectedInter.description,
        kilometrage: parseInt(kilometrage) || 0,
        montant: 0,
        notes: notes,
        statut: "Terminé",
        reference: `REP-${selectedInter.id_intervention}-${Date.now().toString().slice(-4)}`,
      });
      fetchInterventions();
      setShowModal(false);
      setShowCloture(false);
      toast.success("Intervention clôturée et réparation enregistrée !");
    } catch (err) {
      toast.error("Erreur lors de la clôture de l'intervention");
      console.error("Erreur clôture", err);
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: interventions.length,
    enAttente: interventions.filter((i) => i.statut === "En attente").length,
    enCours: interventions.filter((i) => i.statut === "En cours").length,
    termine: interventions.filter((i) => i.statut === "Terminé").length,
  };

  const displayed =
    filtre === "actives"
      ? interventions.filter((i) => i.statut !== "Terminé" && i.statut !== "Annulé")
      : filtre === "terminees"
        ? interventions.filter((i) => i.statut === "Terminé" || i.statut === "Annulé")
        : interventions;

  const getBadge = (statut) => {
    if (statut === "En attente") return <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Urgent</span>;
    if (statut === "En cours") return <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">En Cours</span>;
    if (statut === "En pause") return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">En Pause</span>;
    if (statut === "Terminé") return <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Terminé</span>;
    return <span className="bg-red-100 text-red-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{statut}</span>;
  };

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes Interventions</h1>
        </div>
        <button
          onClick={fetchInterventions}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          Rafraîchir
        </button>
      </div>

      {/* Cartes stat */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Total</p>
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 shadow-sm">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2">En Attente</p>
          <p className="text-3xl font-bold text-orange-600">{stats.enAttente}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">En Cours</p>
          <p className="text-3xl font-bold text-blue-600">{stats.enCours}</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-5 border border-green-100 shadow-sm">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">Terminé</p>
          <p className="text-3xl font-bold text-green-600">{stats.termine}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all", label: "Toutes" },
          { key: "actives", label: "Actives" },
          { key: "terminees", label: "Terminées" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltre(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtre === key
                ? "bg-[#1E3A5F] text-white shadow-md"
                : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          <GarageDataTable
            columns={[
              {
                name: "Véhicule",
                selector: (row) => row.vehicule_immatriculation,
                sortable: true,
                cell: (row) => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#EEF2F6] flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-[#1E3A5F] text-sm">{row.vehicule_immatriculation}</p>
                      <p className="text-[10px] text-gray-400">{row.vehicule_marque} {row.vehicule_modele}</p>
                    </div>
                  </div>
                ),
              },
              {
                name: "Client",
                selector: (row) => `${row.client_prenom_utilisateur} ${row.client_nom_utilisateur}`,
                sortable: true,
                cell: (row) => (
                  <span className="text-sm text-gray-600">{row.client_prenom_utilisateur} {row.client_nom_utilisateur}</span>
                ),
              },
              {
                name: "Problème",
                selector: (row) => row.description,
                sortable: true,
                cell: (row) => (
                  <span className="text-sm text-gray-500 truncate max-w-[200px]">{row.description}</span>
                ),
              },
              {
                name: "Statut",
                selector: (row) => row.statut,
                sortable: true,
                cell: (row) => getBadge(row.statut),
              },
              {
                name: "Avis Client",
                selector: (row) => {
                   const a = avisList.find(a => a.id_intervention === row.id_intervention);
                   return a ? a.note : 0;
                },
                sortable: true,
                cell: (row) => {
                  if (row.statut !== "Terminé") return <span className="text-[10px] text-gray-300 italic">—</span>;
                  const avis = avisList.find(a => a.id_intervention === row.id_intervention);
                  if (!avis) return <span className="text-[10px] text-gray-400 italic">En attente</span>;
                  return (
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <span key={idx} className={`text-sm ${idx < avis.note ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                        ))}
                      </div>
                      {avis.commentaire && <span className="text-[10px] text-gray-500 truncate max-w-[120px]" title={avis.commentaire}>"{avis.commentaire}"</span>}
                    </div>
                  );
                }
              },
              {
                name: "Date",
                selector: (row) => row.date_creation,
                sortable: true,
                cell: (row) => (
                  <span className="text-xs text-gray-400">
                    {new Date(row.date_creation).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                ),
              },
              {
                name: "Actions",
                button: true,
                minWidth: "180px",
                cell: (row) => (
                  <div className="flex items-center gap-2 flex-nowrap">
                    <button
                      onClick={() => handleOpenHistory(row)}
                      className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all border border-blue-200 whitespace-nowrap"
                    >
                      🔧 Historique
                    </button>
                    {row.statut !== "Terminé" && row.statut !== "Annulé" ? (
                      <button
                        onClick={() => handleOpenModal(row)}
                        className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap"
                      >
                        Modifier
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-300 font-medium py-1.5 whitespace-nowrap">Clôturée</span>
                    )}
                  </div>
                ),
              },
            ]}
            data={displayed}
            noDataMessage={
              filtre === "actives"
                ? "Aucune intervention active en ce moment."
                : filtre === "terminees"
                  ? "Aucune intervention terminée."
                  : "Aucune intervention ne vous est encore assignée."
            }
          />
        )}
      </div>

      {/* MODAL HISTORIQUE VÉHICULE */}
      {showHistory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1E3A5F]/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-[#1E3A5F] p-8 text-white relative">
              <button onClick={() => setShowHistory(false)} className="absolute top-6 right-8 text-white/50 hover:text-white transition-all text-xl">✕</button>
              <div className="flex items-center gap-4 mb-2">
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-lg border border-white/20">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Détails Véhicule</h3>
                  <p className="text-blue-100/60 font-medium">{historyVehiculeInfo?.vehicule_immatriculation} — {historyVehiculeInfo?.vehicule_marque} {historyVehiculeInfo?.vehicule_modele}</p>
                </div>
              </div>
            </div>

            <div className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <h4 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                Antécédents de réparations
              </h4>

              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-400 font-medium">Récupération des données...</p>
                </div>
              ) : vehicleHistory.length > 0 ? (
                <div className="space-y-6">
                  {vehicleHistory.map((rep, idx) => (
                    <div key={idx} className="relative pl-8 pb-4 border-l-2 border-gray-100 last:border-0 last:pb-0">
                      <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-blue-500 shadow-sm"></div>
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-blue-200 transition-colors group">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                              {new Date(rep.date_debut || rep.created_at).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long', year: 'numeric' })}
                              <span className="ml-2 lowercase font-medium text-gray-400">à {new Date(rep.date_debut || rep.created_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-100">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                            {rep.kilometrage?.toLocaleString()} KM
                          </div>
                        </div>
                        <h5 className="font-bold text-gray-800 mb-2 truncate group-hover:text-blue-700 transition-colors uppercase text-sm tracking-tight">{rep.description}</h5>

                        <div className="bg-white rounded-xl p-3 text-xs text-gray-500 italic border border-gray-100 leading-relaxed mb-3">
                          "{rep.notes || "Aucune observation technique."}"
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-600 font-bold">
                            {rep.technicien?.charAt(0) || "M"}
                          </div>
                          <p className="text-[10px] font-semibold text-gray-500">Par {rep.technicien || "Mécanicien inconnu"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                  <p className="text-gray-400 font-medium italic">Aucun antécédent technique connu pour ce véhicule.</p>
                </div>
              )}
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowHistory(false)}
                className="px-10 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-200 hover:border-gray-300 transition-all shadow-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODIFIER STATUT */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-800">Modifier le statut</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selectedInter?.vehicule_immatriculation} — {selectedInter?.client_prenom_utilisateur} {selectedInter?.client_nom_utilisateur}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {!showCloture ? (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nouveau statut</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="En attente">En attente</option>
                      <option value="En cours">En cours</option>
                      <option value="En pause">En pause</option>
                      <option value="Terminé">Terminé (Clôturer l'intervention)</option>
                    </select>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-500 border border-gray-100">
                    <p className="font-semibold text-gray-700 mb-1">Problème signalé</p>
                    <p className="italic">{selectedInter?.description}</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveStatus}
                      disabled={saving}
                      className="flex-1 px-4 py-3 bg-[#1E3A5F] text-white rounded-xl font-bold text-sm hover:bg-[#162e4d] shadow-md transition-all disabled:opacity-50"
                    >
                      {saving ? "..." : "Valider"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                    <p className="text-xs text-blue-700 font-bold uppercase tracking-widest mb-1">Clôture de l'intervention</p>
                    <p className="text-xs text-blue-600">Renseignez les détails de la réparation avant de confirmer.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Kilométrage actuel</label>
                    <input
                      type="number"
                      placeholder="Ex: 125 000"
                      value={kilometrage}
                      onChange={(e) => setKilometrage(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Activités menées & Observations</label>
                    <textarea
                      rows="3"
                      placeholder="Travaux effectués, pièces remplacées, points de vigilance..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowCloture(false)}
                      className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all whitespace-nowrap"
                    >
                      Retour
                    </button>
                    <button
                      onClick={handleCloturer}
                      disabled={saving}
                      className="flex-1 px-4 py-3 bg-[#1E3A5F] text-white rounded-xl font-bold text-sm hover:bg-[#162e4d] shadow-lg shadow-blue-500/10 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      {saving ? "Enregistrement..." : "Valider"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
