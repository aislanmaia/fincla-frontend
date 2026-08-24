import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { PanelHeader } from "./PanelHeader.jsx";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

export function ValuePanel({
  valueMin,
  valueMax,
  setValueMin,
  setValueMax,
  counts,
  onClose,
  compact = false,
}) {
  const buckets = counts?.buckets;
  const peak = Array.isArray(buckets) ? Math.max(1, ...buckets.map((b) => b.count)) : 1;

  /**
   * Clicar numa barra escreve a faixa DELA nos campos. As duas pontas do
   * bucket são inclusivas no backend — é por isso que ele devolve `to: 49.99`
   * e não `to: 50`: mandar 50 traria também as linhas da barra seguinte, e a
   * barra entregaria um número diferente do que ela mesma mostra.
   */
  const applyBucket = (b) => {
    // Clicar na barra que JÁ é a faixa inteira desmarca — o mesmo gesto
    // desfaz, sem precisar de um segundo controle para limpar.
    const soEla =
      parseBrl(valueMin) === limiteRedondo(b.from) &&
      parseBrl(valueMax) === limiteRedondo(b.to);
    if (soEla) {
      setValueMin("");
      setValueMax("");
      return;
    }
    setValueMin(b.from == null ? "" : formatBrl(limiteRedondo(b.from)));
    setValueMax(b.to == null ? "" : formatBrl(limiteRedondo(b.to)));
  };

  const arrastoRef = useRef(null);
  /* A faixa que o arrasto está desenhando. Ela NÃO vai para os campos enquanto
     o gesto corre: `setValueMin/Max` alimentam o filtro, e o filtro dispara
     lista + summary sem debounce — arrastar por seis barras eram doze
     requisições para um gesto com um só estado final. Aqui a faixa fica local e
     só é gravada ao soltar. */
  const [faixaArrasto, setFaixaArrasto] = useState(null);
  const arrastouRef = useRef(false);

  // Durante o arrasto, o histograma mostra a faixa do gesto — não a gravada.
  const min = parseBrl(faixaArrasto ? faixaArrasto.min : valueMin);
  const max = parseBrl(faixaArrasto ? faixaArrasto.max : valueMax);
  const temFaixa = min != null || max != null;

  /* A faixa que o arrasto cobre: da borda de baixo da primeira barra à borda de
     cima da última, com os limites arredondados pela mesma régua dos atalhos —
     um `to` de 999,99 num campo de MÁXIMO não quer dizer nada para quem lê. */
  const faixaDeBarras = (i, j) => {
    if (!Array.isArray(buckets)) return null;
    const primeiro = buckets[Math.min(i, j)];
    const ultimo = buckets[Math.max(i, j)];
    if (!primeiro || !ultimo) return null;
    return {
      min: primeiro.from == null ? "" : formatBrl(limiteRedondo(primeiro.from)),
      max: ultimo.to == null ? "" : formatBrl(limiteRedondo(ultimo.to)),
    };
  };

  /* Soltar o ponteiro FORA do histograma nunca chegava ao container, e o
     arrasto ficava armado: depois disso, só passar o mouse sobre as barras —
     sem botão nenhum apertado — reescrevia os campos a cada barra cruzada.
     O listener é global por isso. */
  useEffect(() => {
    const solta = () => {
      if (!arrastoRef.current) return;
      arrastoRef.current = null;
      setFaixaArrasto((faixa) => {
        if (faixa) {
          setValueMin(faixa.min);
          setValueMax(faixa.max);
        }
        return null;
      });
    };
    window.addEventListener("pointerup", solta);
    window.addEventListener("pointercancel", solta);
    return () => {
      window.removeEventListener("pointerup", solta);
      window.removeEventListener("pointercancel", solta);
    };
  }, [setValueMin, setValueMax]);

  const edges = Array.isArray(buckets) ? bucketEdges(buckets, min, max) : { first: -1, last: -1 };
  const temBarras = Array.isArray(buckets) && buckets.some((b) => b.count > 0);

  /* Atalhos em números REDONDOS. O `.99` existe nas faixas do backend para as
     barras do histograma não se sobreporem — ali ele é necessário, porque a
     barra precisa devolver exatamente o número que mostra. Mas num CAMPO ele
     só confunde: quem lê "até R$ 50" e vê 49,99 escrito no máximo não pensa
     "ah, exclusivo" — pensa que a tela errou. E o custo de usar 50 é uma
     transação de exatos R$ 50,00 entrar no recorte, que é justamente o que
     "até R$ 50" promete. */
  const ATALHOS = [
    { label: "até R$ 50", from: null, to: 50 },
    { label: "R$ 50–250", from: 50, to: 250 },
    { label: "acima de R$ 250", from: 250, to: null },
  ];
  /* Quantas transações cada atalho traria. Conta só as barras INTEIRAMENTE
     dentro do intervalo, não as que ele apenas toca: com atalhos em números
     redondos e barras fechadas no `.99`, "R$ 50–250" encosta na barra de
     250–500 e somá-la inflava o número para mais que o total da tela.
     Contido é um piso honesto; tocado seria uma promessa falsa. */
  const contaAtalho = (a) => {
    if (!Array.isArray(buckets)) return null;
    const min = a.from == null ? Number.NEGATIVE_INFINITY : a.from;
    const max = a.to == null ? Number.POSITIVE_INFINITY : a.to;
    return buckets.reduce((n, bk) => {
      const lo = bk.from == null ? Number.NEGATIVE_INFINITY : bk.from;
      const hi = bk.to == null ? Number.POSITIVE_INFINITY : bk.to;
      return n + (lo >= min && hi <= max ? bk.count : 0);
    }, 0);
  };
  const atalhoAtivo = (a) =>
    (a.from == null ? min == null : min === a.from) && (a.to == null ? max == null : max === a.to);
  const aplicarAtalho = (a) => {
    if (atalhoAtivo(a)) {
      setValueMin("");
      setValueMax("");
      return;
    }
    setValueMin(a.from == null ? "" : formatBrl(a.from));
    setValueMax(a.to == null ? "" : formatBrl(a.to));
  };

  return (
    <div>
      <PanelHeader
        title="Faixa de valor"
        hint="Em módulo: receita ou despesa"
        onClose={onClose}
        compact={compact}
      />

      {/* O histograma vem ANTES dos campos. Pedir "valor mínimo" a quem não
          conhece a distribuição dos próprios gastos é pedir um chute; com as
          barras à vista a escolha vira leitura. */}
      {temBarras && (
        <div
          role="group"
          aria-label="Distribuição por faixa de valor"
          /* Arrastar sobre as barras seleciona a FAIXA inteira do gesto.
             Clicar barra a barra obriga a somar faixas de cabeça; arrastar diz
             "daqui até ali", que é como a pessoa lê o próprio histograma.
             O clique simples continua valendo — o arrasto só entra quando o
             ponteiro atravessa para outra barra, então um clique preciso nunca
             vira um arrasto de uma barra só. */
          onPointerDown={(e) => {
            const alvo = e.target.closest("button[data-bucket]");
            if (!alvo) return;
            arrastoRef.current = { de: Number(alvo.dataset.bucket), ate: null };
            arrastouRef.current = false;
          }}
          onPointerMove={(e) => {
            const arr = arrastoRef.current;
            if (!arr) return;
            const alvo = document.elementFromPoint(e.clientX, e.clientY);
            const btn = alvo && alvo.closest("button[data-bucket]");
            if (!btn) return;
            const i = Number(btn.dataset.bucket);
            if (i === arr.de || i === arr.ate) return;
            arr.ate = i;
            arrastouRef.current = true;
            setFaixaArrasto(faixaDeBarras(arr.de, i));
          }}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
            gap: 4,
            alignItems: "end",
            height: 64,
            marginBottom: 6,
          }}
        >
          {buckets.map((b, i) => {
            const dentro = temFaixa && isBucketInRange(b, min, max);
            const ponta = dentro && (i === edges.first || i === edges.last);
            const label = bucketLabel(b);
            return (
              <button
                type="button"
                key={label}
                data-bucket={i}
                onClick={() => {
                  /* O `click` chega DEPOIS do `pointerup`, que já limpou
                     `arrastoRef` — por isso a guarda é uma flag própria. Sem
                     ela, arrastar da barra 2 até a 5 e voltar soltando na 2
                     disparava `applyBucket(2)` e a faixa que a pessoa acabou de
                     arrastar colapsava numa barra só. */
                  if (arrastouRef.current) {
                    arrastouRef.current = false;
                    return;
                  }
                  applyBucket(b);
                }}
                aria-pressed={dentro}
                aria-label={`${label}: ${b.count} ${b.count === 1 ? "transação" : "transações"}`}
                title={`${label} · ${b.count}`}
                disabled={b.count === 0}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  alignItems: "stretch",
                  gap: 4,
                  height: "100%",
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: b.count === 0 ? "default" : "pointer",
                  opacity: b.count === 0 ? 0.4 : 1,
                }}
              >
                <span
                  style={{
                    ...G,
                    ...MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    color: ponta ? T.ink : dentro ? T.blue : T.inkLight,
                    textAlign: "center",
                  }}
                >
                  {b.count}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    /* Piso de 6px e escala em RAIZ. Com contagens pequenas e
                       um pico alto, a proporção linear achatava quase tudo em
                       3px — seis traços indistinguíveis, que não deixam ler
                       onde o dinheiro está. A raiz preserva a ordem e mantém
                       as barras pequenas visíveis. */
                    height: b.count === 0 ? 4
                      : Math.max(6, Math.round(Math.sqrt(b.count / peak) * 40)),
                    borderRadius: "3px 3px 0 0",
                    // Ponta escura, miolo azul: com 30 a 800 digitado à mão as
                    // cinco barras da faixa acendem e as duas das pontas dizem
                    // onde ela começa e termina.
                    background: ponta ? T.ink : dentro ? T.blue : T.border,
                    transition: "background 120ms ease",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
      {temBarras && (
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
            gap: 4,
            marginBottom: compact ? 12 : 16,
          }}
        >
          {buckets.map((b) => (
            <span
              key={bucketLabel(b)}
              style={{
                ...G,
                ...MONO,
                fontSize: 10,
                color: T.inkLight,
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {bucketShortLabel(b)}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1fr 1fr",
          gap: compact ? 10 : 16,
        }}
      >
        <ValueField
          label="Mínimo"
          value={valueMin}
          placeholder="0,00"
          ariaLabel="Valor mínimo"
          onChange={setValueMin}
        />
        <ValueField
          label="Máximo"
          value={valueMax}
          placeholder="sem limite"
          ariaLabel="Valor máximo"
          onChange={setValueMax}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: compact ? 12 : 14 }}>
        {ATALHOS.map((a) => {
          const on = atalhoAtivo(a);
          return (
            <button
              type="button"
              key={a.label}
              onClick={() => aplicarAtalho(a)}
              aria-pressed={on}
              style={{
                ...G,
                height: 30,
                padding: "0 11px",
                borderRadius: 99,
                border: `1px solid ${on ? T.ink : T.border}`,
                background: on ? T.ink : T.surface,
                color: on ? "#fff" : T.inkMid,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {a.label}
              {contaAtalho(a) != null && (
                <span
                  style={{
                    ...G, ...MONO, marginLeft: 6, fontSize: 10,
                    color: on ? "rgba(255,255,255,.72)" : T.inkLight,
                  }}
                >
                  {contaAtalho(a)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** `1234.5` → `"1234,50"`, o formato que os campos desta tela aceitam de volta. */
function formatBrl(n) {
  return n.toFixed(2).replace(".", ",");
}

function bucketLabel(b) {
  // Rótulos em números redondos, pelo mesmo motivo dos campos.
  const de = limiteRedondo(b.from);
  const ate = limiteRedondo(b.to);
  if (de == null) return `Até R$ ${formatBrl(ate)}`;
  if (ate == null) return `R$ ${formatBrl(de)} ou mais`;
  return `R$ ${formatBrl(de)} a ${formatBrl(ate)}`;
}

function bucketShortLabel(b) {
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));
  if (b.from == null) return `<${k(limiteRedondo(b.to))}`;
  if (b.to == null) return `${k(b.from)}+`;
  return k(b.from);
}

/** `"1.234,50"` → `1234.5`. Vazio ou lixo vira `null`, que significa sem limite. */
/**
 * O limite REDONDO de uma faixa: 49,99 → 50, 999,99 → 1000.
 *
 * O `.99` existe no backend para as faixas do histograma não se sobreporem —
 * lá ele é necessário, porque cada barra precisa devolver exatamente o número
 * que mostra. Mas ele nunca deve chegar a um CAMPO nem a um rótulo: ninguém
 * pensa "até R$ 999,99", pensa "até mil". O preço é uma transação de exatos
 * R$ 1.000,00 entrar no recorte de "500 a 1.000" — que é o que o rótulo
 * promete de qualquer forma.
 */
export function limiteRedondo(n) {
  return n == null ? null : Math.ceil(n);
}

export function parseBrl(v) {
  if (typeof v !== "string") return null;
  const t = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (t === "" || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * A barra está acesa quando ela INTERSECTA a faixa escolhida — não quando os
 * campos batem exatamente com os limites dela.
 *
 * A regra anterior era exata, e por isso o histograma só acendia se a pessoa
 * tivesse clicado numa barra: digitar 30 a 800 à mão deixava as seis apagadas,
 * e o histograma virava enfeite justamente para quem estava mirando uma faixa
 * própria. Como as faixas do backend são fechadas nos dois lados, a
 * intersecção usa `>=` e `<=` dos dois lados.
 */
export function isBucketInRange(b, min, max) {
  const lo = b.from == null ? Number.NEGATIVE_INFINITY : b.from;
  const hi = b.to == null ? Number.POSITIVE_INFINITY : b.to;
  return (min == null || hi >= min) && (max == null || lo <= max);
}

/** A barra é PONTA quando é a primeira ou a última dentro da faixa. */
export function bucketEdges(buckets, min, max) {
  const idx = buckets.map((b, i) => (isBucketInRange(b, min, max) ? i : -1)).filter((i) => i >= 0);
  return idx.length ? { first: idx[0], last: idx[idx.length - 1] } : { first: -1, last: -1 };
}

function ValueField({ label, value, placeholder, ariaLabel, onChange }) {
  return (
    <div>
      <div
        style={{
          ...G,
          fontSize: 11,
          fontWeight: 700,
          color: T.inkMid,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "9px 12px",
          borderRadius: 9,
          border: `1px solid ${T.border}`,
          background: T.surface,
        }}
      >
        <span style={{ ...G, fontSize: 12, color: T.inkLight, fontWeight: 600 }}>R$</span>
        <input
          value={value || ""}
          placeholder={placeholder}
          aria-label={ariaLabel}
          inputMode="decimal"
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...G,
            ...MONO,
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            color: T.ink,
            fontWeight: 600,
            minWidth: 0,
          }}
        />
      </div>
    </div>
  );
}
