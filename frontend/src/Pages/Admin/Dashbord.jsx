import React, { useState, useEffect } from "react";
import { CarIcon, ClientIcon } from "../../components/icons/AllIcon.jsx";
import api from "../../api.js";
import MecanicienDashboard from "../Mecanicien/MecanicienDashboard.jsx";
import { useNavigate } from "react-router-dom";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReTooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

import { useAuth } from "../../AuthContext.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      try {
        const res = await api.get("/dashboard/stats");
        setStats(res.data);
      } catch (err) {
        console.error("Erreur stats:", err);
      } finally {
        setLoading(false);
      }
    };

    charger();

    // 1. Rafraîchissement automatique toutes les 10 secondes (Polling)
    const interval = setInterval(charger, 10000);

    // 2. Rafraîchissement quand on revient sur l'onglet (Focus)
    window.addEventListener('focus', charger);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', charger);
    };
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-10 bg-gray-100 rounded-xl w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl"></div>)}
        </div>
      </div>
    );
  }
  const kanban = stats?.kanban || { en_attente: [], en_cours: [], terminees: [] };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-700">
            Tableau de Bord
          </h1>
        </div>
        {user?.role === "receptionniste" && (
          <button
            onClick={() => navigate("/clients")}
            className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95"
          >
            <ClientIcon small color="white" />
            Créer un compte client
          </button>
        )}
      </div>
      {/* CARTES STAT PRINCIPALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-4 mb-8">
        <StatCard
          title="Interventions en cours"
          value={stats?.interventions_en_cours ?? 0}
          color="bg-gradient-to-br from-blue-600 to-blue-700"
        />
        <StatCard
          title="Staff"
          value={stats?.nb_utilisateurs ?? 0}
          color="bg-gradient-to-br from-indigo-500 to-indigo-600"
          icon={<svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <StatCard
          title="Chiffre d'Affaire du mois"
          value={`${(stats?.ca_mensuel_total ?? 0).toLocaleString("fr-FR")} FCFA`}
          color="bg-gradient-to-br from-green-500 to-green-600"
        />
        <StatCard
          title="Clients"
          value={stats?.nb_nouveaux_clients ?? 0}
          color="bg-gradient-to-br from-sky-400 to-sky-500"
        />
        <StatCard
          title="Alertes Stock"
          value={stats?.alertes_stock ?? 0}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
          icon={<svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
      </div>

      {/* GRAPHIQUE DE REVENUS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Évolution du Chiffre d'Affaires</h2>
            <p className="text-xs text-gray-400">Revenus mensuels de l'année en cours</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Jan - Déc {new Date().getFullYear()}
          </div>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.stats_mensuelles ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="mois" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
              />
              <ReTooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
              <Bar 
                dataKey="total" 
                radius={[6, 6, 0, 0]} 
                barSize={32}
              >
                {(stats?.stats_mensuelles ?? []).map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === new Date().getMonth() ? '#2563EB' : '#3B82F6'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>



      {/* INTERVENTIONS KANBAN */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-gray-700">
          Gestion des Interventions Actives
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          <InterventionColumn
            title="En Attente"
            headerColor="bg-yellow-400"
            items={kanban.en_attente.map(i => ({ ...i, couleurNb: "bg-yellow-500" }))}
          />
          <InterventionColumn
            title="En Cours"
            headerColor="bg-blue-500"
            items={kanban.en_cours.map(i => ({ ...i, couleurNb: "bg-blue-500" }))}
          />
          <InterventionColumn
            title="Terminé"
            headerColor="bg-green-500"
            items={kanban.terminees.map(i => ({ ...i, couleurNb: "bg-green-500" }))}
          />
        </div>
      </div>
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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</p>
        <p className="text-sm font-black text-blue-600">
          {payload[0].value.toLocaleString()} FCFA
        </p>
      </div>
    );
  }
  return null;
};

function InterventionColumn({ title, headerColor, items }) {
  return (
    <div className="bg-[#F8FAFC] rounded-3xl overflow-hidden shadow-sm border border-gray-100">
      <div className={`${headerColor} h-1.5`} />
      <h3 className="text-center font-bold py-4 text-gray-700 border-b border-gray-100 text-sm">
        {title.toUpperCase()} <span className="text-gray-400 ml-1">({items.length})</span>
      </h3>
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-300">
            <p className="text-[10px] font-bold uppercase italic">Vide</p>
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id_intervention}
            className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md hover:border-blue-100 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all">
                <CarIcon width="16" height="16" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">
                  {item.plaque}
                </p>
                <p className="text-[10px] text-gray-400 truncate uppercase font-medium">{item.client}</p>
              </div>
            </div>
            <span className={`${item.couleurNb} text-white w-7 h-7 rounded-xl text-[10px] font-black flex items-center justify-center shrink-0 ml-2 shadow-sm`}>
              #{item.id_intervention}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
