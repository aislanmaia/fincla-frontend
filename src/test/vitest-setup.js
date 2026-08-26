import { configure } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* O `testTimeout` do Vitest (45 s, em `vite.config.ts`) NÃO governa sozinho.
 *
 * `findBy*` e `waitFor` têm orçamento próprio na RTL — `asyncUtilTimeout`, 1 s
 * por padrão —, e é ele que decide primeiro. Só `TransacoesPage.rtl.test.jsx`
 * faz 37 chamadas dessas. Com a suíte disputando o pool, um
 * `findByText` que precisa de mais de 1 s de laço de eventos falha com "Unable
 * to find element" enquanto o orçamento do teste mal foi tocado — a mesma
 * falha que migra de arquivo entre execuções, vindo de um teto que subir o
 * `testTimeout` não alcança.
 *
 * 5 s: alto o bastante para a espera atravessar um pico de disputa, baixo o
 * bastante para um seletor de fato errado ainda falhar rápido — que é o valor
 * de um `findBy` sobre um `getBy`. */
configure({ asyncUtilTimeout: 5_000 });
