import React, { useState, useRef, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import MenuItem from "./MenuItem.jsx";
import logonouveau from "../logonouveau.png";
import api from "../api.js";
import ConfirmModal from "./ConfirmModal.jsx";
import { useAuth } from "../AuthContext.jsx";
import {
  DashboardIcon,
  ClientIcon,
  CarIcon,
  ToolIcon,
  StockIcon,
  FactureIcon,
  PlusIcon,
  DevisIcon,
  RendezvousIcon,
  UsersIcon,
  UserIcon,
  StarIcon,
} from "./icons/AllIcon.jsx";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const rechercher = async (q) => {
    if (!q || q.length < 2) { setResultats([]); setShowResults(false); return; }
    setLoading(true);
    try {
      const [resClients, resVehicules] = await Promise.all([
        api.get("/clients"),
        api.get("/vehicules"),
      ]);
      const ql = q.toLowerCase();
      const clients = resClients.data
        .filter(c => `${c.nom_utilisateur} ${c.prenom_utilisateur}`.toLowerCase().includes(ql) || c.email.toLowerCase().includes(ql) || c.telephone.includes(q))
        .slice(0, 5)
        .map(c => ({ type: "client", label: `${c.prenom_utilisateur} ${c.nom_utilisateur}`, sub: c.telephone || c.email, id: c.id_client }));
      const vehicules = resVehicules.data
        .filter(v => v.immatriculation.toLowerCase().includes(ql) || `${v.marque} ${v.modele}`.toLowerCase().includes(ql))
        .slice(0, 5)
        .map(v => ({ type: "vehicule", label: v.immatriculation, sub: `${v.marque} ${v.modele}`, id: v.id_vehicule }));
      setResultats([...clients, ...vehicules]);
      setShowResults(true);
    } catch { setResultats([]); }
    finally { setLoading(false); }
  };

  const onInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => rechercher(val), 300);
  };

  const goTo = (r) => {
    setShowResults(false);
    setQuery("");
    if (r.type === "client") navigate("/clients", { state: { selectedId: r.id } });
    else navigate("/vehicules", { state: { selectedId: r.id } });
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex flex-col h-screen bg-[#EEF2F6] font-sans overflow-hidden">
      {/* MODAL DE DÉCONNEXION */}
      {showLogoutConfirm && (
        <ConfirmModal 
          message="Voulez-vous vraiment vous déconnecter ?"
          onConfirm={() => {
            setShowLogoutConfirm(false);
            logout();
            navigate("/login");
          }}
          onCancel={() => setShowLogoutConfirm(false)}
          confirmText="Se déconnecter"
          confirmClass="bg-[#1E3A5F] hover:bg-[#162e4d]"
        />
      )}

      {/* TOP BAR */}
      <header className="flex items-center justify-between px-4 sm:px-6 lg:px-10 h-20 bg-[#1E3A5F] bg-[radial-gradient(circle_at_top_left,#1E3A5F_0%,#0F1E35_40%,#162E4D_100%)] sticky top-0 z-50 border-b border-white/10 gap-4 shadow-lg shrink-0">

        <button
          className="lg:hidden p-2 rounded-xl bg-white/10 shadow text-white hover:bg-white/20 shrink-0 transition-all active:scale-95"
          onClick={() => setSidebarOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div className="flex items-center shrink-0">
          <img src={logonouveau} alt="E-GARAGE" className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
        </div>

        {/* Barre de recherche */}
        <div className="flex-1 max-w-md relative" ref={searchRef}>
          <div className="bg-white/10 px-4 py-2 rounded-2xl shadow-sm border border-white/20">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Recherche rapide... (Nom, Plaque)"
                className="w-full outline-none text-white placeholder-white/50 text-sm bg-transparent"
                value={query}
                onChange={onInput}
                onFocus={() => { if (resultats.length > 0) setShowResults(true); }}
              />
              {loading && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />}
            </div>
          </div>
          {showResults && resultats.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-80 overflow-y-auto">
              {resultats.map((r, i) => (
                <button
                  key={`${r.type}-${r.id}-${i}`}
                  onClick={() => goTo(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all text-left border-b last:border-0"
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${r.type === "client" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                    {r.type === "client" ? "Client" : "Vehicule"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.label}</p>
                    <p className="text-xs text-gray-400 truncate">{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showResults && query.length >= 2 && resultats.length === 0 && !loading && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 px-4 py-6 text-center">
              <p className="text-sm text-gray-400">Aucun resultat pour {query}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-white text-sm font-semibold hidden sm:flex shrink-0">
          {/* Icône profil */}
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <span>{user?.prenom_utilisateur} {user?.nom_utilisateur}</span>
          <span className="px-2 py-0.5 bg-white/15 border border-white/20 rounded-lg text-[10px] uppercase tracking-wider font-bold text-white/80">
            {user?.role?.toLowerCase() === "admin" ? "Admin" : user?.role?.toLowerCase() === "mecanicien" ? "Mécanicien" : user?.role?.toLowerCase() === "receptionniste" ? "Réceptionniste" : "Client"}
          </span>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-8 h-8 flex items-center justify-center bg-white/10 border border-white/20 rounded-xl hover:bg-red-500/30 hover:border-red-400/40 transition-all"
            title="Déconnexion"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* CORPS */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={closeSidebar} />
        )}

        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-30
            w-64 h-full bg-[radial-gradient(circle_at_top_left,#1E3A5F_0%,#0F1E35_40%,#162E4D_100%)]
            text-white p-6 flex flex-col shadow-2xl
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <button
            className="self-end mb-4 lg:hidden text-white/70 hover:text-white text-xs font-bold"
            onClick={closeSidebar}
          >
            FERMER
          </button>

          <nav className="space-y-1 flex-1 overflow-y-auto">
            <MenuItem 
              label="Tableau de bord" 
              to={user?.role?.toLowerCase() === "client" ? "/client-dashboard" : "/"} 
              active={location.pathname === "/" || location.pathname === "/client-dashboard"} 
              icon={<DashboardIcon />} 
              onClick={closeSidebar} 
            />
            
            {/* Menu pour Administrateur et Réceptionniste */}
            {(user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "receptionniste") && (
              <>
                <MenuItem label="Clients" to="/clients" active={location.pathname === "/clients"} icon={<ClientIcon />} onClick={closeSidebar} />
                <MenuItem label="Vehicules" to="/vehicules" active={location.pathname === "/vehicules"} icon={<CarIcon />} onClick={closeSidebar} />
                <MenuItem label="Interventions" to="/interventions" active={location.pathname === "/interventions"} icon={<ToolIcon />} onClick={closeSidebar} />
                <MenuItem label="Stock" to="/stock" active={location.pathname === "/stock"} icon={<StockIcon />} onClick={closeSidebar} />
                <MenuItem label="Facturation" to="/facturation" active={location.pathname === "/facturation"} icon={<FactureIcon />} onClick={closeSidebar} />
                <MenuItem label="Devis" to="/devis" active={location.pathname === "/devis"} icon={<DevisIcon />} onClick={closeSidebar} />
                <MenuItem label="Rendez-vous" to="/rendezvous" active={location.pathname === "/rendezvous"} icon={<RendezvousIcon />} onClick={closeSidebar} />
                <MenuItem label="Avis Clients" to="/admin-avis" active={location.pathname === "/admin-avis"} icon={<StarIcon />} onClick={closeSidebar} />
                {user?.role === "admin" && (
                  <MenuItem label="Utilisateurs" to="/utilisateurs" active={location.pathname === "/utilisateurs"} icon={<UsersIcon />} onClick={closeSidebar} />
                )}
              </>
            )}

            {/* Menu spécifique Mécanicien */}
            {user?.role?.toLowerCase() === "mecanicien" && (
              <>
                <MenuItem label="Mes Interventions" to="/mes-interventions" active={location.pathname === "/mes-interventions"} icon={<ToolIcon />} onClick={closeSidebar} />
                <MenuItem label="Historique" to="/historique" active={location.pathname === "/historique"} icon={<DevisIcon />} onClick={closeSidebar} />
              </>
            )}

            {/* Menu spécifique Client */}
            {user?.role?.toLowerCase() === "client" && (
              <>
                <MenuItem label="Mes Interventions" to="/client-interventions" active={location.pathname === "/client-interventions"} icon={<ToolIcon />} onClick={closeSidebar} />
                <MenuItem label="Mes Devis" to="/client-devis" active={location.pathname === "/client-devis"} icon={<DevisIcon />} onClick={closeSidebar} />
                <MenuItem label="Mes Factures" to="/client-factures" active={location.pathname === "/client-factures"} icon={<FactureIcon />} onClick={closeSidebar} />
                <MenuItem label="Rendez-vous" to="/client-rendezvous" active={location.pathname === "/client-rendezvous"} icon={<RendezvousIcon />} onClick={closeSidebar} />
                <MenuItem label="Mes Avis" to="/client-avis" active={location.pathname === "/client-avis"} icon={<StarIcon />} onClick={closeSidebar} />
              </>
            )}

            <div className="pt-4 mt-4 border-t border-white/10">
               <MenuItem label="Mon Profil" to="/profil" active={location.pathname === "/profil"} icon={<UserIcon />} onClick={closeSidebar} />
            </div>
          </nav>

          {/* Profil + Déconnexion en bas de la sidebar */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              {/* Icône profil */}
              <button 
                onClick={() => { navigate("/profil"); closeSidebar(); }}
                className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 hover:bg-white/30 transition-all"
              >
                <UserIcon width="18" height="18" />
              </button>
              <div className="flex-1 min-w-0 pointer-events-none">
                <p className="text-sm font-semibold text-white truncate">{user?.prenom_utilisateur} {user?.nom_utilisateur}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  {user?.role === "admin" ? "Admin" : user?.role === "mecanicien" ? "Mécanicien" : user?.role === "receptionniste" ? "Réceptionniste" : "Client"}
                </p>
              </div>
              <button
                onClick={() => { setShowLogoutConfirm(true); closeSidebar(); }}
                className="w-9 h-9 flex items-center justify-center bg-white/10 border border-white/20 rounded-xl hover:bg-red-500/30 hover:border-red-400/40 transition-all shrink-0"
                title="Se déconnecter"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-10 bg-[#EEF2F6]" style={{ scrollbarGutter: 'stable' }}>
          <Outlet />
        </main>
      </div>

    </div>
  );
}
