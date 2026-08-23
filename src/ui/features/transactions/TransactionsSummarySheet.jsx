import React, { useEffect } from "react";
import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * O resumo do filtro, em sheet — o caminho do mobile para os KPIs.
 *
 * No mobile a faixa de KPIs não existe: o cabeçalho da lista já carrega a
 * contagem, a situação e o RESULTADO, e os outros dois números abrem aqui.
 * A faixa custava ~87 px de altura permanentes numa tela que tem 844, e a
 * alternativa antes tentada — três números atrás de uma rolagem lateral — é
 * pior ainda: esconde informação atrás de um gesto que ninguém adivinha.
 *
 * Aqui os números ganham o que não cabia na faixa: quantos lançamentos formam
 * cada total e a média. Um total sem a contagem que o formou não deixa julgar
 * se ele é alto por serem muitos lançamentos ou por um único fora da curva.
 */
export function TransactionsSummarySheet({
  open,
  onClose,
  receita,
  despesa,
  resultado,
  countReceita = 0,
  countDespesa = 0,
  totalEstorno = 0,
  countsArePartial = false,
  fmt,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const media = (total, n) => (n > 0 ? fmt(Math.abs(total) / n) : null);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 520, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <button
        type="button"
        aria-label="Fechar resumo"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "rgba(10,16,24,.28)",
          cursor: "pointer",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resumo do filtro"
        style={{
          position: "relative",
          background: T.surface,
          borderRadius: "22px 22px 0 0",
          boxShadow: "0 -8px 32px rgba(0,0,0,.16)",
          // `dvh`, não `vh`: a barra do navegador no mobile muda a altura da
          // viewport, e `vh` ignora isso — a sheet ficaria cortada.
          maxHeight: "76dvh",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          animation: "sheetUp 0.22s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <div style={{ flex: "none", padding: "10px 0 6px", display: "flex", justifyContent: "center" }}>
          <i aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(0,0,0,.16)" }} />
        </div>
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 16px 12px" }}>
          <span style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink }}>Resumo do filtro</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ ...G, background: "none", border: "none", color: T.inkLight, fontSize: 15, cursor: "pointer", padding: 4 }}
          >
            ✕
          </button>
        </div>

        <div className="fincla-scroll" style={{ overflowY: "auto", padding: "0 16px 18px", display: "grid", gap: 12 }}>
          <Row
            label="Receitas"
            value={`+${fmt(receita)}`}
            color={T.green}
            detail={
              countsArePartial
                ? null
                : [
                    `${countReceita} ${countReceita === 1 ? "lançamento" : "lançamentos"}`,
                    media(receita, countReceita) ? `média ${media(receita, countReceita)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <Row
            label="Despesas"
            value={`−${fmt(Math.abs(despesa))}`}
            color={T.red}
            detail={
              countsArePartial
                ? null
                : [
                    `${countDespesa} ${countDespesa === 1 ? "lançamento" : "lançamentos"}`,
                    media(despesa, countDespesa) ? `média ${media(despesa, countDespesa)}` : null,
                    totalEstorno ? `${fmt(totalEstorno)} estornados` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <Row
            label="Resultado"
            value={`${resultado >= 0 ? "+" : "−"}${fmt(Math.abs(resultado))}`}
            color={resultado >= 0 ? T.green : T.red}
            strong
          />
          {countsArePartial && (
            // Com o total vindo do servidor, as contagens por tipo descrevem só
            // a página carregada. Dizer "2 lançamentos" sobre um total de 200
            // seria mentira; melhor omitir o detalhe e explicar por quê.
            <div style={{ ...G, fontSize: 11, color: T.inkLight }}>
              Os totais somam o filtro inteiro. As contagens por tipo dependem de
              carregar a lista toda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color, detail, strong = false }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        background: strong ? T.bg : T.surface,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>{label}</span>
        <span
          style={{
            ...G,
            fontFamily: "'Geist Mono', monospace",
            fontSize: strong ? 17 : 15,
            fontWeight: 800,
            color,
          }}
        >
          {value}
        </span>
      </div>
      {detail && (
        <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 4 }}>{detail}</div>
      )}
    </div>
  );
}
