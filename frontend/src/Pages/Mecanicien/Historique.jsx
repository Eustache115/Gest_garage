import React, { useState, useEffect } from "react";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import GarageDataTable from "../../components/DataTable.jsx";

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export default function Historique() {
  const [interventions, setInterventions] = useState([]);
  const [avisList, setAvisList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dates par défaut : du 1er du mois en cours à aujourd'hui
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  const [dateDebut, setDateDebut] = useState(firstDay);
  const [dateFin, setDateFin] = useState(today);
  const [vehicules, setVehicules] = useState([]);
  const [filtreVehicule, setFiltreVehicule] = useState("all");

  // State pour les détails d'une réparation
  const [selectedRep, setSelectedRep] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // State pour l'ajout manuel
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRepair, setNewRepair] = useState({
    id_vehicule: "",
    kilometrage: "",
    description: "",
    notes: "",
    montant: 0
  });
  const [adding, setAdding] = useState(false);
  const [editingRep, setEditingRep] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRepairData, setEditRepairData] = useState({
    description: "",
    kilometrage: "",
    notes: "",
    montant: 0
  });

  useEffect(() => {
    fetchInterventions();
    fetchVehicules();
  }, []);

  const fetchVehicules = async () => {
    try {
      const res = await api.get("/vehicules");
      setVehicules(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erreur chargement véhicules", err);
    }
  };

  const fetchInterventions = async () => {
    setLoading(true);
    try {
      const [resRep, resAvis] = await Promise.all([
        api.get("/reparations"),
        api.get("/avis")
      ]);
      setInterventions(Array.isArray(resRep.data) ? resRep.data : []);
      setAvisList(Array.isArray(resAvis.data) ? resAvis.data : []);
    } catch (err) {
      console.error("Erreur chargement historique", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRepair = async () => {
    setAdding(true);
    try {
      if (!newRepair.id_vehicule) {
        toast.error("Veuillez sélectionner un véhicule.");
        setAdding(false);
        return;
      }

      await api.post("/reparations", {
        id_vehicule: parseInt(newRepair.id_vehicule),
        description: newRepair.description,
        kilometrage: parseInt(newRepair.kilometrage) || 0,
        notes: newRepair.notes,
        montant: parseFloat(newRepair.montant) || 0,
        statut: "Terminé",
        reference: `REPM-${Date.now().toString().slice(-4)}`
      });

      setShowAddModal(false);
      setNewRepair({ id_vehicule: "", kilometrage: "", description: "", notes: "", montant: 0 });
      fetchInterventions();
      toast.success("Réparation ajoutée avec succès !");
    } catch (err) {
      console.error("Erreur ajout manuel", err);
      toast.error("Erreur lors de l'ajout.");
    } finally {
      setAdding(false);
    }
  };

  const handleEditRepair = async () => {
    setAdding(true);
    try {
      await api.put(`/reparations/${editingRep.id_reparation}`, {
        description: editRepairData.description,
        kilometrage: parseInt(editRepairData.kilometrage) || 0,
        notes: editRepairData.notes,
        montant: parseFloat(editRepairData.montant) || 0,
      });

      setShowEditModal(false);
      fetchInterventions();
      toast.success("Réparation mise à jour !");
    } catch (err) {
      console.error("Erreur modification", err);
      toast.error("Erreur lors de la modification.");
    } finally {
      setAdding(false);
    }
  };

  const openEditModal = (rep) => {
    setEditingRep(rep);
    setEditRepairData({
      description: rep.description,
      kilometrage: rep.kilometrage || "",
      notes: rep.notes || "",
      montant: rep.montant || 0
    });
    setShowEditModal(true);
  };

  const formatDateString = (d) => {
    if (!d) return "-";
    const dateObj = new Date(d);
    return dateObj.toLocaleDateString("fr-FR", { day: '2-digit', month: 'long', year: 'numeric' });
  };

  // Logique de filtrage
  const safeInterventions = Array.isArray(interventions) ? interventions : [];
  const animationsData = safeInterventions.filter(rep => {
    if (filtreVehicule !== "all" && rep.vehicule_immatriculation !== filtreVehicule) return false;
    const rawDate = rep.date_debut || rep.created_at;
    if (!rawDate) return false;
    const repDate = new Date(rawDate).toISOString().split('T')[0];
    if (dateDebut && repDate < dateDebut) return false;
    if (dateFin && repDate > dateFin) return false;
    return true;
  }).sort((a, b) => new Date(b.date_debut || b.created_at) - new Date(a.date_debut || a.created_at));

  if (loading) return <TableSkeleton rows={10} />;

  return (
    <div className="font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Historique des Réparations</h1>
          <p className="text-sm text-gray-400 mt-1">Consultez l'ensemble des interventions terminées</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={fetchInterventions}
            className="p-2.5 bg-white border border-gray-200 text-gray-400 rounded-xl hover:text-[#1E3A5F] transition-all shadow-sm"
            title="Rafraîchir"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#1E3A5F] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#162e4d] transition-all shadow-lg flex items-center gap-2 active:scale-95"
          >
            <PlusIcon />
            Ajouter manuellement
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Filtre par véhicule */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Véhicule</label>
            <select
              value={filtreVehicule}
              onChange={e => setFiltreVehicule(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-semibold focus:outline-none focus:border-[#1E3A5F] cursor-pointer min-w-[200px]"
            >
              <option value="all">Tous les véhicules</option>
              {vehicules.map(v => (
                <option key={v.id_vehicule} value={v.immatriculation}>
                  {v.immatriculation} — {v.marque} {v.modele}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre par date */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Période</label>
            <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <input
                type="date"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
                className="bg-transparent text-sm text-gray-600 outline-none"
              />
              <span className="mx-2 text-gray-400">À</span>
              <input
                type="date"
                value={dateFin}
                onChange={e => setDateFin(e.target.value)}
                className="bg-transparent text-sm text-gray-600 outline-none"
              />
            </div>
          </div>

          {filtreVehicule !== "all" && (
            <button
              onClick={() => setFiltreVehicule("all")}
              className="text-xs font-bold text-[#1E3A5F] bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-all"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <GarageDataTable
          columns={[
            { name: "Réf.", selector: row => row.reference, sortable: true, width: "110px", cell: row => <span className="font-bold text-[#1E3A5F] text-xs uppercase">{row.reference}</span> },
            {
              name: "Véhicule", selector: row => row.vehicule_immatriculation, sortable: true, cell: row => (
                <div className="flex flex-col py-2">
                  <span className="font-bold text-[#1E3A5F] text-sm">{row.vehicule_immatriculation}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{row.client_prenom_utilisateur} {row.client_nom_utilisateur}</span>
                </div>
              )
            },
            { name: "Description", selector: row => row.description, sortable: true, cell: row => <span className="truncate max-w-[200px] text-gray-500 text-sm italic">"{row.description}"</span> },
            {
              name: "Technicien", selector: row => row.technicien, sortable: true, cell: row => (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-600 font-bold">{row.technicien?.charAt(0) || "M"}</div>
                  <span className="text-xs text-gray-600 font-medium">{row.technicien || "—"}</span>
                </div>
              )
            },
            {
              name: "Kilométrage", selector: row => row.kilometrage, sortable: true, cell: row => (
                <span className="text-xs font-bold text-gray-700">{row.kilometrage ? `${row.kilometrage.toLocaleString()} KM` : "—"}</span>
              ), width: "120px"
            },
            {
              name: "Date & Heure", selector: row => row.date_debut, sortable: true, cell: row => {
                const d = new Date(row.date_debut || row.created_at);
                return (
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-700 font-semibold">{d.toLocaleDateString("fr-FR")}</span>
                    <span className="text-[10px] text-gray-400">à {d.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit'})}</span>
                  </div>
                );
              }
            },
            {
              name: "Actions", button: true, width: "160px", cell: row => (
                <div className="flex items-center gap-2 flex-nowrap">
                  <button
                    onClick={() => { setSelectedRep(row); setShowDetails(true); }}
                    className="bg-gray-100 hover:bg-gray-200 text-[#1E3A5F] px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap"
                  >
                    Détails
                  </button>
                  <button
                    onClick={() => openEditModal(row)}
                    className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap"
                  >
                    Modifier
                  </button>
                </div>
              )
            }
          ]}
          data={animationsData}
          noDataMessage={filtreVehicule !== "all" ? `Aucune réparation pour ${filtreVehicule} sur cette période.` : "Aucun historique trouvé pour les critères sélectionnés."}
        />
      </div>

      {/* MODAL DÉTAILS */}
      {showDetails && selectedRep && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 bg-gradient-to-r from-[#1E3A5F] to-[#162E4D] text-white">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-lg font-bold">Réparation {selectedRep.reference}</h3>
                <button onClick={() => setShowDetails(false)} className="text-white/60 hover:text-white transition-all text-xl">✕</button>
              </div>
              <p className="text-white/60 text-xs">Détails de l'intervention technique</p>
            </div>

            <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Véhicule</h4>
                  <p className="text-sm font-bold text-[#1E3A5F]">{selectedRep.vehicule_immatriculation}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Client</h4>
                  <p className="text-sm font-semibold">{selectedRep.client_prenom_utilisateur} {selectedRep.client_nom_utilisateur}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mécanicien</h4>
                  <p className="text-sm font-semibold">{selectedRep.technicien || "Non renseigné"}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kilométrage</h4>
                  <p className="text-sm font-semibold">{selectedRep.kilometrage ? `${selectedRep.kilometrage.toLocaleString()} KM` : "Non renseigné"}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date début</h4>
                  <p className="text-sm font-semibold">{formatDateString(selectedRep.date_debut)}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date fin</h4>
                  <p className="text-sm font-semibold">{selectedRep.date_fin ? formatDateString(selectedRep.date_fin) : "—"}</p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Description</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{selectedRep.description}</p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes du technicien</h4>
                  <p className="text-sm p-4 bg-amber-50 text-amber-800 rounded-2xl italic border border-amber-100">
                    {selectedRep.notes || "Aucune note technique enregistrée."}
                  </p>
                </div>
                {/* Avis du client */}
                {(() => {
                  if (!selectedRep.reference) return null;
                  const parts = selectedRep.reference.split('-');
                  if (parts.length < 2 || parts[0] !== 'REP') return null;
                  const interId = parseInt(parts[1]);
                  const avis = avisList.find(a => a.id_intervention === interId);
                  if (!avis) return null;
                  return (
                    <div className="col-span-2 bg-yellow-50 rounded-xl p-4 border border-yellow-100 mt-2">
                      <p className="text-xs font-bold text-yellow-600 mb-1 flex items-center gap-1">
                        <span>⭐ Évaluation du client sur votre prestation</span>
                      </p>
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <span key={idx} className={`text-lg ${idx < avis.note ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                        ))}
                        <span className="text-sm font-bold text-yellow-700 ml-2">{avis.note}/5</span>
                      </div>
                      {avis.commentaire && (
                        <p className="text-sm text-gray-700 italic mt-2">"{avis.commentaire}"</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all shadow-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJOUT MANUEL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Ajouter une réparation</h3>
                <p className="text-xs text-gray-400 font-medium">Saisie manuelle d'historique</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-300 hover:text-gray-500 transition-all text-xl">✕</button>
            </div>

            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Véhicule</label>
                  <select
                    value={newRepair.id_vehicule}
                    onChange={e => setNewRepair({ ...newRepair, id_vehicule: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all font-bold text-[#1E3A5F] cursor-pointer"
                  >
                    <option value="">-- Sélectionner --</option>
                    {vehicules.map(v => (
                      <option key={v.id_vehicule} value={v.id_vehicule}>
                        {v.immatriculation} — {v.marque} {v.modele}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Kilométrage</label>
                  <input
                    type="number"
                    placeholder="Ex: 105000"
                    value={newRepair.kilometrage}
                    onChange={e => setNewRepair({ ...newRepair, kilometrage: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all placeholder-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Description courte</label>
                <input
                  type="text"
                  placeholder="Ex: Vidange et filtre à huile"
                  value={newRepair.description}
                  onChange={e => setNewRepair({ ...newRepair, description: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all placeholder-gray-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Notes détaillées</label>
                <textarea
                  rows="3"
                  placeholder="Précisez les travaux effectués..."
                  value={newRepair.notes}
                  onChange={e => setNewRepair({ ...newRepair, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all resize-none placeholder-gray-300"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddRepair}
                  disabled={adding || !newRepair.id_vehicule || !newRepair.description}
                  className="flex-[2] px-4 py-3.5 bg-[#1E3A5F] text-white rounded-2xl font-bold text-sm hover:bg-[#162e4d] shadow-lg shadow-blue-500/10 transition-all disabled:opacity-50"
                >
                  {adding ? "Enregistrement..." : "Valider"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODIFICATION */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Modifier la réparation</h3>
                <p className="text-xs text-gray-400 font-medium">Mise à jour des informations techniques</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-300 hover:text-gray-500 transition-all text-xl">✕</button>
            </div>

            <div className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Description courte</label>
                <input
                  type="text"
                  value={editRepairData.description}
                  onChange={e => setEditRepairData({ ...editRepairData, description: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all font-bold text-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Kilométrage</label>
                <input
                  type="number"
                  value={editRepairData.kilometrage}
                  onChange={e => setEditRepairData({ ...editRepairData, kilometrage: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all font-bold text-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Montant (FCFA)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editRepairData.montant}
                  onChange={e => setEditRepairData({ ...editRepairData, montant: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all font-bold text-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Notes détaillées</label>
                <textarea
                  rows="4"
                  value={editRepairData.notes}
                  onChange={e => setEditRepairData({ ...editRepairData, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all resize-none font-medium"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleEditRepair}
                  disabled={adding || !editRepairData.description}
                  className="flex-[2] px-4 py-3.5 bg-[#1E3A5F] text-white rounded-2xl font-bold text-sm hover:bg-[#162e4d] shadow-lg shadow-blue-500/10 transition-all disabled:opacity-50"
                >
                  {adding ? "Enregistrement..." : "Valider"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
