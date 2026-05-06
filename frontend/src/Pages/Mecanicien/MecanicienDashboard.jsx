import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import GarageDataTable from "../../components/DataTable.jsx";

export default function MecanicienDashboard() {
  const navigate = useNavigate();
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);

  // State pour la modal de modification de statut
  const [selectedInter, setSelectedInter] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pour la clôture (Reparation)
  const [showCloture, setShowCloture] = useState(false);
  const [kilometrage, setKilometrage] = useState("");
  const [notes, setNotes] = useState("");

  const fetchInterventions = async () => {
    try {
      const res = await api.get("/interventions");
      setInterventions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erreur chargement", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterventions();
    const interval = setInterval(fetchInterventions, 30000);
    return () => clearInterval(interval);
  }, []);

  const rafraichir = () => {
    setLoading(true);
    fetchInterventions();
  };

  if (loading) return <TableSkeleton rows={6} />;

  const safeInterventions = Array.isArray(interventions) ? interventions : [];

  const stats = {
    enAttente: safeInterventions.filter(i => i.statut === "En attente").length,
    enCours: safeInterventions.filter(i => i.statut === "En cours").length,
    termine: safeInterventions.filter(i => i.statut === "Terminé").length,
  };

  const actives = safeInterventions.filter(i => i.statut !== "Terminé" && i.statut !== "Annulé");

  const handleOpenModal = (inter) => {
    setSelectedInter(inter);
    setNewStatus(inter.statut);
    setShowModal(true);
    setShowCloture(false);
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
        params: { statut: newStatus }
      });
      rafraichir();
      setShowModal(false);
      toast.success("Statut mis à jour !");
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
      console.error("Erreur mise à jour statut", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCloturer = async () => {
    setSaving(true);
    try {
      await api.post(`/interventions/${selectedInter.id_intervention}/cloturer`, {
        id_vehicule: selectedInter.id_vehicule,
        description: selectedInter.description,
        kilometrage: parseInt(kilometrage) || 0,
        notes: notes,
        statut: "Terminé",
        reference: `REP-${selectedInter.id_intervention}-${Date.now().toString().slice(-4)}`
      });
      rafraichir();
      setShowModal(false);
      setShowCloture(false);
      toast.success("Réparation enregistrée et intervention clôturée !");
    } catch (err) {
      toast.error("Erreur lors de la clôture");
      console.error("Erreur clôture", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mon Espace Travail</h1>
        </div>
        <button
          onClick={rafraichir}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-700 text-sm hover:bg-gray-50 transition-all font-bold group"
        >
          <svg className={`w-4 h-4 text-gray-400 group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Rafraîchir
        </button>
      </div>

      {/* Cartes de statistiques style Admin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Interventions en Attente"
          value={stats.enAttente}
          color="bg-gradient-to-br from-orange-400 to-orange-600"
          icon={<div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>}
        />
        <StatCard
          title="Travaux en Cours"
          value={stats.enCours}
          color="bg-gradient-to-br from-blue-500 to-blue-700"
          icon={<svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
        <StatCard
          title="Réparations Terminées"
          value={stats.termine}
          color="bg-gradient-to-br from-green-500 to-green-600"
          icon={<svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
        />
        {/* Colonnes vides pour maintenir la taille des cartes identique à l'Admin */}
        <div className="hidden lg:block"></div>
        <div className="hidden lg:block"></div>
      </div>

      {/* Tableau des interventions actives */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Mes Interventions</h2>
        </div>
        <GarageDataTable
          loading={loading}
          columns={[
            {
              name: "Véhicule", selector: row => row.vehicule_immatriculation, cell: row => (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                  </div>
                  <span className="font-bold text-[#1E3A5F]">{row.vehicule_immatriculation}</span>
                </div>
              ), sortable: true
            },
            {
              name: "Client", selector: row => `${row.client_prenom_utilisateur} ${row.client_nom_utilisateur}`, sortable: true, cell: row => (
                <span className="text-gray-600 truncate">{row.client_prenom_utilisateur} {row.client_nom_utilisateur}</span>
              )
            },
            { name: "Problème", selector: row => row.description, sortable: true, cell: row => <span className="truncate max-w-[150px] text-gray-500">{row.description}</span> },
            {
              name: "Statut", selector: row => row.statut, sortable: true, cell: row => {
                if (row.statut === "En attente") return <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Urgent</span>;
                if (row.statut === "En pause") return <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">En Pause</span>;
                return <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">En Cours</span>;
              }
            },
            {
              name: "Actions", button: true, cell: row => (
                <button
                  onClick={() => handleOpenModal(row)}
                  className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  Modifier
                </button>
              )
            }
          ]}
          data={actives}
          noDataMessage="Aucune intervention active"
        />
      </div>

      {/* MODAL MODIFIER STATUT */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800">Modifier statut</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!showCloture ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Nouveau statut</label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="En attente">En attente</option>
                      <option value="En cours">En cours</option>
                      <option value="En pause">En pause</option>
                      <option value="Terminé">Terminé (Clôturer)</option>
                    </select>
                  </div>
                  <div className="flex gap-3 mt-8">
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveStatus}
                      disabled={saving}
                      className="flex-1 px-4 py-3 bg-[#1E3A5F] text-white rounded-xl font-bold text-sm hover:bg-[#162e4d] shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                      {saving ? "..." : "Valider"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right duration-300">
                  <div className="bg-blue-50 p-4 rounded-2xl mb-2">
                    <p className="text-[11px] text-blue-700 font-bold uppercase tracking-wider mb-1">Clôture technique</p>
                    <p className="text-sm text-blue-900 font-bold">{selectedInter?.vehicule_immatriculation}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Kilométrage actuel <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      placeholder="Kilométrage du véhicule"
                      value={kilometrage}
                      onChange={e => setKilometrage(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1E3A5F] transition-all font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Notes de réparation <span className="text-red-500">*</span></label>
                    <textarea
                      rows="4"
                      placeholder="Décrivez les travaux effectués, les pièces changées, etc."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1E3A5F] transition-all resize-none font-medium"
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => { setShowCloture(false); setNewStatus(selectedInter.statut); }}
                      className="flex-1 px-4 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleCloturer}
                      disabled={saving || !kilometrage || !notes}
                      className="flex-[2] px-4 py-3.5 bg-green-600 text-white rounded-2xl font-bold text-sm hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          Finaliser la réparation
                        </>
                      )}
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

function StatCard({ title, value, color, icon }) {
  return (
    <div className={`${color} text-white p-4 rounded-3xl shadow-lg transition-all duration-300 relative h-24 flex flex-col justify-between group overflow-hidden`}>
      <div className="relative z-10">
        <p className="text-[11px] font-bold text-white/80 leading-tight uppercase tracking-tight">{title}</p>
      </div>
      <div className="flex justify-between items-end relative z-10">
        <h3 className="text-xl font-black">{value}</h3>
        {icon && <div className="mb-0 scale-75 opacity-80">{icon}</div>}
      </div>

      {/* Effet vitrail discret */}
      <div className="absolute right-0 bottom-0 w-20 h-20 bg-white/5 rounded-tl-full -mr-10 -mb-10 group-hover:scale-110 transition-transform duration-500"></div>
    </div>
  );
}

