import React from "react";
import { T } from "../../tokens";

/**
 * O que a lista mostra enquanto não sabe.
 *
 * Um "Carregando transações…" centralizado não diz NADA sobre o que vem: a
 * tela fica vazia, depois pisca cheia, e o olho perde a referência de onde
 * estava. O esqueleto usa a MESMA grade das linhas de verdade — data, ícone,
 * descrição, categoria, valor — então quando o dado chega nada se move de
 * lugar: só as barras viram texto.
 *
 * Quantas linhas: as que caberiam na altura disponível, não um número fixo.
 * Menos que isso deixa um buraco embaixo; mais empurra o rodapé para fora e
 * cria rolagem que some sozinha.
 */
export function TransactionsSkeleton({ rows = 8, rowHeight = 48, isMobile = false }) {
  return (
    <div aria-hidden="true" data-testid="transactions-skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "28px minmax(0,1fr) 88px"
              : "54px 30px minmax(0,1fr) auto 1fr 100px 18px",
            alignItems: "center",
            gap: 10,
            height: rowHeight,
            padding: isMobile ? "0 14px" : "0 14px",
            borderBottom: `1px solid ${T.border}`,
            /* O brilho entra ESCALONADO por linha: um pulso único no bloco
               inteiro lê como "a tela travou", e um por linha lê como
               "está chegando". */
            animation: `finclaSkelPulse 1.1s ease-in-out ${i * 0.06}s infinite`,
          }}
        >
          {!isMobile && <Bar w={30} />}
          <Bar w={isMobile ? 22 : 22} h={isMobile ? 22 : 22} r={7} />
          <Bar w={`${52 + ((i * 13) % 34)}%`} />
          {!isMobile && <Bar w={64} h={14} r={99} />}
          {!isMobile && <span />}
          <Bar w={isMobile ? 60 : 68} justify="end" />
          {!isMobile && <span />}
        </div>
      ))}
    </div>
  );
}

function Bar({ w, h = 10, r = 5, justify }) {
  return (
    <div style={{ display: "flex", justifyContent: justify === "end" ? "flex-end" : "flex-start" }}>
      <span
        style={{
          display: "block",
          width: w,
          height: h,
          borderRadius: r,
          background: T.border,
        }}
      />
    </div>
  );
}
