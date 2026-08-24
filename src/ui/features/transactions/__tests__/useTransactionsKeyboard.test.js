/**
 * A guarda que decide se os atalhos são um recurso ou uma armadilha.
 *
 * Letra solta só vale com o foco FORA de campo de texto. É o erro clássico que
 * faz a pessoa "não conseguir digitar F" na busca — e ele não é hipotético: a
 * tela tem busca, dois campos de data, o número da janela relativa e os campos
 * de valor. A guarda é por TIPO de elemento e não por id, para qualquer campo
 * novo já nascer protegido.
 */
import { describe, expect, it } from "vitest";
import { focoEmCampoDeTexto } from "../useTransactionsKeyboard.js";

const elemento = (tagName, extra = {}) => ({ tagName, ...extra });

describe("focoEmCampoDeTexto", () => {
  it("reconhece os campos onde uma letra é só uma letra", () => {
    expect(focoEmCampoDeTexto(elemento("INPUT"))).toBe(true);
    expect(focoEmCampoDeTexto(elemento("TEXTAREA"))).toBe(true);
    // `select` entra junto: com ele aberto, teclar navega as opções.
    expect(focoEmCampoDeTexto(elemento("SELECT"))).toBe(true);
  });

  it("pega contenteditable, que não tem tag própria", () => {
    expect(focoEmCampoDeTexto(elemento("DIV", { isContentEditable: true }))).toBe(true);
    expect(focoEmCampoDeTexto(elemento("DIV", { isContentEditable: false }))).toBe(false);
  });

  it("deixa passar o que não é campo — inclusive a própria linha", () => {
    expect(focoEmCampoDeTexto(elemento("DIV"))).toBe(false);
    expect(focoEmCampoDeTexto(elemento("BUTTON"))).toBe(false);
    // Sem alvo (foco no body) os atalhos precisam valer, senão eles só
    // funcionariam depois de a pessoa clicar em alguma coisa.
    expect(focoEmCampoDeTexto(null)).toBe(false);
    expect(focoEmCampoDeTexto(undefined)).toBe(false);
  });
});
