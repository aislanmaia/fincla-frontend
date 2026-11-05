import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrgBalances } from "../../../api/balances";
import { handleApiError } from "../../../api/client";
import {
  listAccounts as apiListAccounts,
  createAccount as apiCreateAccount,
  updateAccount as apiUpdateAccount,
  deactivateAccount as apiDeactivateAccount,
} from "../../../api/accounts";
import { createTransfer as apiCreateTransfer } from "../../../api/transfers";
import {
  createBalanceAdjustment as apiCreateBalanceAdjustment,
  listBalanceAdjustments as apiListBalanceAdjustments,
  updateBalanceAdjustment as apiUpdateBalanceAdjustment,
  deleteBalanceAdjustment as apiDeleteBalanceAdjustment,
} from "../../../api/balanceAdjustments";

const EMPTY = {
  isLoading: false,
  isSaving: false,
  error: "",
  accounts: [],
  // `null` e não `0`: antes de carregar não sabemos o saldo, e zero afirmaria
  // que a pessoa não tem dinheiro. A tela distingue "carregando" de "sem total".
  total: null,
  consolidation: null,
  asOf: null,
  hasLoaded: false,
};

/**
 * Mesmo formatador do resto do app (`handleApiError`), que lê as três formas de
 * `detail`: string, objeto `{code, message}` e o array de validação do FastAPI.
 *
 * A versão própria daqui só lia string e array. Desde o fincla-api#466 a
 * transferência com uma conta desativada responde 422 com `detail` OBJETO, e a
 * tela caía no `error.message` do axios ("Request failed with status code
 * 422") em vez de dizer qual conta está desativada (#291).
 */
export function formatAccountsApiError(error) {
  return handleApiError(error);
}

/**
 * Carrega o saldo realizado por conta (GET /v1/balances) — a tela-hub de Contas
 * é dirigida pelo balance, que já traz nome/tipo/saldo/include_in_total por conta.
 * Expõe ações de criar/editar/desativar conta e transferir, que recarregam o saldo.
 */
export function useAccountsData({
  organizationId,
  enabled = true,
  lente = null,
  /** Sobe a cada transação criada/editada/excluída no app (#264): o saldo por conta
      muda com ela, e sem isto a tela seguia mostrando o valor anterior até o F5. */
  refreshKey = 0,
}) {
  const [state, setState] = useState(EMPTY);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Chave da última leitura BEM-SUCEDIDA (org + lente). Mesma chave = recarga de
  // algo já na tela (transação salva, conta editada): o que está lá continua lá —
  // lista, total E a moeda/recibo dele — até o número novo chegar, e uma falha
  // na recarga não apaga os saldos que a pessoa estava vendo. Chave diferente
  // (outra org, outra lente) = leitura nova: o total anterior estaria em outra
  // moeda, então ele não sobrevive.
  const loadedKeyRef = useRef(null);

  useEffect(() => {
    if (!enabled || !organizationId) {
      loadedKeyRef.current = null;
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    const key = `${organizationId}|${lente ?? ""}`;
    const isRefresh = loadedKeyRef.current === key;
    setState((s) => (isRefresh ? { ...s, isLoading: true, error: "" } : { ...EMPTY, isLoading: true }));
    // `lente` é a moeda de EXIBIÇÃO escolhida na hora (#138). Ela entra na chave do
    // efeito, então trocar a lente refaz a leitura — e não é gravada em lugar
    // nenhum: recarregar a página volta para a moeda base da organização.
    Promise.all([
      getOrgBalances(organizationId, undefined, lente),
      apiListAccounts(organizationId),
    ])
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
          // NÃO coage `null` para zero. O backend devolve `total: null` quando a
          // organização tem conta em mais de uma moeda e não houve cotação para
          // consolidar (fincla-api#138). `Number(null || 0)` viraria "R$ 0,00" na
          // tela, afirmando que a pessoa não tem dinheiro — o "zero inventado" que
          // `api/money.js` proíbe. A ausência sobe até a tela, que a mostra.
          total: balances.total,
          consolidation: balances.consolidation || null,
          asOf: balances.as_of || null,
          hasLoaded: true,
        });
        loadedKeyRef.current = key;
      })
      .catch((error) => {
        if (cancelled) return;
        const message = formatAccountsApiError(error);
        if (isRefresh) {
          // Os saldos anteriores continuam visíveis; `refreshFailed` impede a tela
          // de chamá-los de "atualizados agora".
          setState((s) => ({ ...s, isLoading: false, error: message, refreshFailed: true }));
          return;
        }
        setState({ ...EMPTY, error: message, hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, version, lente, refreshKey]);

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
  const editAdjustment = useCallback(
    (adjustmentId, changes) => run(() => apiUpdateBalanceAdjustment(adjustmentId, organizationId, changes)),
    [run, organizationId],
  );
  const adjustBalance = useCallback(
    (accountId, body) => run(() => apiCreateBalanceAdjustment(accountId, organizationId, body)),
    [run, organizationId],
  );
  const deleteAdjustment = useCallback(
    (adjustmentId) => run(() => apiDeleteBalanceAdjustment(adjustmentId, organizationId)),
    [run, organizationId],
  );
  // Read-only: does not toggle isSaving nor reload balances.
  const listAdjustments = useCallback(
    (accountId) => (organizationId ? apiListBalanceAdjustments(accountId, organizationId) : Promise.resolve([])),
    [organizationId],
  );

  const totalAll = useMemo(
    () => state.accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0),
    [state.accounts],
  );

  return useMemo(
    () => ({
      ...state,
      totalAll,
      createAccount,
      updateAccount,
      deactivateAccount,
      transfer,
      adjustBalance,
      listAdjustments,
      deleteAdjustment,
      editAdjustment,
      reload,
    }),
    [
      state,
      totalAll,
      createAccount,
      updateAccount,
      deactivateAccount,
      transfer,
      adjustBalance,
      listAdjustments,
      deleteAdjustment,
      editAdjustment,
      reload,
    ],
  );
}
