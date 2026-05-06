import axios from "axios";
import { toast } from "react-hot-toast";
import { cacheIncomingData, getLocalData, enqueueMutation } from "./offlineSync.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

// Intercepteur : injecter le token JWT dans chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur : rediriger vers /login si 401 et gérer le cache hors-ligne
api.interceptors.response.use(
  async (response) => {
    // Si la requête est en succès, on met en cache pour le mode hors-ligne
    // cacheIncomingData normalise l'URL automatiquement (retire baseURL, query params)
    const isDocument = response.config.url.includes('/documents/');
    if (response.config.method.toUpperCase() === 'GET' && !isDocument) {
      await cacheIncomingData(response.config.url, response.data);
    }
    return response;
  },
  async (error) => {
      // ── Gestion de la perte de réseau (Mode Hors-Ligne) ──
      // Déclenché quand le serveur est inaccessible (pas de réponse HTTP)
      if (!error.response && error.request) {
          const method = error.config.method.toUpperCase();
          console.log("Mode Hors-Ligne : Pas de réponse serveur pour", error.config.url);
          
          if (method === 'GET') {
              // Renvoie les données en cache local si disponible, sinon un tableau vide
              const localData = await getLocalData(error.config.url);
              console.log("Mode Hors-Ligne : Données locales trouvées =", localData ? "OUI" : "NON", "pour", error.config.url);
              return Promise.resolve({ data: localData !== null ? localData : [], _isOfflineCache: true });
          } 
          else if (!error.config._isBackgroundSync) {
              // C'est une mutation (POST, PUT, DELETE) initiée par l'utilisateur hors-ligne
              console.log("Mode Hors-Ligne : Action sauvegardée dans la file d'attente", error.config.url);
              await enqueueMutation(error.config);
              toast.success("Action sauvegardée localement (sera synchronisée au retour d'internet)");
              // On simule une réussite pour ne pas bloquer l'interface
              return Promise.resolve({ data: {}, _local_queued: true });
          }
          
          if (!error.config._isBackgroundSync) {
            toast.error("Impossible de contacter le serveur. Vérifiez votre connexion.");
          }
          return Promise.reject(error);
      }

      // ── Erreur 401 : Token expiré ou invalide ──
      // IMPORTANT : Si on est hors-ligne, on tente de servir depuis le cache
      // au lieu de rediriger vers /login
      if (error.response && error.response.status === 401) {
          if (!navigator.onLine || error.config._forceOffline) {
              // Hors-ligne : on essaie le cache local
              const method = error.config.method?.toUpperCase();
              if (method === 'GET') {
                  const localData = await getLocalData(error.config.url);
                  if (localData !== null) {
                      console.log("Mode Hors-Ligne (401) : Données locales servies pour", error.config.url);
                      return Promise.resolve({ data: localData, _isOfflineCache: true });
                  }
              }
          }
          // En ligne : déconnexion normale
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          if (window.location.pathname !== "/login") {
              window.location.href = "/login";
          }
          return Promise.reject(error);
      }

      // Erreurs standard du serveur (5xx, etc.)
      if (error.response) {
        if (!error.config._isBackgroundSync) {
          let msg = error.response.data?.detail || "Une erreur est survenue sur le serveur.";
          if (typeof msg !== 'string') {
            msg = JSON.stringify(msg);
          }
          toast.error(msg);
        }
      } else {
        if (!error.config?._isBackgroundSync) {
          toast.error("Une erreur inconnue s'est produite.");
        }
      }
      return Promise.reject(error);
  }
);

export default api;