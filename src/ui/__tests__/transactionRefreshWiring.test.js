import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * #264 — as telas de saldo só recarregam depois de uma transação se o App lhes
 * entregar o token que ele sobe a cada salvamento (`bumpTransactionsList`). O App
 * não tem teste de tela (é o shell inteiro), então a ligação é presa aqui, no
 * fonte: tirar o prop de qualquer uma destas telas volta o bug do F5.
 */
const app = readFileSync(resolve(__dirname, "../App.jsx"), "utf8");

function elementSource(tag) {
  const start = app.search(new RegExp(`<${tag}\\s`));
  expect(start, `<${tag}> não encontrado em App.jsx`).toBeGreaterThan(-1);
  return app.slice(start, app.indexOf("/>", start));
}

describe("App entrega o token de transações às telas de saldo", () => {
  it("o modal de transação sobe o token ao salvar", () => {
    expect(elementSource("NovaTransacaoModal")).toMatch(/onTransactionSaved=\{bumpTransactionsList\}/);
  });

  it.each(["AccountsPage", "DashboardPageView", "TransacoesPageView"])("%s recebe transactionsRefreshToken", (tag) => {
    expect(elementSource(tag)).toMatch(/transactionsRefreshToken=\{transactionsListVersion\}/);
  });
});
