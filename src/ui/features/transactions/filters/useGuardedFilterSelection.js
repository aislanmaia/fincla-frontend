import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Vazio CONGELADO (mesma referência sempre): um `[]` novo por render viraria consulta nova. */
export const EMPTY_IDS = Object.freeze([]);

/**
 * Seleção de um filtro por ENTIDADE da organização (cartão #280, conta #296) que
 * viaja à API como id — e que a API recusa com 404 quando o id não existe mais.
 *
 * Uma regra só para os dois filtros, nascida no Cartão (#293):
 * - a lista de entidades é guardada COM a organização dona (`list.orgId`); trocar
 *   de org zera a seleção e, no render da troca, ela não viaja;
 * - com a lista carregada, só ids que a organização TEM viajam, e os que sumiram
 *   saem do próprio estado do filtro (chip, contador, visões), com aviso;
 * - recusas da API em dois níveis: `ids` PROVADOS inexistentes (a lista carregou
 *   sem eles) e `sets`, um CONJUNTO exato recusado sem prova de qual id falhou —
 *   assim nenhum id válido fica "envenenado"; uma lista carregada as limpa;
 * - escolher de novo um id (ação deliberada) tira-o das recusas.
 *
 * A recuperação do 404 (`useFilterNotFoundRecovery`) é um hook à parte porque o
 * erro vem da consulta que ESTA seleção alimenta: ele roda depois dela.
 *
 * @param {object} opts
 * @param {boolean} opts.enabled dados reais (fora disso a seleção não viaja)
 * @param {string|null} opts.organizationId
 * @param {Array<string|number>} opts.selection seleção do estado do filtro
 * @param {(ids: Array) => void} opts.setSelection
 * @param {(id: string) => boolean} opts.isWellFormedId forma do id que a API aceita
 * @param {{orgId: string|null, loaded: boolean}} opts.list estado da lista (objeto
 *   novo a cada resposta — é o sinal de "a releitura terminou")
 * @param {Set<string>} opts.knownIds ids da lista (memoizado)
 * @param {() => void} opts.requestListReload relê a lista de entidades
 * @param {{removedOne: string, removedMany: string, unavailable: string}} opts.messages
 */
export function useGuardedFilterSelection({
  enabled,
  organizationId,
  selection,
  setSelection,
  isWellFormedId,
  list,
  knownIds,
  requestListReload,
  messages,
}) {
  const listOfThisOrg = list.orgId === organizationId;
  const listLoaded = listOfThisOrg && list.loaded;
  const [rejected, setRejected] = useState({ orgId: null, ids: EMPTY_IDS, sets: EMPTY_IDS });
  const rejectedIds = rejected.orgId === organizationId ? rejected.ids : EMPTY_IDS;
  const rejectedSets = rejected.orgId === organizationId ? rejected.sets : EMPTY_IDS;
  const orgRef = useRef(organizationId);

  /* A CHAVE é o conteúdo: um array novo com os mesmos ids (ou vazio) não pode virar
     uma consulta nova. Antes de a lista chegar, só os ids bem formados (a API decide). */
  const effectiveKey = (() => {
    // Organização acabou de mudar: a seleção ainda é da anterior (o efeito abaixo a
    // zera) — neste render ela não viaja.
    if (!enabled || orgRef.current !== organizationId) return "";
    const wellFormed = selection.map(String).filter((id) => isWellFormedId(id) && !rejectedIds.includes(id));
    const key = (listLoaded ? wellFormed.filter((id) => knownIds.has(id)) : wellFormed).join(",");
    return rejectedSets.includes(key) ? "" : key;
  })();
  const effectiveSel = useMemo(() => (effectiveKey ? effectiveKey.split(",") : EMPTY_IDS), [effectiveKey]);

  const [notice, setNotice] = useState("");
  const setSelectionRef = useRef(setSelection);
  setSelectionRef.current = setSelection;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // O próprio estado do filtro larga o id que não existe, avisando — um chip que
  // some calado parece defeito.
  useEffect(() => {
    if (!enabled) return;
    const kept = selection.filter((id) => !rejectedIds.includes(String(id)) && (!listLoaded || knownIds.has(String(id))));
    if (kept.length === selection.length) return;
    setSelectionRef.current(kept);
    // Ids malformados (visões salvas antigas) também saem; o aviso fala do que a pessoa vê.
    setNotice(selection.length - kept.length === 1 ? messagesRef.current.removedOne : messagesRef.current.removedMany);
  }, [enabled, listLoaded, knownIds, rejectedIds, selection]);

  /* Escolha DELIBERADA (painel, visão salva) vale mais que uma recusa antiga: o id
     sai das recusas e a combinação nova é perguntada à API de novo. */
  const prevSelectionRef = useRef(selection);
  useEffect(() => {
    const before = new Set(prevSelectionRef.current.map(String));
    prevSelectionRef.current = selection;
    const added = selection.map(String).filter((id) => !before.has(id));
    if (added.length === 0) return;
    setNotice("");
    setRejected((cur) => {
      if (cur.orgId !== organizationId) return cur;
      const ids = cur.ids.filter((id) => !added.includes(id));
      const sets = cur.sets.filter((set) => !set.split(",").some((id) => added.includes(id)));
      return ids.length === cur.ids.length && sets.length === cur.sets.length ? cur : { ...cur, ids, sets };
    });
  }, [selection, organizationId]);

  // Trocar de organização: os ids escolhidos eram da outra.
  useEffect(() => {
    if (orgRef.current === organizationId) return;
    orgRef.current = organizationId;
    setNotice("");
    // Recusas eram da org anterior; voltar a ela depois começa do zero.
    setRejected({ orgId: null, ids: EMPTY_IDS, sets: EMPTY_IDS });
    if (selection.length > 0) setSelectionRef.current([]);
  }, [organizationId, selection.length]);

  /* Recusas de CONJUNTO (sem prova) só deixam de valer com uma lista nova que ESTE
     hook pediu (releitura do 404) — ou na troca de org, porque as recusas são da org.
     Uma releitura alheia (a de contas sobe a cada transação salva) não as limpa:
     senão o conjunto recusado voltaria a viajar a cada salvamento — mais um 404 e
     o erro piscando. Declarado ANTES do efeito de releitura pendente, que pode
     recusar de novo. */
  const ownReloadRef = useRef(false);
  useEffect(() => {
    if (!listLoaded || !ownReloadRef.current) return;
    ownReloadRef.current = false;
    setRejected((cur) => (cur.orgId === organizationId && cur.sets.length ? { ...cur, sets: EMPTY_IDS } : cur));
  }, [list, listLoaded, organizationId]);

  const effectiveSelRef = useRef(effectiveSel);
  effectiveSelRef.current = effectiveSel;
  const listRef = useRef({ loaded: listLoaded, ids: knownIds });
  listRef.current = { loaded: listLoaded, ids: knownIds };

  /* Recusa um conjunto enviado: com a lista carregada, só os ids que ela PROVA
     inexistentes; sem prova (lista fora do ar, ou a API recusa um id que a lista
     ainda traz), só a combinação exata — nunca um id válido. */
  const reject = useCallback((sent) => {
    const { loaded, ids: known } = listRef.current;
    const missing = loaded ? sent.filter((id) => !known.has(id)) : [];
    setRejected((cur) => {
      const base = cur.orgId === organizationId ? cur : { ids: EMPTY_IDS, sets: EMPTY_IDS };
      if (missing.length) return { orgId: organizationId, ids: [...new Set([...base.ids, ...missing])], sets: base.sets };
      const key = sent.join(",");
      return { orgId: organizationId, ids: base.ids, sets: base.sets.includes(key) ? base.sets : [...base.sets, key] };
    });
    if (!missing.length) setNotice(messagesRef.current.unavailable);
  }, [organizationId]);

  const refetchedForRef = useRef({ orgId: null, keys: new Set() });
  const refetchPendingRef = useRef(null);
  /** Último `errorCode` da consulta — escrito por `useFilterNotFoundRecovery`. */
  const errorCodeRef = useRef("");
  const notFoundCodeRef = useRef("");

  /* A releitura terminou (bem ou mal) e a seleção que vai à API NÃO mudou: nenhuma
     consulta nova vai acontecer, e o erro ficaria na tela para sempre. Recusa o
     conjunto — sem segunda releitura. Se a seleção mudou, a consulta nova decide. */
  useEffect(() => {
    const pending = refetchPendingRef.current;
    if (!pending || !listOfThisOrg) return;
    refetchPendingRef.current = null;
    if (effectiveSelRef.current.join(",") === pending && errorCodeRef.current === notFoundCodeRef.current) {
      reject(pending.split(","));
    }
    // `list` muda a cada resposta da lista — é o sinal de "terminou".
  }, [list, listOfThisOrg, reject]);

  const requestListReloadRef = useRef(requestListReload);
  requestListReloadRef.current = requestListReload;

  return {
    effectiveSel,
    notice,
    dismissNotice: useCallback(() => setNotice(""), []),
    /** Interno: usado por `useFilterNotFoundRecovery`. */
    recovery: {
      organizationId,
      effectiveSelRef,
      refetchedForRef,
      refetchPendingRef,
      errorCodeRef,
      notFoundCodeRef,
      reject,
      requestListReloadRef,
      ownReloadRef,
    },
  };
}

/**
 * Reação ao 404 do filtro (a API responde `notFoundCode` sem dizer QUAL id).
 * Primeira vez para um conjunto de ids: relê a lista UMA vez — o apagado sai da
 * seleção e a lista volta sozinha. Segunda vez para o MESMO conjunto (a releitura
 * falhou, ou a API recusa um id que a lista ainda traz): recusa, sem nova releitura
 * — nunca um laço, nunca a página presa no erro.
 */
export function useFilterNotFoundRecovery(guard, { errorCode, notFoundCode }) {
  const {
    organizationId, effectiveSelRef, refetchedForRef, refetchPendingRef,
    errorCodeRef, notFoundCodeRef, reject, requestListReloadRef, ownReloadRef,
  } = guard.recovery;
  errorCodeRef.current = errorCode;
  notFoundCodeRef.current = notFoundCode;
  useEffect(() => {
    if (errorCode !== notFoundCode) return;
    const sent = effectiveSelRef.current;
    if (sent.length === 0) return;
    const key = sent.join(",");
    if (refetchedForRef.current.orgId !== organizationId) {
      refetchedForRef.current = { orgId: organizationId, keys: new Set() };
    }
    if (refetchedForRef.current.keys.has(key)) {
      reject(sent);
      return;
    }
    refetchedForRef.current.keys.add(key);
    refetchPendingRef.current = key;
    ownReloadRef.current = true;
    requestListReloadRef.current();
  }, [errorCode, notFoundCode, organizationId, reject, effectiveSelRef, refetchedForRef, refetchPendingRef, requestListReloadRef, ownReloadRef]);
}
