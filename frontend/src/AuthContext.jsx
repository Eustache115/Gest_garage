import React, { createContext, useContext, useState, useEffect } from "react";
import api from "./api.js";

const AuthContext = createContext({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  setUser: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      if (!saved || saved === "undefined") return null;
      return JSON.parse(saved);
    } catch (error) {
      console.warn("Erreur lors du parsing de l'utilisateur depuis localStorage:", error);
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier si le token est toujours valide au chargement
    if (token && user) {
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, mot_de_passe) => {
    const res = await api.post("/login", { email, mot_de_passe });
    const { access_token, user: userData } = res.data;
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    
// MAGIE HORS-LIGNE : Téléchargement EAGER (Préchargement) de la base de données
    if (navigator.onLine) {
        setTimeout(async () => {
            try {
                const role = userData.role?.toLowerCase();
                const userId = userData.id_utilisateur;

                const fetchWithHandling = async (url) => {
                    try {
                        return await api.get(url, { _isBackgroundSync: true });
                    } catch (err) {
                        console.warn(`Préchargement échoué pour ${url}:`, err);
                    }
                };

                if (role === 'client') {
                    // Préchargement spécifique au client (données filtrées par son ID)
                    await Promise.allSettled([
                        fetchWithHandling(`/vehicules/client/${userId}`),
                        fetchWithHandling(`/interventions/client/${userId}`),
                        fetchWithHandling(`/devis/client/${userId}`),
                        fetchWithHandling(`/factures/client/${userId}`),
                        fetchWithHandling(`/rendezvous/client/${userId}`)
                    ]);
                    console.log("Préchargement du cache hors-ligne (Client) terminé.");
                } else if (role === 'mecanicien') {
                    // Préchargement spécifique au mécanicien
                    await Promise.allSettled([
                        fetchWithHandling('/interventions'),
                        fetchWithHandling('/reparations'),
                        fetchWithHandling('/vehicules'),
                        fetchWithHandling('/clients'),
                        fetchWithHandling('/pieces'),
                    ]);
                    console.log("Préchargement du cache hors-ligne (Mécanicien) terminé.");
                } else {
                    // Admin / Réceptionniste : tout précharger
                    await Promise.allSettled([
                        fetchWithHandling('/vehicules'),
                        fetchWithHandling('/clients'),
                        fetchWithHandling('/interventions'),
                        fetchWithHandling('/reparations'),
                        fetchWithHandling('/devis'),
                        fetchWithHandling('/mecaniciens'),
                        fetchWithHandling('/pieces'),
                        fetchWithHandling('/factures'),
                        fetchWithHandling('/rendezvous'),
                        fetchWithHandling('/utilisateurs'),
                        fetchWithHandling('/receptionnistes'),
                        fetchWithHandling('/dashboard/stats')
                    ]);
                    console.log("Préchargement du cache hors-ligne (Admin/Récep.) terminé.");
                }
            } catch(e) {
                console.warn("Mise en cache préventive annulée:", e);
            }
        }, 1500); // Exécuté discrètement en background après 1.5 sec
    }

    return userData;
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#EEF2F6]">
        <div className="w-8 h-8 border-4 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, setUser: updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
