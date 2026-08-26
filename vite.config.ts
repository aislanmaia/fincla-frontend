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
    /* 20 s, não os 5 s padrão.
       O orçamento do Vitest cobre o CORPO INTEIRO do teste, `render()` incluído
       — e um `render` de `<TransacoesPage>` ou do painel de filtros custa
       segundos quando 29 arquivos dividem o mesmo pool. O sintoma era um teste
       que só faz `fireEvent.click` síncrono estourando o tempo, e a falha
       MIGRANDO de arquivo a cada execução: uma vez em `ActiveFacetsPane`, outra
       em `FacetPanels`, outra em `NovaTransacaoModal`. Isso é saturação de
       máquina, não teste lento — e um vermelho que muda de lugar não é sinal,
       é ruído que ensina a ignorar a suíte.
       Isolado, todo arquivo passa em menos de 3 s: o teto novo não esconde
       lentidão real, só para de cobrar de cada teste o tempo dos vizinhos.
       30 e não 20 porque 20 ainda deixou um vermelho em 1 de 2 execuções da
       fatia mais pesada (51 arquivos num pool só). Um teto alto não custa nada
       quando o teste passa — ele só limita o quanto uma falha DEMORA a
       aparecer —, e um vermelho que só aparece às vezes custa caro: ensina a
       ignorar a suíte. */
    testTimeout: 30_000,
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
