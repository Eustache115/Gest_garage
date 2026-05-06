import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext.jsx";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import GarageDataTable from "../../components/DataTable.jsx";
import { 
  CarIcon, 
  FactureIcon, 
  DevisIcon, 
  RendezvousIcon, 
  DashboardIcon,
  PlusIcon
} from "../../components/icons/AllIcon.jsx";

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    enCours: 0,
    termines: 0,
    prochainRDV: null,
    vehiculeEnCours: null,
    vehiculePret: null,
  });
  const [interventions, setInterventions] = useState([]);
  const [devis, setDevis] = useState([]);
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(true);
  


  const fetchDashboardData = async () => {
    try {
      const [resInter, resDevis, resFactures, resRDV] = await Promise.all([
        api.get(`/interventions/client/${user.id_utilisateur}`),
        api.get(`/devis/client/${user.id_utilisateur}`),
        api.get(`/factures/client/${user.id_utilisateur}`),
        api.get(`/rendezvous/client/${user.id_utilisateur}`),
      ]);

      const myInter = Array.isArray(resInter?.data) ? resInter.data : [];
      const myDevis = Array.isArray(resDevis?.data) ? resDevis.data : [];
      const myFactures = Array.isArray(resFactures?.data) ? resFactures.data : [];
      const myRDV = (Array.isArray(resRDV?.data) ? resRDV.data : [])
                             .filter(r => new Date(r.date_heure) > new Date())
                             .sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure));

      setInterventions(myInter.slice(0, 3));
      
      setStats({
        enCours: myInter.filter(i => i.statut === "En cours").length,
        termines: myInter.filter(i => i.statut === "Terminé").length,
        prochainRDV: myRDV[0] || null,
        vehiculeEnCours: myInter.find(i => i.statut === "En cours"),
        vehiculePret: myInter.find(i => i.statut === "Terminé"),
      });
    } catch (error) {
      console.error("Erreur chargement dashboard client:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);



  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E3A5F]"></div></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-800">Bienvenue {user.prenom_utilisateur} !</h1>
        <p className="text-gray-500">Heureux de vous revoir. Voici l'état de vos véhicules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2a4f80] rounded-3xl p-6 text-white shadow-xl flex items-center justify-between overflow-hidden relative group">
          <div className="z-10">
            <p className="text-blue-100 text-xs font-semibold mb-1 uppercase tracking-tight">Réparation en cours</p>
            {stats.vehiculeEnCours ? (
              <>
                <h3 className="text-xl font-bold">{stats.vehiculeEnCours.vehicule_marque}</h3>
                <p className="text-blue-100 text-[10px] sm:text-xs mt-0.5 opacity-80">{stats.vehiculeEnCours.vehicule_immatriculation}</p>
              </>
            ) : (
              <h3 className="text-xl font-bold opacity-60">Aucun véhicule</h3>
            )}
          </div>
          <div className="z-10 bg-white/10 p-3 rounded-2xl backdrop-blur-md">
             <CarIcon width="32" height="32" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-center justify-between overflow-hidden relative group">
          <div className="z-10">
             <p className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-tight">Véhicule prêt</p>
             {stats.vehiculePret ? (
               <>
                 <h3 className="text-xl font-bold text-gray-800">{stats.vehiculePret.vehicule_marque}</h3>
                 <p className="text-green-600 text-[10px] font-bold mt-0.5 uppercase">Prêt à emporter</p>
               </>
             ) : (
               <h3 className="text-xl font-bold text-gray-300">Rien à signaler</h3>
             )}
          </div>
          <div className="z-10 bg-green-50 p-3 rounded-2xl text-green-600">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
             </svg>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-center justify-between overflow-hidden relative group">
           <div className="z-10">
              <p className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-tight">Prochain RDV</p>
              {stats.prochainRDV ? (
                <>
                  <h3 className="text-xl font-bold text-gray-800">{new Date(stats.prochainRDV.date_heure).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short' })}</h3>
                  <p className="text-blue-600 text-[10px] font-bold mt-0.5 uppercase">à {new Date(stats.prochainRDV.date_heure).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</p>
                </>
              ) : (
                <h3 className="text-xl font-bold text-gray-300">Aucun RDV</h3>
              )}
           </div>
           <div className="z-10 bg-blue-50 p-3 rounded-2xl text-blue-600">
              <RendezvousIcon width="24" height="24" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Suivi des réparations</h2>
              <button 
                onClick={() => navigate('/client-interventions')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Voir tout l'historique &rarr;
              </button>
            </div>
            <GarageDataTable
              columns={[
                { name: "Véhicule", selector: row => `${row.vehicule_marque} ${row.vehicule_modele}`, cell: row => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                      <CarIcon width="14" height="14" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{row.vehicule_immatriculation}</p>
                    </div>
                  </div>
                )},
                { name: "Observation", selector: row => row.description, grow: 2, cell: row => <span className="text-xs text-gray-600">{row.description}</span> },
                { name: "Statut", selector: row => row.statut, cell: row => (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    row.statut === "Terminé" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {row.statut}
                  </span>
                )},
              ]}
              data={interventions}
              noDataMessage="Aucune activité récente"
            />
          </div>
        </div>


      </div>
    </div>
  );
}
