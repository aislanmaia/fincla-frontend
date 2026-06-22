import { useCallback, useEffect, useMemo, useState } from "react";
import { getOrgBalances } from "../../../api/balances";
import {
  listAccounts as apiListAccounts,
  createAccount as apiCreateAccount,
  updateAccount as apiUpdateAccount,
  deactivateAccount as apiDeactivateAccount,
} from "../../../api/accounts";
import { createTransfer as apiCreateTransfer } from "../../../api/transfers";

const EMPTY = {
  isLoading: false,
  isSaving: false,
  error: "",
  accounts: [],
  total: 0,
  asOf: null,
  hasLoaded: false,
};

export function formatAccountsApiError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return error?.message || "Erro inesperado ao carregar contas.";
}

/**
 * Carrega o saldo realizado por conta (GET /v1/balances) — a tela-hub de Contas
 * é dirigida pelo balance, que já traz nome/tipo/saldo/include_in_total por conta.
 * Expõe ações de criar/editar/desativar conta e transferir, que recarregam o saldo.
 */
export function useAccountsData({ organizationId, enabled = true }) {
  const [state, setState] = useState(EMPTY);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...EMPTY, isLoading: true, accounts: s.accounts, total: s.total }));
    Promise.all([getOrgBalances(organizationId), apiListAccounts(organizationId)])
      .then(([balances, accounts]) => {
        if (cancelled) return;
        // Merge full account metadata (institution/color/icon_key) onto each balance
        // row so the list can drive the edit modal without an extra fetch.
        const byId = Object.fromEntries((accounts || []).map((a) => [a.id, a]));
        const rows = (balances.accounts || []).map((b) => ({ ...byId[b.account_id], ...b, id: b.account_id }));
        setState({
          isLoading: false,
          isSaving: false,
          error: "",
          accounts: rows,
          total: Number(balances.total || 0),
          asOf: balances.as_of || null,
          hasLoaded: true,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ ...EMPTY, error: formatAccountsApiError(error), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, version]);

  const run = useCallback(
    async (fn) => {
      if (!organizationId) return null;
      setState((s) => ({ ...s, isSaving: true, error: "" }));
      try {
        const result = await fn();
        reload();
        return result;
      } catch (error) {
        setState((s) => ({ ...s, isSaving: false, error: formatAccountsApiError(error) }));
        throw error;
      }
    },
    [organizationId, reload],
  );

  const createAccount = useCallback((body) => run(() => apiCreateAccount(organizationId, body)), [run, organizationId]);
  const updateAccount = useCallback(
    (accountId, body) => run(() => apiUpdateAccount(accountId, organizationId, body)),
    [run, organizationId],
  );
  const deactivateAccount = useCallback(
    (accountId) => run(() => apiDeactivateAccount(accountId, organizationId)),
    [run, organizationId],
  );
  const transfer = useCallback((body) => run(() => apiCreateTransfer(organizationId, body)), [run, organizationId]);

  const totalAll = useMemo(
    () => state.accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0),
    [state.accounts],
  );

  return useMemo(
    () => ({ ...state, totalAll, createAccount, updateAccount, deactivateAccount, transfer, reload }),
    [state, totalAll, createAccount, updateAccount, deactivateAccount, transfer, reload],
  );
}
