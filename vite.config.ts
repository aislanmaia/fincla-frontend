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
    /* 45 s, não os 5 s padrão — e o número vem de MEDIÇÃO, não de estimativa.
       Primeiro escrevi aqui que "isolado, todo arquivo passa em menos de 3 s".
       Era falso, e era a justificativa central da mudança. Medido de verdade,
       rodando `TransacoesPage.rtl.test.jsx` SOZINHO, sem disputa de pool: o
       arquivo leva ~220 s e os testes mais lentos dão 29,8 · 28,8 · 19,4 ·
       17,2 · 10,7 s. Ou seja, não é só saturação de máquina: estes testes são
       lentos de verdade, porque o orçamento do Vitest cobre o corpo inteiro e
       um `render` desta página com 20+ linhas custa segundos.
       O teto acomoda essa realidade em vez de fingir que ela não existe — mas
       acomodar não é resolver: enquanto ele estiver alto, uma regressão de 2 s
       para 25 s passa calada. A dívida real é a lentidão, e ela merece PR
       próprio.
       Um caso é pior que os outros e vale nome: "criar saved view persiste em
       localStorage por org" foi observado em 7,0 · 14,0 · 25,8 e uma vez 184 s.
       Esse não é lento, é errático — provavelmente uma espera que só resolve
       por fallback. Se você veio parar aqui por causa dele, o conserto é o
       teste, não o teto.
       Os oito `{ timeout: 15000 }` por `describe` saíram junto: nasceram do
       mesmo aperto, mas espalhados por arquivo tinham virado o contrário do que
       prometiam — REBAIXAVAM o teto global. */
    testTimeout: 45_000,
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
