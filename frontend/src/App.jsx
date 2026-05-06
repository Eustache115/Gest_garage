import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import Layout from "./components/Layout.jsx";
import ChangerMotDePasse from "./components/ChangerMotDePasse.jsx";
import Login from "./Pages/Auth/Login.jsx";
import Dashboard from "./Pages/Admin/Dashbord.jsx";
import Clients from "./Pages/Admin/Clients.jsx";
import Vehicules from "./Pages/Admin/Vehicules.jsx";
import Utilisateurs from "./Pages/Admin/Utilisateurs.jsx";
import Interventions from "./Pages/Admin/interventions.jsx";
import Stock from "./Pages/Admin/Stock.jsx";
import Devis from "./Pages/Admin/Devis.jsx";
import Facturation from "./Pages/Admin/Facturation.jsx";
import Rendezvous from "./Pages/Admin/Rendezvous.jsx";
import AdminAvis from "./Pages/Admin/AdminAvis.jsx";
import Historique from "./Pages/Mecanicien/Historique.jsx";
import MesInterventions from "./Pages/Mecanicien/MesInterventions.jsx";
import MecanicienDashboard from "./Pages/Mecanicien/MecanicienDashboard.jsx";
import ClientDashboard from "./Pages/Client/ClientDashboard.jsx";
import ClientInterventions from "./Pages/Client/ClientInterventions.jsx";
import ClientDevis from "./Pages/Client/ClientDevis.jsx";
import ClientFactures from "./Pages/Client/ClientFactures.jsx";
import ClientRendezvous from "./Pages/Client/ClientRendezvous.jsx";
import ClientAvis from "./Pages/Client/ClientAvis.jsx";
import Profil from "./Pages/Common/Profil.jsx";
import NotFound from "./Pages/Common/NotFound.jsx";
import { processSyncQueue } from "./offlineSync.js";
import api from "./api.js";

/** Composant de protection des routes */
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      {user.premiere_connexion && <ChangerMotDePasse />}
      {children}
    </>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Racine dynamique par rôle */}
        <Route path="/" element={
           role === "client" ? <ClientDashboard /> : 
           role === "mecanicien" ? <MecanicienDashboard /> :
           role === "receptionniste" ? <Dashboard /> :
           <Dashboard />
        } />

        {/* Toutes les routes sont définies pour éviter les erreurs de matching (La sécurité est gérée par le Layout/Sidebar et le Backend) */}
        
        {/* Admin / Reception */}
        <Route path="/clients" element={<Clients />} />
        <Route path="/vehicules" element={<Vehicules />} />
        <Route path="/interventions" element={<Interventions />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/facturation" element={<Facturation />} />
        <Route path="/devis" element={<Devis />} />
        <Route path="/rendezvous" element={<Rendezvous />} />
        <Route path="/admin-avis" element={<AdminAvis />} />
        <Route path="/utilisateurs" element={<Utilisateurs />} />

        {/* Mécanicien */}
        <Route path="/mes-interventions" element={<MesInterventions />} />
        <Route path="/historique" element={<Historique />} />

        {/* Client */}
        <Route path="/client-dashboard" element={<ClientDashboard />} />
        <Route path="/client-interventions" element={<ClientInterventions />} />
        <Route path="/client-devis" element={<ClientDevis />} />
        <Route path="/client-factures" element={<ClientFactures />} />
        <Route path="/client-rendezvous" element={<ClientRendezvous />} />
        <Route path="/client-avis" element={<ClientAvis />} />

        <Route path="/profil" element={<Profil />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function App() {
  useEffect(() => {
    // Écouter le retour de la connexion Internet
    const handleOnline = () => {
      toast.success("Connexion rétablie. Tentative de synchronisation...");
      processSyncQueue(api);
    };

    // Notification UI de la fin de la synchronisation 
    const handleSyncComplete = (event) => {
      const count = event.detail;
      toast.success(`Synchronisation terminée avec succès (${count} élément(s)).`);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('sync-completed', handleSyncComplete);

    // Initial check au démarrage
    if (navigator.onLine) {
        processSyncQueue(api);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" reverseOrder={false} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;