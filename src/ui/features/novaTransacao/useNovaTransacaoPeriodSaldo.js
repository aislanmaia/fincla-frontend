import { useEffect, useState, useRef } from "react";
import { getTransactionsSummary } from "../../../api/transactions";
import { handleApiError } from "../../../api/client";
import { monthBoundsFromYmd } from "../../data/novaTransacaoImpactUtils.js";

const SUMMARY_DEBOUNCE_MS = 450;
const CACHE_TTL_MS = 45_000;

/** @type {Map<string, { balance: number; at: number }>} */
const summaryCache = new Map();

/** Invalida cache após criar/editar transação (próximo saldo na API). */
export function clearNovaTransacaoSummaryCache() {
  summaryCache.clear();
}

function cacheKey(organizationId, start, end) {
  return `${organizationId}|${start}|${end}`;
}

/**
 * Saldo do período = mesmo contrato do dashboard (`GET /transactions/summary`),
 * para o mês civil da data do lançamento (`txDateYmd`).
 * Cache em memória + debounce para evitar rajadas de chamadas.
 */
export function useNovaTransacaoPeriodSaldo({
  open,
  organizationId,
  dataMode,
  txDateYmd,
}) {
  const live = Boolean(organizationId) && dataMode === "live";

  const [periodBalance, setPeriodBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open || !live || !organizationId || !txDateYmd) {
      setPeriodBalance(null);
      setError("");
      setLoading(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    const bounds = monthBoundsFromYmd(txDateYmd);
    if (!bounds) {
      setPeriodBalance(null);
      setError("");
      setLoading(false);
      return;
    }

    const key = cacheKey(organizationId, bounds.start, bounds.end);
    const cached = summaryCache.get(key);
    const now = Date.now();
    if (cached && now - cached.at < CACHE_TTL_MS) {
      setPeriodBalance(cached.balance);
      setError("");
      setLoading(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    let cancelled = false;

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setLoading(true);
      setError("");
      getTransactionsSummary({
        organization_id: organizationId,
        date_start: bounds.start,
        date_end: bounds.end,
      })
        .then((res) => {
          if (cancelled) return;
          const b = Number(res?.balance);
          const bal = Number.isFinite(b) ? b : null;
          if (bal != null) {
            summaryCache.set(key, { balance: bal, at: Date.now() });
          }
          setPeriodBalance(bal);
          setError("");
        })
        .catch((e) => {
          if (cancelled) return;
          setPeriodBalance(null);
          setError(handleApiError(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SUMMARY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [open, live, organizationId, txDateYmd]);

  return { periodBalance, loading, error, live };
}

/**
 * @param {number|null} periodBalance
 * @param {'despesa'|'receita'} tipo
 * @param {number} valorNum
 */
export function projectedBalanceAfterTx(periodBalance, tipo, valorNum) {
  if (periodBalance == null || !Number.isFinite(periodBalance)) return null;
  if (!(valorNum > 0)) return null;
  const delta = tipo === "receita" ? valorNum : -valorNum;
  return periodBalance + delta;
}

export function fmtSaldoLine(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  return `${sign}R$ ${abs.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
