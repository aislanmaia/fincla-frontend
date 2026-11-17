// Os dados do atalho "Conciliar extrato" da tela de Transações, guardados no nível da PÁGINA (G3,
// achados 1, 2, 4 e 5): o botão muda de lugar (linha do chip, linha da contagem, linha própria no
// celular) e o React o remonta a cada troca. Aqui ficam os rascunhos, o "N de 8 passos" e a última
// concluída de cada conta, para a troca não repetir pedidos nem fazer o botão piscar.
//
// - Rascunhos da organização: UM pedido por organização (de novo só se a organização mudar ou o
//   atalho deixar de valer e voltar, ex.: troca de papel).
// - Detalhe de rascunho (o "N de 8 passos"): só quando alguém pede (`loadProgress`), uma vez por
//   rascunho. Uma resposta nunca é jogada fora porque o filtro mudou no meio do caminho: ela é do
//   rascunho, não do filtro.
// - Lista de extratos da conta (a última concluída, no menu): só quando o menu pede
//   (`loadConcluded`), uma vez por conta enquanto a tela está montada. Falhou → pode tentar de novo
//   na próxima abertura.
// - Resposta de outra organização (pedido feito antes da troca) é ignorada.
import { useCallback, useEffect, useRef, useState } from "react";

import { getStatementImport, listStatementImportDrafts, listStatementImports } from "../../../api/statementImports";
import { passedStepsOf, stepProgress } from "./reconciliationSteps.js";
import { latestConcludedEnd, latestDraftByAccount } from "./reconcileShortcut.js";

const emptyState = (scope) => ({ scope, drafts: "loading", progress: {}, concluded: {} });
const emptyRequests = (scope) => ({ scope, drafts: false, progress: new Set(), concluded: new Set() });

/**
 * @param organizationId a organização da tela.
 * @param enabled o atalho existe (dono, dados reais, ao menos uma conta elegível).
 */
export function useReconcileShortcutData({ organizationId, enabled }) {
  const scope = enabled && organizationId ? organizationId : null;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const requests = useRef(emptyRequests(scope));
  if (requests.current.scope !== scope) requests.current = emptyRequests(scope);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [state, setState] = useState(() => emptyState(scope));
  /** Aplica a resposta de um pedido feito em `forScope` — se ainda for a organização da tela. */
  const accept = useCallback((forScope, change) => {
    if (!mounted.current || scopeRef.current !== forScope) return;
    setState((cur) => change(cur.scope === forScope ? cur : emptyState(forScope)));
  }, []);

  useEffect(() => {
    const req = requests.current;
    if (!scope || req.scope !== scope || req.drafts) return;
    req.drafts = true;
    listStatementImportDrafts(scope)
      .then((list) => accept(scope, (cur) => ({ ...cur, drafts: latestDraftByAccount(list) })))
      .catch(() => accept(scope, (cur) => ({ ...cur, drafts: "error" })));
  }, [scope, accept]);

  const loadProgress = useCallback((drafts) => {
    const forScope = scopeRef.current;
    const req = requests.current;
    if (!forScope || req.scope !== forScope) return;
    for (const d of drafts) {
      if (req.progress.has(d.id)) continue;
      req.progress.add(d.id);
      getStatementImport(d.account_id, forScope, d.id)
        .then((detail) => accept(forScope, (cur) => ({
          ...cur, progress: { ...cur.progress, [d.id]: stepProgress(detail, passedStepsOf(detail)) },
        })))
        .catch(() => accept(forScope, (cur) => ({ ...cur, progress: { ...cur.progress, [d.id]: "error" } })));
    }
  }, [accept]);

  const loadConcluded = useCallback((accountIds) => {
    const forScope = scopeRef.current;
    const req = requests.current;
    if (!forScope || req.scope !== forScope) return;
    for (const id of accountIds) {
      if (req.concluded.has(id)) continue;
      req.concluded.add(id);
      listStatementImports(id, forScope)
        .then((items) => accept(forScope, (cur) => ({
          ...cur, concluded: { ...cur.concluded, [id]: { end: latestConcludedEnd(items), any: items.length > 0 } },
        })))
        // Sem a lista, a linha fica só com o nome; a próxima abertura tenta de novo.
        .catch(() => { if (requests.current === req) req.concluded.delete(id); });
    }
  }, [accept]);

  const current = state.scope === scope ? state : emptyState(scope);
  const draftsStatus = current.drafts === "loading" || current.drafts === "error" ? current.drafts : "ok";
  const draftByAccount = draftsStatus === "ok" ? current.drafts : null;
  const progressOf = (draft) => {
    const p = draft ? current.progress[draft.id] : null;
    return p && p !== "error" ? p : null;
  };
  const concludedOf = (accountId) => current.concluded[accountId] ?? null;

  return { draftsStatus, draftByAccount, progressOf, concludedOf, loadProgress, loadConcluded };
}
