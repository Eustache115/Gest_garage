import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Enregistrement du Service Worker pour que l'App fonctionne sans Internet
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      // Peut être utilisé pour afficher un toast "Nouvelle version disponible"
    },
    onOfflineReady() {
      console.log("L'application E-GARAGE est prête à fonctionner hors-ligne.");
    },
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
