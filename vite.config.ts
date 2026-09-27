import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Regionea Atlas',
        short_name: 'Regionea Atlas',
        description: 'Atlas político, físico y de transporte de Asturias, España y Europa',
        start_url: '/mapa/politico',
        display: 'standalone',
        background_color: '#f7f2e8',
        theme_color: '#b35e37',
        icons: [
          { "src": "/favicon-64x64.png", "sizes": "64x64", "type": "image/png", "purpose": "any" },
          { "src": "/favicon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
          { "src": "/favicon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
          { "src": "/maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
        ]
      },
    })
  ]
})



