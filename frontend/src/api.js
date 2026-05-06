import axios from "axios";
import { toast } from "react-hot-toast";
import { cacheIncomingData, getLocalData, enqueueMutation } from "./offlineSync.js";

// Suppression radicale de toute adresse locale pour forcer Vercel à utiliser /api
const api = axios.create({
  baseURL: "/api",
});

// Intercepteur : injecter le token JWT dans chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur : Gestion des erreurs et du mode hors-ligne
api.interceptors.response.use(
  (response) => {
    // Si on est en ligne, on met en cache les données reçues (GET)
    if (response.config.method === "get" && !response.config._isBackgroundSync) {
      cacheIncomingData(response.config.url, response.data);
    }
    return response;
  },
  async (error) => {
    const { config, response } = error;
    const isGet = config?.method === "get";
    const isAuthError = response?.status === 401;

    // CAS 1 : Erreur de connexion (Serveur injoignable ou pas d'internet)
    if (!response || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED") {
      console.warn(`Mode Hors-Ligne : Pas de réponse serveur pour ${config.url}`);

      if (isGet) {
        const cachedData = await getLocalData(config.url);
        if (cachedData) {
          toast.success("Affichage des données locales (Hors-ligne)");
          return { data: cachedData, config, status: 200, offline: true };
        }
      } else {
        // Pour les POST/PUT/DELETE, on met en file d'attente pour plus tard
        await enqueueMutation(config.method, config.url, config.data);
        toast.error("Action sauvegardée (sera synchronisée au retour de la connexion)");
        return Promise.resolve({ data: { message: "Action mise en attente" }, status: 202 });
      }
    }

    // CAS 2 : Erreur 401 (Session expirée)
    if (isAuthError) {
      // Si on a des données en cache, on peut quand même rester sur la page au lieu de déconnecter brutalement
      const cachedData = await getLocalData(config.url);
      if (isGet && cachedData) {
          return { data: cachedData, config, status: 200, offline: true };
      }
      
      // Sinon redirection login
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      // window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;