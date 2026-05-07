import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite' // <-- 1. AJOUTE CET IMPORT

export default defineConfig({
  plugins: [
    tailwindcss(), // <-- 2. AJOUTE LE PLUGIN ICI (idéalement en premier)
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Ne pas intercepter les appels API
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*$/,
            handler: 'NetworkOnly', // Forcer le réseau pour l'API (géré manuellement par offlineSync.js)
          }
        ]
      },
      manifest: {
        name: 'Garage App',
        short_name: 'Garage',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})