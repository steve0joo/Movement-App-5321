import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // PWA Configuration
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        // Ensure service worker and manifest are copied to dist
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'manifest.json') {
            return 'manifest.json';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },

  // Ensure public files are served correctly
  publicDir: 'public',
})
