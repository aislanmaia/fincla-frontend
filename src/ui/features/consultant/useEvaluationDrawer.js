import { useCallback, useState } from "react";

/**
 * Estado do drawer "Avaliar com IA", compartilhado pelas três superfícies que
 * expõem a ação (Carteira, Painel e Relatório).
 *
 * O alvo carrega `organizationId` + `clientName` porque o drawer precisa do id
 * para chamar o endpoint e do nome para o cabeçalho — os três chamadores já têm
 * o objeto `client` enriquecido em mãos.
 *
 * Fechar o drawer pode desmontá-lo à vontade: a avaliação **não mora aqui**, e
 * sim em `clientEvaluationStore` (fora do React), por cliente. Reabrir
 * reencontra a run — em voo ou pronta — em vez de disparar outra.
 */
export function useEvaluationDrawer() {
  const [target, setTarget] = useState(null);

  const openFor = useCallback((client) => {
    if (!client?.organization_id) return;
    setTarget({ organizationId: client.organization_id, clientName: client.client_name });
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return { target, openFor, close };
}
