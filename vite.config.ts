import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
 plugins: [react(), tailwindcss(), VitePWA({
  registerType: 'autoUpdate', injectRegister: 'auto',
  includeAssets: ['icon.svg','icon-192.png','icon-512.png','securetrack-logo.png','notification-sw.js'],
  manifest: { id: '/', name: 'SecureTrack Technician', short_name: 'SecureTrack', description: 'SecureTrack assignments, technician attendance, inventory and job completion.', start_url: '/', scope: '/', display: 'standalone', orientation: 'any', background_color: '#eef3f0', theme_color: '#164d32', categories: ['business','productivity'], icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }, { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] },
  workbox: { cleanupOutdatedCaches: true, skipWaiting: true, clientsClaim: true, importScripts:['notification-sw.js'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'], navigateFallback: 'index.html', runtimeCaching: [] },
  devOptions: { enabled: false }
 })],
 server: { host: '127.0.0.1', port: 3000 }
});
