import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext.jsx";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import GarageDataTable from "../../components/DataTable.jsx";
import { RendezvousIcon, PlusIcon, CarIcon } from "../../components/icons/AllIcon.jsx";

export default function ClientRendezvous() {
  const { user } = useAuth();
  const [rdv, setRDV] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id_vehicule: "",
    date_heure: "",
    motif: "",
    notes: ""
  });

  // État pour la proposition alternative
  const [selectedAltRDV, setSelectedAltRDV] = useState(null);

  const fetchData = async () => {
    try {
      const [resRDV, resVehicules] = await Promise.all([
        api.get(`/rendezvous/client/${user.id_utilisateur}`),
        api.get(`/clients/${user.id_utilisateur}/vehicules`),
      ]);
      setRDV(Array.isArray(resRDV.data) ? resRDV.data : []);
      setVehicules(resVehicules.data);
    } catch (error) {
      console.error("Erreur RDV client:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id_utilisateur]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/rendezvous", {
        ...formData,
        id_vehicule: formData.id_vehicule ? parseInt(formData.id_vehicule) : null,
        id_client: user.id_utilisateur,
        statut: "En attente"
      });
      setShowModal(false);
      setFormData({ id_vehicule: "", date_heure: "", motif: "", notes: "" });
      fetchData();
      toast.success("Rendez-vous enregistré !");
    } catch (error) {
      toast.error("Erreur lors de la prise de rendez-vous.");
    }
  };

  const handleRowClick = (row) => {
    if (row.statut === "Rejeté" && row.date_alternative) {
      setSelectedAltRDV(row);
    }
  };

  const accepterAlternative = async () => {
    if (!selectedAltRDV) return;
    try {
      await api.put(`/rendezvous/${selectedAltRDV.id_rendezvous}/accepter_alternative`);
      toast.success("Rendez-vous re-confirmé avec la nouvelle date !");
      setSelectedAltRDV(null);
      fetchData();
    } catch (e) {
      toast.error("Erreur lors de la validation.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Modale de Proposition Alternative (Popup) */}
      {selectedAltRDV && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-orange-500 p-8 text-white relative">
               <button onClick={() => setSelectedAltRDV(null)} className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-all">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
               </button>
               <h2 className="text-2xl font-bold font-serif">Nouvelle Proposition</h2>
               <p className="text-orange-100 text-sm opacity-90 mt-1 uppercase tracking-widest font-bold">Le garage vous répond</p>
            </div>
            
            <div className="p-8 space-y-6">
               <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Message de l'administrateur</p>
                  <p className="text-gray-700 italic text-sm">"{selectedAltRDV.reponse_admin || "Nous vous proposons ce nouveau créneau pour votre intervention."}"</p>
               </div>

               <div className="flex flex-col items-center justify-center p-6 bg-orange-50 rounded-3xl border-2 border-dashed border-orange-200">
                  <p className="text-xs font-bold text-orange-600 mb-2 uppercase">Nouvelle date suggérée</p>
                  <div className="flex flex-col items-center">
                    <p className="text-xl font-black text-gray-800">{new Date(selectedAltRDV.date_alternative).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <p className="text-4xl font-black text-orange-600 font-mono mt-1">{new Date(selectedAltRDV.date_alternative).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
               </div>

               <div className="flex flex-col gap-3">
                  <button 
                    onClick={accepterAlternative}
                    className="w-full py-5 bg-[#1E3A5F] text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 hover:bg-[#162e4d] transition-all active:scale-[0.98] uppercase tracking-widest"
                  >
                    Accepter ce créneau
                  </button>
                  <button 
                    onClick={() => setSelectedAltRDV(null)}
                    className="w-full py-3 text-gray-400 font-bold hover:text-gray-600 transition-all text-xs"
                  >
                    Voir plus tard
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes Rendez-vous</h1>
          <p className="text-gray-500 text-sm">Gérez vos rendez-vous et planifiez vos prochaines visites.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95"
        >
          <PlusIcon width="16" height="16" /> Nouveau Rendez-vous
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <GarageDataTable
          columns={[
            { name: "Date & Heure", selector: row => new Date(row.date_heure).toLocaleString("fr-FR"), cell: row => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                   <RendezvousIcon width="16" height="16" />
                </div>
                <p className="font-bold text-gray-800">{new Date(row.date_heure).toLocaleString("fr-FR", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )},
            { name: "Véhicule", selector: row => row.vehicule_immatriculation || "Non spécifié" },
            { name: "Motif", selector: row => row.motif, grow: 2 },
            { name: "Statut", selector: row => row.statut, cell: row => (
              <div className="flex flex-col gap-1">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit ${
                  row.statut === "Confirmé" ? "bg-green-100 text-green-700" : 
                  row.statut === "Rejeté" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {row.statut}
                </span>
                {row.statut === "Rejeté" && row.date_alternative && (
                  <span className="text-[9px] font-black text-orange-500 animate-pulse uppercase">
                    ⚠️ Proposition reçue
                  </span>
                )}
              </div>
            )},
            { name: "Actions", right: true, cell: row => (
              <div className="flex items-center gap-2">
                {row.statut === "Rejeté" && row.date_alternative && (
                  <div className="px-3 py-1 bg-orange-500 text-white text-[10px] font-bold rounded-lg animate-bounce shadow-sm cursor-help" title="Cliquez sur la ligne pour voir">
                    Détails
                  </div>
                )}
                {row.statut === "En attente" && (
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm("Annuler ce rendez-vous ?")) return;
                      try {
                        await api.delete(`/rendezvous/${row.id_rendezvous}`);
                        toast.success("Rendez-vous annulé.");
                        fetchData();
                      } catch {
                        toast.error("Erreur lors de l'annulation.");
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Annuler"
                  >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            )}
          ]}
          data={rdv}
          loading={loading}
          onRowClicked={handleRowClick}
        />
      </div>

      {/* Modal Nouveau RDV */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-[#1E3A5F] p-8 text-white shrink-0">
               <h2 className="text-2xl font-bold">Prendre Rendez-vous</h2>
               <p className="text-blue-200 text-sm opacity-80">Choisissez une date et un motif pour votre visite.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
               <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Véhicule</label>
                    <select 
                      required
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                      value={formData.id_vehicule}
                      onChange={e => setFormData({...formData, id_vehicule: e.target.value})}
                    >
                      <option value="">Sélectionner un véhicule</option>
                      {vehicules.map(v => (
                        <option key={v.id_vehicule} value={v.id_vehicule}>{v.marque} {v.modele} ({v.immatriculation})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Date et Heure</label>
                    <input 
                      type="datetime-local" 
                      required
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      value={formData.date_heure}
                      onChange={e => setFormData({...formData, date_heure: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Motif</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Révision périodique, Bruit étrange..."
                      required
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      value={formData.motif}
                      onChange={e => setFormData({...formData, motif: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Notes (Optionnel)</label>
                    <textarea 
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none min-h-[80px]"
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
               </div>

               <div className="flex flex-col sm:flex-row gap-3 pt-6 pb-4">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-200 transition-all order-2 sm:order-1"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all order-1 sm:order-2"
                  >
                    Valider le rendez-vous
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
