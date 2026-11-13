import { useEffect, useState } from "react";
import { getQuotation } from "../../../api/transfers";
import { PLAIN_DECIMAL_RE } from "../../money/convertAmount.js";
import { convertByQuote, quoteDirection } from "../../money/quoteDirection.js";

/** Cotações já resolvidas nesta sessão do app, por par: alternar contas não rebusca. */
const quoteCache = new Map();

/** Para os testes: cada um começa sem cotação em memória. */
export function clearDraftQuoteCache() {
  quoteCache.clear();
}

/**
 * O valor do rascunho na moeda `base` — a do "Resultado do mês" (#503).
 *
 * O resultado do mês vem do resumo da organização, já CONVERTIDO para a base pelo
 * backend; somar a ele o valor digitado numa conta em dólar como se fosse real era o
 * defeito. Aqui o valor é convertido pela cotação do par (`GET /quotations`), na
 * direção que a tela usa em toda parte (`quoteDirection`: "1 <estrangeira> = <base>").
 * Sem cotação usável não há número — `unavailable`, nunca taxa 1 nem zero.
 *
 * @returns {{ status: 'idle'|'same'|'loading'|'ready'|'unavailable', value: number|null }}
 */
export function useDraftAmountInBase({ enabled, organizationId, amount, from, base }) {
  const f = from ? String(from).toUpperCase() : null;
  const b = base ? String(base).toUpperCase() : null;
  const crossCurrency = Boolean(enabled && organizationId && f && b && f !== b);
  const pairKey = crossCurrency ? `${f}>${b}` : null;

  const [, setTick] = useState(0);

  useEffect(() => {
    if (!pairKey || quoteCache.has(pairKey)) return undefined;
    let cancelled = false;
    const direction = quoteDirection({ from: f, to: b, base: b });
    quoteCache.set(pairKey, { status: "loading" });
    getQuotation(organizationId, direction.base, direction.quote)
      .then((q) => {
        const rate = String(q?.rate ?? "").trim();
        if (!PLAIN_DECIMAL_RE.test(rate) || !/[1-9]/.test(rate)) throw new Error("unusable rate");
        return { status: "ready", rate, direction };
      })
      .catch(() => ({ status: "unavailable" }))
      .then((entry) => {
        quoteCache.set(pairKey, entry);
        if (!cancelled) setTick((t) => t + 1);
      });
    return () => {
      cancelled = true;
      // Saiu antes de responder: a próxima montagem pede de novo em vez de herdar
      // um "loading" que ninguém vai resolver.
      if (quoteCache.get(pairKey)?.status === "loading") quoteCache.delete(pairKey);
    };
  }, [pairKey, organizationId, f, b]);

  if (!enabled || !f || !b) return { status: "idle", value: null };
  if (f === b) return { status: "same", value: Number.isFinite(amount) ? amount : null };

  const entry = (pairKey && quoteCache.get(pairKey)) || { status: "loading" };
  if (entry.status !== "ready") return { status: entry.status, value: null };
  if (!(amount > 0)) return { status: "ready", value: null };
  const converted = convertByQuote(Math.abs(amount).toFixed(2), entry.rate, entry.direction.op);
  const n = converted == null ? NaN : Number(converted);
  return Number.isFinite(n) ? { status: "ready", value: n } : { status: "unavailable", value: null };
}
