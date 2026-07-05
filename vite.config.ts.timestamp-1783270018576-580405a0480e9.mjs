// vite.config.ts
import { defineConfig } from "file:///home/aislan/Projetos/fincla/fincla-frontend/node_modules/vite/dist/node/index.js";
import react from "file:///home/aislan/Projetos/fincla/fincla-frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/home/aislan/Projetos/fincla/fincla-frontend";
var vite_config_default = defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    setupFiles: ["./src/test/vitest-setup.js"],
    environmentMatchGlobs: [["**/*.rtl.test.*", "jsdom"]]
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    port: 3e3,
    host: true,
    // DNS rebinding protection do Vite 5+ rejeita Host headers fora do
    // allowlist por padrão. Liberamos os hostnames do tunnel cloudflared
    // usado em dev (`dev.fincla.com.br`) e mantemos loopback para o
    // fallback offline. Em build de produção este bloco é ignorado.
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "dev.fincla.com.br",
      ".fincla.com.br"
    ]
  },
  preview: {
    port: 3e3,
    host: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9haXNsYW4vUHJvamV0b3MvZmluY2xhL2ZpbmNsYS1mcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvYWlzbGFuL1Byb2pldG9zL2ZpbmNsYS9maW5jbGEtZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvYWlzbGFuL1Byb2pldG9zL2ZpbmNsYS9maW5jbGEtZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICB0ZXN0OiB7XG4gICAgZW52aXJvbm1lbnQ6IFwibm9kZVwiLFxuICAgIGdsb2JhbHM6IGZhbHNlLFxuICAgIGluY2x1ZGU6IFtcInNyYy8qKi8qLnt0ZXN0LHNwZWN9Lntqcyxqc3gsdHMsdHN4fVwiXSxcbiAgICBzZXR1cEZpbGVzOiBbXCIuL3NyYy90ZXN0L3ZpdGVzdC1zZXR1cC5qc1wiXSxcbiAgICBlbnZpcm9ubWVudE1hdGNoR2xvYnM6IFtbXCIqKi8qLnJ0bC50ZXN0LipcIiwgXCJqc2RvbVwiXV0sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBob3N0OiB0cnVlLFxuICAgIC8vIEROUyByZWJpbmRpbmcgcHJvdGVjdGlvbiBkbyBWaXRlIDUrIHJlamVpdGEgSG9zdCBoZWFkZXJzIGZvcmEgZG9cbiAgICAvLyBhbGxvd2xpc3QgcG9yIHBhZHJcdTAwRTNvLiBMaWJlcmFtb3Mgb3MgaG9zdG5hbWVzIGRvIHR1bm5lbCBjbG91ZGZsYXJlZFxuICAgIC8vIHVzYWRvIGVtIGRldiAoYGRldi5maW5jbGEuY29tLmJyYCkgZSBtYW50ZW1vcyBsb29wYmFjayBwYXJhIG9cbiAgICAvLyBmYWxsYmFjayBvZmZsaW5lLiBFbSBidWlsZCBkZSBwcm9kdVx1MDBFN1x1MDBFM28gZXN0ZSBibG9jbyBcdTAwRTkgaWdub3JhZG8uXG4gICAgYWxsb3dlZEhvc3RzOiBbXG4gICAgICBcImxvY2FsaG9zdFwiLFxuICAgICAgXCIxMjcuMC4wLjFcIixcbiAgICAgIFwiZGV2LmZpbmNsYS5jb20uYnJcIixcbiAgICAgIFwiLmZpbmNsYS5jb20uYnJcIixcbiAgICBdLFxuICB9LFxuICBwcmV2aWV3OiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBob3N0OiB0cnVlLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNULFNBQVMsb0JBQW9CO0FBQ25WLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLE1BQU07QUFBQSxJQUNKLGFBQWE7QUFBQSxJQUNiLFNBQVM7QUFBQSxJQUNULFNBQVMsQ0FBQyxzQ0FBc0M7QUFBQSxJQUNoRCxZQUFZLENBQUMsNEJBQTRCO0FBQUEsSUFDekMsdUJBQXVCLENBQUMsQ0FBQyxtQkFBbUIsT0FBTyxDQUFDO0FBQUEsRUFDdEQ7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS04sY0FBYztBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
