// A área de conteúdo do shell: a região que rola, abaixo da barra do topo.

/**
 * @param selfScrolling a tela rola por conta própria (Transações e Lançamentos no celular): o shell
 *   para de rolar e vira coluna flex.
 * @param ledger Lançamentos do cartão no celular (sem respiro).
 * @param fillsHeight a página ocupa a altura que sobra (tela inicial do Conciliar extrato no
 *   computador): a região vira coluna flex que CONTINUA rolando, para o aviso de acesso ficar em cima
 *   e a página crescer só até o que sobra depois dele (G3 achado 9).
 */
export function mainScrollStyle({ selfScrolling, ledger, fillsHeight, isMobile }) {
  const column = selfScrolling || fillsHeight;
  return {
    flex: 1,
    minHeight: 0,
    overflowY: selfScrolling ? "hidden" : "auto",
    overflowX: selfScrolling ? "clip" : "hidden",
    display: column ? "flex" : undefined,
    flexDirection: column ? "column" : undefined,
    padding: selfScrolling
      ? (ledger ? 0 : "14px 14px 0")
      : isMobile ? "14px 14px 40px" : "20px 28px 40px",
  };
}
