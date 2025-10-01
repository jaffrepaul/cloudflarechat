import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [cloudflare(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 3000,
    watch: {
      // Ignore build server output and generated projects to prevent HMR triggers
      ignored: [
        '**/projects/**',
        '**/build-server/**',
        '**/node_modules/**',
        '**/.git/**'
      ]
    },
    proxy: {
      // Proxy API requests to the build server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // WebSocket proxy - needs explicit path
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      }
    }
  }
});
