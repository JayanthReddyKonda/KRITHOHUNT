import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    cssCodeSplit: true,
    target: 'es2020',
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
            return 'vendor-react'
          }
          if (id.includes('@supabase/')) return 'supabase'
          if (id.includes('leaflet')) return 'leaflet'
          if (id.includes('html5-qrcode')) return 'qrcode'
          if (id.includes('lucide-react')) return 'icons'
          return 'vendor'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'],
      legalComments: 'none',
      treeShaking: true,
    },
  },
})