/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  build: {
    // Protección de código: no publicar source maps del código original en producción
    sourcemap: false,
  },
  server: {
    // Escuchar en todas las interfaces (IPv4 0.0.0.0 + IPv6). Sin esto, Vite 5 puede
    // bindear solo a ::1 (IPv6) y el navegador que resuelve localhost a 127.0.0.1 no
    // carga la app (el login "no abre"). host:true lo hace accesible por ambas.
    host: true,
    // 3001 por defecto (Antigravity usa el 3000); respeta PORT del entorno para instancias paralelas
    port: Number(process.env.PORT) || 3001,
    proxy: {
      '/api': {
        // El backend usa PORT=5001 por defecto (src/index.ts y .env).
        target: `http://localhost:${process.env.BACKEND_PORT || 5001}`,
        changeOrigin: true,
      },
      '/uploads': {
        target: `http://localhost:${process.env.BACKEND_PORT || 5001}`,
        changeOrigin: true,
      },
    },
  },
})
