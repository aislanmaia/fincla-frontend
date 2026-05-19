import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    setupFiles: ["./src/test/vitest-setup.js"],
    environmentMatchGlobs: [["**/*.rtl.test.*", "jsdom"]],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    // DNS rebinding protection do Vite 5+ rejeita Host headers fora do
    // allowlist por padrão. Liberamos os hostnames do tunnel cloudflared
    // usado em dev (`dev.fincla.com.br`) e mantemos loopback para o
    // fallback offline. Em build de produção este bloco é ignorado.
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "dev.fincla.com.br",
      ".fincla.com.br",
    ],
  },
  preview: {
    port: 3000,
    host: true,
  },
});
