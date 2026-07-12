import { useCallback, useState } from "react";

/**
 * Estado do drawer "Avaliar com IA", compartilhado pelas três superfícies que
 * expõem a ação (Carteira, Painel e Relatório).
 *
 * O alvo carrega `organizationId` + `clientName` porque o drawer precisa do id
 * para chamar o endpoint e do nome para o cabeçalho — os três chamadores já têm
 * o objeto `client` enriquecido em mãos.
 *
 * **`target` é pegajoso: `close()` NÃO o apaga.** Ele existe para manter o drawer
 * *montado* mesmo fechado, e `open` diz apenas se ele aparece. A versão anterior
 * desmontava o drawer ao fechar ("cada abertura é uma montagem nova") — e isso
 * matava o estado do `useClientEvaluation` junto. Uma avaliação em voo virava
 * órfã: o backend a levava até o fim (gastando ~20 mil tokens), o resultado era
 * descartado, e reabrir o painel disparava uma SEGUNDA avaliação paga em
 * paralelo. Medido no ledger: duas runs do mesmo cliente com 4 s de diferença,
 * 45.853 tokens de entrada para uma única avaliação pedida.
 *
 * Mantendo o drawer montado, fechar e reabrir reencontra a MESMA run — rodando
 * ou já pronta.
 */
export function useEvaluationDrawer() {
  const [target, setTarget] = useState(null);
  const [open, setOpen] = useState(false);

  const openFor = useCallback((client) => {
    if (!client?.organization_id) return;
    // Preserva a identidade do objeto quando é o mesmo cliente: trocar `target`
    // por um objeto novo mudaria a prop `organizationId`… não, o id é o mesmo —
    // mas manter a referência evita renders inúteis do drawer.
    setTarget((prev) =>
      prev?.organizationId === client.organization_id
        ? prev
        : { organizationId: client.organization_id, clientName: client.client_name }
    );
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return { target, open, openFor, close };
}
