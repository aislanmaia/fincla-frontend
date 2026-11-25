// O cartão de uma tela do Conciliar fatura (fincla-api#555/#556): a URL usa o `public_id`, a API o
// `id` inteiro. Comum à conciliação e ao desfazer.
import { useEffect, useState } from "react";

import { handleApiError } from "../../../api/client";
import { listCreditCards } from "../../../api/creditCards";

/**
 * A partir de fincla-api 051b9025, as rotas do cartão já respondem "…neste cartão." Esta troca só
 * protege contra um backend anterior, que respondia com a frase do extrato (QA F1, entrega 001).
 */
const ACCOUNT_NOT_FOUND = "Conciliação não encontrada nesta conta.";
export function cardApiError(err) {
  const message = handleApiError(err);
  return message === ACCOUNT_NOT_FOUND ? "Conciliação não encontrada neste cartão." : message;
}

/**
 * O cartão da URL (`public_id`) na lista de cartões da organização: a API pede o `id` inteiro.
 * O estado é marcado com o par organização + cartão que o pediu: ao trocar de cartão, o anterior
 * deixa de valer na hora (volta a "carregando"), e nada enviado nesse meio-tempo vai para ele.
 */
export function useCardOf(organizationId, cardPublicId) {
  const wanted = `${organizationId}|${cardPublicId}`;
  const [state, setState] = useState({ for: null, card: null, error: "" });
  useEffect(() => {
    if (!organizationId || !cardPublicId) return undefined;
    let alive = true;
    const forKey = `${organizationId}|${cardPublicId}`;
    listCreditCards(organizationId)
      .then((cards) => { if (alive) setState({ for: forKey, card: cards.find((c) => c.public_id === cardPublicId) ?? null, error: "" }); })
      .catch((err) => { if (alive) setState({ for: forKey, card: null, error: cardApiError(err) }); });
    return () => { alive = false; };
  }, [organizationId, cardPublicId]);
  if (state.for !== wanted) return { card: null, error: "", loaded: false };
  return { card: state.card, error: state.error, loaded: true };
}

export function cardName(card) {
  if (!card) return "";
  const name = card.description?.trim();
  return name || [card.brand, card.last4 ? `•${card.last4}` : null].filter(Boolean).join(" ");
}
