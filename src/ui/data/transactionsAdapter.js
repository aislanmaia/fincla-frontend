import axios from "axios";

import {
  createTransaction,
  getTransactionsSummary,
  deleteTransaction,
  getTransactionsFacets,
  listTransactions,
  settleTransaction,
  unsettleTransaction,
  updateTransaction,
} from "../../api/transactions";
import { downloadTransactionsCsv } from "../../api/analytics";
import { handleApiError } from "../../api/client";
import {
  hasObservedIdempotencySupport,
  newIdempotencyKey,
  noteIdempotencySupport,
  readResponseHeader,
} from "../../api/idempotency";
import { categoryLabelPtForTag, detailLabelPtForTag } from "./categoryLabels.js";

/** Máximo por página na API `GET /transactions` (validação backend). */
export const TRANSACTIONS_API_MAX_LIMIT = 100;

const METHOD_LABELS = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  cash: "Dinheiro",
  bank_transfer: "Transferência",
  boleto: "Boleto",
  credito: "Crédito",
  debito: "Débito",
  ted: "TED",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function formatLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMethodLabel(value) {
  const normalized = normalizeText(value);
  return METHOD_LABELS[normalized] || value;
}

export function isUuidString(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isApiTagTypeCategory(t) {
  const n = normalizeText(t?.tag_type?.name || "");
  return n === "categoria" || n === "category";
}

function isCategoryTagGroupKey(groupKey) {
  const n = normalizeText(groupKey || "");
  return n.includes("categoria") || n.includes("category");
}

function pickCategoryTag(transaction) {
  const entries = Object.entries(transaction.tags ?? {});
  const categoryGroup = entries.find(([groupName, tags]) =>
    isCategoryTagGroupKey(groupName) || (tags ?? []).some(isApiTagTypeCategory),
  );

  if (categoryGroup?.[1]?.length) {
    return categoryGroup[1][0];
  }

  if (transaction.category) {
    return {
      id: null,
      name: transaction.category,
      icon_key: null,
      is_active: true,
    };
  }

  // Sem grupo "categoria" confirmado e sem `transaction.category`: NÃO existe
  // categoria de verdade pra devolver. Pegar o primeiro tag de QUALQUER outro
  // grupo (ex.: "detalhe") e tratá-lo como se fosse a categoria é o mesmo
  // defeito que a issue #100 corrigiu em outros call sites — aqui na raiz
  // compartilhada por todos eles (achado 1 da rodada 3 de review).
  return null;
}

/**
 * Tag de categoria da transação (API), para agregações na UI. Repassa
 * `is_default` (achado 2, rodada 3 de review #100): sem ele,
 * `categoryLabelPtForTag` não consegue distinguir uma categoria do USUÁRIO
 * que coincide de texto com um nome canônico do seed (ex. "Health") de uma
 * linha do seed de verdade — sequestra o nome pela tradução por engano.
 * @param {import("../../api/types").Transaction} transaction
 * @returns {{ id: string | null; name: string | null; icon_key: string | null; color: string | null; is_default: boolean | null } | null}
 */
export function pickCategoryTagFromApiTransaction(transaction) {
  const t = pickCategoryTag(transaction);
  if (!t) return null;
  return {
    id: t.id != null && t.id !== "" ? t.id : null,
    name: t.name ?? null,
    icon_key: t.icon_key ?? null,
    is_active: t.is_active !== false,
    color:
      typeof t.color === "string" && t.color.trim() ? t.color : null,
    is_default: typeof t.is_default === "boolean" ? t.is_default : null,
  };
}

export function pickDetailTagMetaMapFromApiTransaction(transaction) {
  const catTag = pickCategoryTag(transaction);
  const catId =
    catTag && catTag.id != null && String(catTag.id) !== ""
      ? String(catTag.id)
      : null;
  const byId = new Map();
  for (const [groupKey, tags] of Object.entries(transaction.tags ?? {})) {
    if (isCategoryTagGroupKey(groupKey)) continue;
    for (const t of tags ?? []) {
      if (!t?.id) continue;
      if (isApiTagTypeCategory(t)) continue;
      const id = String(t.id);
      if (catId && id === catId) continue;
      if (
        catId &&
        t.parent_category_tag_id != null &&
        String(t.parent_category_tag_id).trim() !== "" &&
        String(t.parent_category_tag_id) !== catId
      ) {
        continue;
      }
      const rawName = t.name != null ? String(t.name).trim() : "";
      byId.set(id, {
        id,
        tag: t,
        // `t.name` pode vir cru do seed (`grocery`, `health_plan`...) — traduz.
        label: rawName ? detailLabelPtForTag(t) || rawName : `Tag ${id.slice(0, 8)}…`,
        isActive: t.is_active !== false,
      });
    }
  }
  // Mesma desambiguação de `pickTagNames` (achado 5, rodada 3 de review
  // #100): sem isso, a MESMA tag lia diferente na linha da transação e no
  // pré-preenchimento do modal de edição — a linha mostrava "mercado
  // (grocery)" enquanto o modal, ao reabrir pra editar, voltava a mostrar
  // dois chips "mercado" idênticos.
  const map = {};
  for (const entry of disambiguateTagLabelEntries(Array.from(byId.values()))) {
    map[entry.id] = { name: entry.label, isActive: entry.isActive };
  }
  return map;
}

function pickCategoryName(transaction) {
  const tag = pickCategoryTag(transaction);
  if (!tag) return "Sem categoria";
  return categoryLabelPtForTag(tag);
}

function pickTagNames(transaction, categoryDisplayName) {
  const catTag = pickCategoryTag(transaction);
  const catApiName = catTag?.name ?? categoryDisplayName;
  const primaryCatId =
    catTag && catTag.id != null && String(catTag.id) !== ""
      ? String(catTag.id)
      : null;
  const seenIds = new Set();
  const entries = Object.entries(transaction.tags ?? {})
    .flatMap(([groupKey, tags]) =>
      (tags ?? []).map((tag) => ({ groupKey, tag })),
    )
    .filter(({ groupKey, tag }) => {
      if (isCategoryTagGroupKey(groupKey)) return false;
      if (isApiTagTypeCategory(tag)) return false;
      // Mesmo gate de `pickDetailTagMetaMapFromApiTransaction` (achado 7,
      // rodada 5 de review #100) — exige `id` (sem id não dá pra editar/
      // selecionar a tag depois; os dois call sites viam conjuntos
      // diferentes: este exigia nome e deixava passar sem id, o outro o
      // inverso) e NÃO exige nome (nome vazio ganha o mesmo placeholder
      // abaixo, em vez de sumir da linha mas continuar no modal).
      if (!tag?.id) return false;
      if (
        primaryCatId &&
        tag.parent_category_tag_id != null &&
        String(tag.parent_category_tag_id).trim() !== "" &&
        String(tag.parent_category_tag_id) !== primaryCatId
      ) {
        return false;
      }
      // Dedupe pelo ID real da tag, não pelo texto já traduzido: a tag seed
      // "grocery" (→ "mercado") e uma tag do usuário literalmente chamada
      // "mercado" são duas tags diferentes e não podem virar um chip só.
      const id = String(tag.id);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    })
    // `tag.name` pode vir cru do seed (`grocery`, `health_plan`...) — traduz
    // pro chip. Sem nome, mesmo placeholder de `pickDetailTagMetaMapFromApiTransaction`.
    .map(({ tag }) => {
      const id = String(tag.id);
      const rawName = tag.name != null ? String(tag.name).trim() : "";
      return {
        id,
        tag,
        label: rawName ? detailLabelPtForTag(tag) || rawName : `Tag ${id.slice(0, 8)}…`,
      };
    });
  // Desambigua sobre o conjunto COMPLETO (achado 3, rodada 4 de review
  // #100) — inclusive a tag cujo nome cru bate com o nome cru da categoria,
  // que só é excluída da LINHA embaixo. `pickDetailTagMetaMapFromApiTransaction`
  // não filtra por nome de categoria (o pré-preenchimento do modal precisa
  // de TODAS as tags anexadas, redundantes ou não); rodar a desambiguação
  // ANTES de excluir mantém as duas listas contando a MESMA colisão — senão
  // a tag "grocery" (que sobrevive aqui) desambiguava sozinha (sem colisão
  // visível) enquanto o modal, vendo as duas, desambiguava "mercado
  // (grocery)" — a mesma tag lendo diferente na linha e no modal, de novo.
  const disambiguated = disambiguateTagLabelEntries(entries);
  return disambiguated
    .filter((entry) => entry.tag?.name !== catApiName)
    .map((e) => e.label);
}

/**
 * Desambigua rótulos de tags "detalhe" iguais após tradução. O dedupe acima
 * já é por ID real (achado 3, issue #100): a tag seed "grocery" (→
 * "mercado") e uma tag do usuário literalmente chamada "mercado" são
 * IDs diferentes, sobrevivem ambas ao dedupe e — sem isto — viram dois chips
 * "#mercado" idênticos, que se leem como bug de duplicação embora sejam tags
 * de verdade diferentes.
 *
 * Três passadas, mesmo padrão de `buildTagOptions`
 * (`filters/tagCatalogResolution.js`, achado 4a da revisão da PR #96), com
 * um ajuste no desempate final:
 * 1) quando o rótulo traduzido colide, tenta desempatar anexando o nome cru
 *    original entre parênteses (só nas entradas cujo nome cru difere do
 *    rótulo — a tag do usuário, cujo nome já É o rótulo, fica limpa);
 * 2) se AINDA colidir (duas tags de verdade com o MESMO nome cru, ex. duas
 *    tags "mensal" criadas pelo usuário — `rawName` e `label` são
 *    idênticos pras duas, a passada 1 não desempata nada), anexa um
 *    PREFIXO CURTO do id (8 chars, mesma convenção de
 *    `pickDetailTagMetaMapFromApiTransaction`'s "Tag {id}…"). Não usa
 *    índice de ocorrência posicional (rodada 4) nem o id INTEIRO (rodada 3
 *    — `buildTagOptions` faz isso, mas ali é um dropdown de filtro com
 *    largura de sobra; aqui é um pill de 11px numa linha de transação e a
 *    mesma string vai pro CSV): um índice depende da ORDEM em que o
 *    backend devolve as tags — `TransactionModel.tags` é uma relação
 *    `secondary` sem `order_by` — então a MESMA tag podia ler "(1)" numa
 *    carga e "(2)" na seguinte (CSV grava strings diferentes pra mesma
 *    tag; `novaTxModalInitStamp`, que hasheia `detailTagDisplayById`, muda
 *    e redispara o reset do modal). O prefixo do id é estável por
 *    construção — o mesmo em qualquer ordem — e mais legível que o id
 *    inteiro (achado 3, rodada 5 de review #100).
 * 3) rechecagem final: o prefixo curto, embora praticamente sempre único,
 *    não é garantido (dois ids podem coincidir nos 8 primeiros chars, ou
 *    uma tag de verdade pode já se chamar literalmente "rótulo (idcurto)")
 *    — se ainda colidir depois da passada 2, troca pelo id INTEIRO nessas
 *    entradas específicas, que é garantidamente único (achado 6, rodada 5).
 * @param {Array<{ id?: string | null; tag: Record<string, unknown>; label: string }>} entries
 * @returns {Array<{ id?: string | null; tag: Record<string, unknown>; label: string }>}
 */
function disambiguateTagLabelEntries(entries) {
  const idOf = (entry) =>
    entry.id ?? (entry.tag?.id != null ? String(entry.tag.id) : "");

  const countsOf = (list) => {
    const c = new Map();
    for (const { label } of list) c.set(label, (c.get(label) ?? 0) + 1);
    return c;
  };

  // Passada 1: nome cru como desempate.
  const counts = countsOf(entries);
  const withRawNameCandidate = entries.map((entry) => {
    if ((counts.get(entry.label) ?? 0) <= 1) return entry;
    const rawName = entry.tag?.name != null ? String(entry.tag.name).trim() : "";
    if (rawName && rawName.toLowerCase() !== entry.label.toLowerCase()) {
      return { ...entry, label: `${entry.label} (${rawName})`, preIdLabel: entry.label };
    }
    return entry;
  });

  // Passada 2: prefixo curto e ESTÁVEL do id (não depende de ordem).
  const finalCounts = countsOf(withRawNameCandidate);
  const withShortId = withRawNameCandidate.map((entry) => {
    if ((finalCounts.get(entry.label) ?? 0) <= 1) return entry;
    const id = idOf(entry);
    if (!id) return entry;
    return {
      ...entry,
      preIdLabel: entry.preIdLabel ?? entry.label,
      label: `${entry.label} (${id.slice(0, 8)})`,
    };
  });

  // Passada 3: rechecagem — residual raríssimo ainda colidindo cai no id
  // inteiro, garantidamente único.
  const shortIdCounts = countsOf(withShortId);
  return withShortId.map((entry) => {
    if ((shortIdCounts.get(entry.label) ?? 0) <= 1) return entry;
    const id = idOf(entry);
    if (!id) return entry;
    const base = entry.preIdLabel ?? entry.label;
    return { ...entry, label: `${base} (${id})` };
  });
}

/**
 * IDs de tags associadas à transação exceto a tag de categoria principal
 * (útil para POST/PUT com `tag_ids` e para pré-preencher o modal).
 * @param {import("../../api/types").Transaction} transaction
 * @returns {string[]}
 */
export function pickNonCategoryTagIdsFromApiTransaction(transaction) {
  const catTag = pickCategoryTag(transaction);
  const catId =
    catTag && catTag.id != null && String(catTag.id) !== ""
      ? String(catTag.id)
      : null;
  const out = [];
  const seen = new Set();
  for (const [groupKey, tags] of Object.entries(transaction.tags ?? {})) {
    if (isCategoryTagGroupKey(groupKey)) continue;
    for (const t of tags ?? []) {
      if (!t?.id) continue;
      if (isApiTagTypeCategory(t)) continue;
      const id = String(t.id);
      if (catId && id === catId) continue;
      if (
        catId &&
        t.parent_category_tag_id != null &&
        String(t.parent_category_tag_id).trim() !== "" &&
        String(t.parent_category_tag_id) !== catId
      ) {
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Rótulos API por id para tags não-categoria (para chips no modal mesmo quando
 * `GET /tags?tag_type=detalhe` não devolve todos os ids anexados à transação).
 * @param {import("../../api/types").Transaction} transaction
 * @returns {Record<string, string>}
 */
export function pickDetailTagDisplayMapFromApiTransaction(transaction) {
  const meta = pickDetailTagMetaMapFromApiTransaction(transaction);
  const map = {};
  for (const [id, row] of Object.entries(meta)) {
    map[id] = row.name;
  }
  return map;
}

function mergeTransactionTagIds(categoryTagId, detailTagIds) {
  const cat = categoryTagId != null ? String(categoryTagId) : "";
  const extras = Array.isArray(detailTagIds)
    ? detailTagIds.map((id) => String(id)).filter(Boolean)
    : [];
  const merged = cat ? [cat, ...extras.filter((id) => id !== cat)] : [...extras];
  return [...new Set(merged)];
}

function pickTransactionIcon(transaction) {
  if (transaction.type === "refund") return "↺";
  if (transaction.type === "income") return "💸";

  const method = normalizeText(transaction.payment_method);
  if (method === "credit_card" || method.includes("credito")) return "💳";
  if (method === "debit_card" || method.includes("debito")) return "💸";
  if (method === "pix" || method.includes("pix")) return "⚡";
  if (method === "boleto" || method.includes("boleto")) return "🧾";
  if (method === "cash" || method.includes("dinheiro")) return "💵";
  if (method === "bank_transfer" || method.includes("transfer")) return "🏦";
  return "🧾";
}

function mapInstallmentInfo(transaction) {
  const installment = transaction.installment_info?.[0];
  if (!installment) return null;

  // Occurrence-based: each installment is its own transaction; the purchase total is
  // derived from the installment value × count (installments are equal-split).
  const total = Number((installment.amount * installment.total_installments).toFixed(2));
  const paid = Number((installment.amount * installment.installment_number).toFixed(2));
  return {
    atual: installment.installment_number,
    total: installment.total_installments,
    valParcela: installment.amount,
    cartao: "",
    vencimento: formatDate(installment.due_date),
    valorTotal: total,
    valorPago: paid,
    valorResidual: Number((total - paid).toFixed(2)),
  };
}

/** Valor exibido na linha (soma das parcelas em `installment_info` quando houver). */
export function pickDisplayAmount(transaction) {
  const parts = transaction.installment_info;
  if (parts?.length) {
    return parts.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  }
  return Number(transaction.value ?? 0);
}

/** Valor absoluto para o modal de edição; na lista usa-se pickDisplayAmount. */
export function pickAmountAbsForTransactionEdit(transaction) {
  if (!transaction) return 0;
  // Occurrence-based: an installment carries its own value; the purchase total for
  // the edit modal is value × installment count.
  const installment = transaction.installment_info?.[0];
  if (installment && installment.total_installments > 1) {
    const total = Number(installment.amount) * Number(installment.total_installments);
    // Arredonda em centavos: 33.34 × 3 dá 100.02000000000001, e esse resíduo faz o
    // total reconstruído nunca bater com o valor digitado (que já passa por centavos).
    if (Number.isFinite(total)) return Math.round(Math.abs(total) * 100) / 100;
  }
  const v = Number(transaction.value ?? 0);
  return Number.isFinite(v) ? Math.abs(v) : 0;
}

export function transactionUiValAbsForEdit(ui) {
  if (!ui || typeof ui !== "object") return 0;
  for (const x of [ui.valAbsForEdit, ui.parcela?.valorTotal, ui.val]) {
    if (x != null && x !== "") {
      const n = Number(x);
      if (Number.isFinite(n)) return Math.abs(n);
    }
  }
  return 0;
}

/**
 * Data bruta para coluna «Data» na lista (GET /transactions com período):
 * cartão à vista → data da compra; parcelado → vencimento da primeira parcela retornada no período.
 * @param {import("../../api/types").Transaction} transaction
 */
export function pickTransactionListDateRawForDisplay(transaction) {
  // Occurrence-based: the transaction's own `date` is already the effective date
  // (cash → purchase date; installment → its due date).
  return transaction.date;
}

/**
 * Despesas atribuídas a dias (ritmo, médias por weekday, etc.), alinhado ao contrato de listagem.
 * Parcelado: uma entrada por item em `installment_info`; demais: uma entrada na data da transação.
 * @param {import("../../api/types").Transaction} transaction
 * @returns {{ date: string; amount: number }[]}
 */
export function expandExpenseTxToAttributedParts(transaction) {
  if (transaction.type !== "expense") return [];
  // Occurrence-based: each installment is its own transaction attributed to its own
  // date, so a single entry per transaction is correct.
  const amount = pickDisplayAmount(transaction);
  const ymd =
    ymdFromAnyDateInput(transaction.date) ||
    String(transaction.date ?? "").slice(0, 10);
  return ymd ? [{ date: ymd, amount }] : [];
}

/**
 * A transação é uma compra no cartão?
 *
 * NÃO usa `mapApiPaymentMethodToModalKey`: aquele helper cai em `"pix"` para
 * qualquer string que não seja uma das 6 canônicas, e o backend devolve
 * `payment_method` cru do banco — onde ainda existem linhas legadas com
 * "Cartão de Crédito" / "crédito". Uma dessas classificada como não-cartão
 * ganharia o botão "Marcar como pago"; o endpoint de settle não tem trava de
 * cartão no servidor, então a parcela entraria no saldo agora e de novo quando
 * a fatura fosse paga — contagem dupla silenciosa.
 *
 * Dois sinais, ambos conservadores: o FK da fatura (o que o backend de fato usa)
 * e a raiz "credit" no método normalizado, que cobre os legados sem pegar débito.
 */
function isCreditCardApiTransaction(transaction) {
  if (transaction?.credit_card_id != null) return true;
  return normalizeText(transaction?.payment_method).includes("credit");
}

export function mapApiTransactionToUi(transaction) {
  const catTag = pickCategoryTag(transaction);
  const categoryName = catTag ? categoryLabelPtForTag(catTag) : "Sem categoria";
  const detailTagMetaById = pickDetailTagMetaMapFromApiTransaction(transaction);
  const amount = pickDisplayAmount(transaction);
  // Refund é dinheiro voltando — sinal positivo como income.
  const isMoneyIn = transaction.type === "income" || transaction.type === "refund";
  const signedVal = isMoneyIn ? amount : -amount;

  let statusLabel = "confirmado";
  if (transaction.status === "pending") statusLabel = "pendente";
  else if (transaction.status === "cancelled") statusLabel = "cancelada";

  // Eixo de liquidação, separado do `status` acima de propósito. O backend só soma
  // `status='paid'` no saldo da conta, mas a UI achatava 'paid' e 'confirmed' no mesmo
  // rótulo "confirmado" — então o usuário não tinha como perceber que um lançamento
  // não entrou no saldo. `statusLabel` continua como está para não quebrar os dois
  // lugares que já leem `status === "pendente"` (TransacoesPage, DashboardPage).
  const settled = transaction.status === "paid";

  const listDateRaw = pickTransactionListDateRawForDisplay(transaction);
  const dateLabel = formatDate(listDateRaw);

  const cardIdFromCharge = transaction.credit_card_id ?? null;

  return {
    id: transaction.id,
    desc: transaction.description,
    cat: categoryName,
    categoryTagId: catTag?.id ?? null,
    categoryTagIsActive: catTag?.is_active !== false,
    categoryIconKey: catTag?.icon_key ?? null,
    date: dateLabel,
    dateIsoForEdit: pickDateIsoForEditTransaction(transaction),
    paymentMethodKey: mapApiPaymentMethodToModalKey(transaction.payment_method),
    cartaoId: cardIdFromCharge != null && Number.isFinite(Number(cardIdFromCharge))
      ? Number(cardIdFromCharge)
      : null,
    val: signedVal,
    valAbsForEdit: pickAmountAbsForTransactionEdit(transaction),
    icon: pickTransactionIcon(transaction),
    rec: transaction.recurring,
    seriesId: transaction.series_id ?? null,
    status: statusLabel,
    settled,
    // Cartão liquida quando a FATURA é paga, nunca por lançamento — a UI de liquidar
    // não se aplica a ele, e o badge "A pagar" mentiria sobre o que o usuário controla.
    settleable: !isCreditCardApiTransaction(transaction),
    paidAt: transaction.paid_at ?? null,
    // Conta de liquidação — a UI precisa dela para saber qual âncora de saldo se
    // aplica a este lançamento (S4).
    accountId: transaction.account_id ?? null,
    method: formatMethodLabel(transaction.payment_method),
    tags: pickTagNames(transaction, categoryName),
    detailTagIds: pickNonCategoryTagIdsFromApiTransaction(transaction),
    detailTagDisplayById: pickDetailTagDisplayMapFromApiTransaction(transaction),
    detailTagMetaById,
    parcela: mapInstallmentInfo(transaction),
    // Tipo bruto do backend — UI usa pra renderizar badge/avatar de estorno.
    type: transaction.type,
    // FK opcional pra compra original (só vem populado quando type === "refund").
    refundOfTransactionId: transaction.refund_of_transaction_id ?? null,
    // Resumo agregado dos estornos linkados a esta transação (count + total_value).
    refundsSummary: transaction.refunds_summary
      ? {
          count: Number(transaction.refunds_summary.count) || 0,
          totalValue: Number(transaction.refunds_summary.total_value) || 0,
        }
      : null,
  };
}

function resolveDateRange(period, customFrom, customTo) {
  const today = new Date();

  if (period === "hoje") {
    const current = formatLocalIsoDate(today);
    return { date_start: current, date_end: current };
  }

  if (period === "semana") {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(today),
    };
  }

  if (period === "mes") {
    const y = today.getFullYear();
    const m = today.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(end),
    };
  }

  if (period === "mes-ant") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(end),
    };
  }

  if (period === "3m") {
    const start = new Date(today);
    start.setMonth(start.getMonth() - 3);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(today),
    };
  }

  if (period === "ano") {
    const start = new Date(today.getFullYear(), 0, 1);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(today),
    };
  }

  /* "rel" (janela relativa: últimos N dias/semanas/meses/anos) grava o
     intervalo calculado nos MESMOS campos do custom. Sem esta linha o filtro
     saía sem `date_start`/`date_end` nenhum: os campos na tela mostravam as
     datas e a lista mostrava a história inteira — o oposto do que o chip
     promete, e sem nada acusando. */
  if ((period === "custom" || period === "rel") && (customFrom || customTo)) {
    return {
      ...(customFrom ? { date_start: customFrom } : {}),
      ...(customTo ? { date_end: customTo } : {}),
    };
  }

  return {};
}

/* Token legado → o par (`sort_by`, `sort_order`) que a API entende.

   A ordenação chega aqui SEMPRE como token legado: `filtersToLegacyParams`
   converte o modelo de regras da tela antes de o hook montar a query. Não
   existe caminho em que um array chegue nesta função — havia um ramo para isso
   e ele era código morto, que ainda por cima sugeria ao próximo leitor que
   `tipo`/`cat` já chegavam à API.

   `type` e `category` PRECISAM estar aqui: a API os aceita
   (`SortByField = date | value | type | payment_method | description |
   category`), e sem o token correspondente clicar em "Ordenar por Tipo"
   renomeava o botão e deixava a lista exatamente como estava. */
const ORDENACAO_DA_API = {
  "date-asc": { sort_by: "date", sort_order: "asc" },
  "date-desc": { sort_by: "date", sort_order: "desc" },
  "val-asc": { sort_by: "value", sort_order: "asc" },
  "val-desc": { sort_by: "value", sort_order: "desc" },
  "name-asc": { sort_by: "description", sort_order: "asc" },
  "name-desc": { sort_by: "description", sort_order: "desc" },
  "type-asc": { sort_by: "type", sort_order: "asc" },
  "type-desc": { sort_by: "type", sort_order: "desc" },
  "cat-asc": { sort_by: "category", sort_order: "asc" },
  "cat-desc": { sort_by: "category", sort_order: "desc" },
};

/**
 * @param {string} sortBy Token legado ("val-desc", "cat-asc", …).
 */
function resolveSort(sortBy) {
  /* A API ordena por UM campo. A cascata de desempate da tela ("valor, depois
     data") não tem equivalente lá: mandamos a regra que decide a ordem
     visível, que é a primeira — e é `mapSortToLegacy` quem já a escolheu. */
  return ORDENACAO_DA_API[sortBy] ?? { sort_by: "date", sort_order: "desc" };
}

/**
 * Normaliza `filterMethod` para os valores de `payment_method` enviados à API.
 * Aceita array (`["pix", "credit_card"]`), string única legada, ou o sentinela
 * `"todos"`/vazio (sem filtro). Devolve `null` quando não há filtro por forma.
 */
function resolvePaymentMethodParam(filterMethod) {
  if (!filterMethod || filterMethod === "todos") return null;
  const list = Array.isArray(filterMethod) ? filterMethod : [filterMethod];
  const cleaned = list.filter((m) => m && m !== "todos");
  return cleaned.length ? cleaned : null;
}

/**
 * Facet "Situação" -> query param `settled` (bool). "todas" omite o param, que é o
 * que o backend lê como "as duas". Um `settled: undefined` no objeto viraria
 * `settled=undefined` na querystring em alguns serializadores, então é omissão mesmo.
 */
function resolveSettlement(settlement) {
  if (settlement === "pagas") return { settled: true };
  if (settlement === "a-pagar") return { settled: false };
  return {};
}

/**
 * Traduz a seleção de categoria/tag da UI nos params do backend.
 *
 * Aceita um escalar ou uma lista. Cada item vira `tag_id` quando é UUID e
 * `category` quando é um nome — os dois params são repetíveis, casam com
 * QUALQUER valor dentro da mesma chave (OR) e se combinam entre chaves por AND.
 * Foi isso que aposentou o slot único: antes só o primeiro item da seleção
 * chegava à query, e as outras marcações ficavam acesas na tela filtrando nada.
 *
 * `"todas"` (e vazio) significam "sem filtro".
 */
function resolveCategoryParams(filterCat) {
  const items = (Array.isArray(filterCat) ? filterCat : [filterCat])
    .filter((v) => v != null && v !== "" && v !== "todas")
    .map(String);
  if (items.length === 0) return {};
  const tagIds = items.filter(isUuidString);
  const categories = items.filter((v) => !isUuidString(v));
  return {
    ...(categories.length ? { category: categories } : {}),
    ...(tagIds.length ? { tag_id: tagIds } : {}),
  };
}

export function buildTransactionsQuery({
  organizationId,
  search = "",
  filterType = "todos",
  filterCat = "todas",
  filterMethod = "todos",
  period = "tudo",
  customFrom = "",
  customTo = "",
  sortBy = "date-desc",
  valueMin,
  valueMax,
  tagMatch,
  recurring,
  settlement = "todas",
  limit = 10,
}) {
  const categoryFilter = resolveCategoryParams(filterCat);
  const paymentMethod = resolvePaymentMethodParam(filterMethod);

  return {
    organization_id: organizationId,
    ...(search ? { description: search } : {}),
    ...(filterType === "receita" ? { type: "income" } : {}),
    ...(filterType === "despesa" ? { type: "expense" } : {}),
    ...(filterType === "estorno" ? { type: "refund" } : {}),
    ...categoryFilter,
    ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    ...resolveDateRange(period, customFrom, customTo),
    ...(valueMin != null ? { value_min: valueMin } : {}),
    ...(valueMax != null ? { value_max: valueMax } : {}),
    ...(tagMatch === "all" ? { tag_match: "all" } : {}),
    ...(recurring != null ? { recurring } : {}),
    ...resolveSettlement(settlement),
    page: 1,
    limit,
    ...resolveSort(sortBy),
  };
}

/**
 * Busca candidatas pra linkar como "compra estornada" no drawer.
 *
 * Filtra expenses recentes (últimos 365 dias) pela API; pode estreitar por
 * payment_method e — quando o usuário já escolheu cartão — por cardId
 * client-side (a API atual não suporta filtro por card_id direto).
 *
 * Retorna array de objetos no formato de UI (mapApiTransactionToUi) ordenado
 * por data desc, máximo `limit` itens.
 */
export async function fetchRefundCandidates({
  organizationId,
  query = "",
  paymentMethodKey = null,
  cardId = null,
  limit = 8,
}) {
  if (!organizationId) return [];
  const today = new Date();
  const since = new Date(today.getTime() - 365 * 86400000);
  const params = {
    organization_id: organizationId,
    type: "expense",
    date_start: formatLocalIsoDate(since),
    date_end: formatLocalIsoDate(today),
    page: 1,
    limit: cardId != null ? Math.max(limit * 3, 24) : limit,
    sort_by: "date",
    sort_order: "desc",
  };
  const search = String(query || "").trim();
  if (search) params.description = search;
  if (paymentMethodKey) {
    const apiMethod = mapUiPaymentMethodToApi(paymentMethodKey);
    if (apiMethod) params.payment_method = apiMethod;
  }
  let response;
  try {
    response = await listTransactions(params);
  } catch (_err) {
    return [];
  }
  const rows = (response?.data || []).map(mapApiTransactionToUi);
  const filtered = cardId != null
    ? rows.filter((t) => t.cartaoId != null && Number(t.cartaoId) === Number(cardId))
    : rows;
  return filtered.slice(0, limit);
}

export function buildTransactionsCsvOptions({
  filterType = "todos",
  filterMethod = "todos",
  period = "tudo",
  customFrom = "",
  customTo = "",
}) {
  const dateRange = resolveDateRange(period, customFrom, customTo);
  const paymentMethod = resolvePaymentMethodParam(filterMethod);

  return {
    ...(filterType === "receita" ? { type: "income" } : {}),
    ...(filterType === "despesa" ? { type: "expense" } : {}),
    ...(filterType === "estorno" ? { type: "refund" } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(dateRange.date_start ? { dateStart: dateRange.date_start } : {}),
    ...(dateRange.date_end ? { dateEnd: dateRange.date_end } : {}),
  };
}

export function buildTransactionsSummaryQuery({
  organizationId,
  search = "",
  filterType = "todos",
  filterCat = "todas",
  filterMethod = "todos",
  period = "tudo",
  customFrom = "",
  customTo = "",
  valueMin,
  valueMax,
  tagMatch,
  recurring,
  settlement = "todas",
}) {
  const categoryFilter = resolveCategoryParams(filterCat);
  const paymentMethod = resolvePaymentMethodParam(filterMethod);

  return {
    organization_id: organizationId,
    ...(search ? { description: search } : {}),
    ...(filterType === "receita" ? { type: "income" } : {}),
    ...(filterType === "despesa" ? { type: "expense" } : {}),
    ...(filterType === "estorno" ? { type: "refund" } : {}),
    ...categoryFilter,
    ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    ...resolveDateRange(period, customFrom, customTo),
    ...(valueMin != null ? { value_min: valueMin } : {}),
    ...(valueMax != null ? { value_max: valueMax } : {}),
    // Mesmo eixo da lista, de propósito: sem isso o card de totais somaria todas as
    // linhas enquanto a lista abaixo mostra só o subconjunto filtrado, e o usuário
    // ficaria olhando um total que nenhuma linha visível fecha.
    ...(tagMatch === "all" ? { tag_match: "all" } : {}),
    ...(recurring != null ? { recurring } : {}),
    ...resolveSettlement(settlement),
  };
}

/**
 * Query de `GET /v1/transactions/facets`: exatamente os filtros da lista, menos
 * paginação e ordenação. É essa igualdade que faz o `total` das facets bater com
 * o total da listagem — se as duas perguntas divergirem, os números do painel
 * descrevem um conjunto que a tela não mostra.
 *
 * @param {string[]} [facets] - subconjunto a calcular; omitido = todas.
 */
export function buildTransactionsFacetsQuery({ facets, ...filters }) {
  const query = buildTransactionsSummaryQuery(filters);
  return Array.isArray(facets) && facets.length ? { ...query, facets } : query;
}

/**
 * Busca as contagens do painel de filtro. Devolve `null` em qualquer falha:
 * contagem é enfeite informativo, e um painel sem números continua utilizável —
 * derrubar o filtro inteiro por causa delas seria uma troca ruim.
 */
export async function getTransactionsFacetsForUi(query) {
  if (!query?.organization_id) return null;
  try {
    return await getTransactionsFacets(query);
  } catch (_err) {
    return null;
  }
}

/**
 * Lista todas as transações que casam com o filtro, paginando em lotes de até
 * {@link TRANSACTIONS_API_MAX_LIMIT} até esgotar `has_next`.
 */
export async function fetchAllTransactionsPages(baseQuery) {
  const all = [];
  let page = 1;
  let lastRes = null;

  for (;;) {
    lastRes = await listTransactions({
      ...baseQuery,
      limit: TRANSACTIONS_API_MAX_LIMIT,
      page,
    });
    const batch = lastRes.data ?? [];
    all.push(...batch);
    if (!lastRes.pagination?.has_next || batch.length === 0) break;
    page += 1;
    if (page > 1000) break;
  }

  return { data: all, pagination: lastRes?.pagination };
}

export async function listTransactionsForUi(query) {
  const page = query.page ?? 1;
  const wantRaw = query.limit ?? 10;
  const want = Math.max(1, wantRaw);

  if (want <= TRANSACTIONS_API_MAX_LIMIT && page === 1) {
    return listTransactions({
      ...query,
      limit: want,
      page: 1,
    });
  }

  const { page: _p, limit: _l, ...base } = query;
  const all = [];
  let currentPage = 1;
  let lastRes = null;

  while (all.length < want) {
    lastRes = await listTransactions({
      ...base,
      limit: TRANSACTIONS_API_MAX_LIMIT,
      page: currentPage,
    });
    const batch = lastRes.data ?? [];
    all.push(...batch);
    if (!lastRes.pagination?.has_next || batch.length === 0) break;
    currentPage += 1;
    if (currentPage > 1000) break;
  }

  const total = lastRes?.pagination?.total ?? all.length;
  return {
    data: all.slice(0, want),
    pagination: lastRes?.pagination
      ? {
          ...lastRes.pagination,
          has_next: total > want,
        }
      : undefined,
  };
}

export async function getTransactionsSummaryForUi(query) {
  return getTransactionsSummary(query);
}

export async function deleteTransactionForUi(transactionId, organizationId) {
  return deleteTransaction(transactionId, organizationId);
}

/**
 * Liquida (ou desfaz a liquidação de) uma transação e devolve a linha já no formato da UI.
 *
 * Devolver a linha mapeada — em vez de só o status — deixa o chamador substituir o item
 * na lista sem refetch, o que evita a lista piscar a cada clique.
 */
export async function setTransactionSettledForUi(transactionId, organizationId, settled) {
  const updated = settled
    ? await settleTransaction(transactionId, organizationId)
    : await unsettleTransaction(transactionId, organizationId);
  return mapApiTransactionToUi(updated);
}

export async function downloadTransactionsCsvForUi(organizationId, options) {
  // `options` chega no formato legado (filterType/filterMethod/period/...);
  // buildTransactionsCsvOptions traduz para o contrato do endpoint
  // (type/paymentMethod/dateStart/dateEnd). Sem isso o export ia sem filtro nenhum.
  return downloadTransactionsCsv(organizationId, buildTransactionsCsvOptions(options), "transacoes.csv");
}

/**
 * Erros de `Idempotency-Key` não têm tradução útil no `handleApiError`
 * genérico (cairiam em "Dados inválidos" / "Não foi possível concluir"), e
 * dois deles não são culpa de quem está usando o app: são bug nosso, no
 * cliente. A mensagem diz o que fazer sem jogar jargão de HTTP na tela.
 */
const IDEMPOTENCY_ERROR_MESSAGES = new Map([
  // Mismatch = o servidor TEM registro dessa chave e considera o corpo
  // diferente. Como só reusamos chave quando a nossa impressão digital
  // garantiu payload idêntico, isso significa que a requisição anterior
  // chegou a ser processada — mandar "registre de novo" sem mais nada
  // empurraria a pessoa direto para a duplicata.
  [
    "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
    "Falha interna do aplicativo ao reenviar esta transação. O envio anterior chegou a ser processado — confira seu extrato antes de registrar de novo.",
  ],
  // Chave malformada é recusada ANTES de qualquer gravação: nada foi criado.
  [
    "INVALID_IDEMPOTENCY_KEY",
    "Falha interna do aplicativo ao registrar esta transação. Nada foi salvo. Atualize a página e registre de novo.",
  ],
  // Só chega aqui depois de esgotadas as tentativas com espera crescente: é
  // reserva órfã, que responderia 409 pelas 24h inteiras. "Aguarde alguns
  // segundos" seria mentira — esperar não resolve.
  [
    "IDEMPOTENCY_KEY_IN_FLIGHT",
    "Outro envio deste mesmo lançamento ficou preso no servidor. Confira seu extrato: se a transação não estiver lá, registre de novo.",
  ],
]);

export function formatTransactionsApiError(error) {
  // Erro sintético nosso: já nasce com a frase pronta em PT-BR, e passar por
  // `handleApiError` (que sanitiza `Error` genérico) só a descaracterizaria.
  if (createErrorWasSwallowedByReplay(error)) return error.message;
  // `Map` de propósito: `detail.error` é string vinda do servidor, e indexar um
  // objeto literal com ela devolvia a herança do `Object.prototype` — um
  // `detail.error === "__proto__"` fazia esta função retornar um OBJETO, e o
  // React derrubava o drawer inteiro com "Objects are not valid as a React
  // child". `Map.get` só enxerga o que foi posto nele.
  const idempotencyError = idempotencyErrorCodeOf(error);
  const known = idempotencyError != null ? IDEMPOTENCY_ERROR_MESSAGES.get(idempotencyError) : undefined;
  if (typeof known === "string") return known;
  return handleApiError(error);
}

const MODAL_METHOD_TO_API = {
  pix: "pix",
  boleto: "boleto",
  dinheiro: "cash",
  debito: "debit_card",
  credito: "credit_card",
  transferencia: "bank_transfer",
};

export function mapUiPaymentMethodToApi(methodKey) {
  return MODAL_METHOD_TO_API[methodKey] ?? methodKey;
}

/** Inverso de `mapUiPaymentMethodToApi` para pré-preencher o modal a partir da API. */
export function mapApiPaymentMethodToModalKey(apiMethod) {
  const key = String(apiMethod || "").trim();
  for (const [modalKey, apiKey] of Object.entries(MODAL_METHOD_TO_API)) {
    if (apiKey === key) return modalKey;
  }
  const n = normalizeText(key);
  const found = Object.entries(MODAL_METHOD_TO_API).find(
    ([, v]) => normalizeText(v) === n,
  );
  return found ? found[0] : "pix";
}

/** Lista / mock: usa `paymentMethodKey` da API ou heurística no rótulo PT. */
export function modalPaymentKeyFromTransactionUi(tx) {
  if (tx?.paymentMethodKey) return tx.paymentMethodKey;
  const s = String(tx?.method || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (s.includes("credito")) return "credito";
  if (s.includes("debito")) return "debito";
  if (s.includes("pix")) return "pix";
  if (s.includes("ted") || s.includes("transfer")) return "transferencia";
  if (s.includes("boleto")) return "boleto";
  if (s.includes("dinheiro")) return "dinheiro";
  return "pix";
}

/** `DD/MM/AAAA` (mock) → ISO `YYYY-MM-DDTHH:mm:ss` para o campo Data do modal; inválido → null. */
export function transactionDateIsoFromBrDisplay(display) {
  const parts = String(display || "").split("/");
  if (parts.length !== 3) return null;
  const dd = Number(parts[0]);
  const mm = Number(parts[1]);
  const yyyy = Number(parts[2]);
  if (!dd || !mm || !yyyy || yyyy < 1900) return null;
  const y = String(yyyy).padStart(4, "0");
  const m = String(mm).padStart(2, "0");
  const d = String(dd).padStart(2, "0");
  return `${y}-${m}-${d}T12:00:00`;
}

/**
 * Estado da transação tal como o servidor a entregou, para o submit mandar só o que
 * o usuário mexeu (`diffUpdateTransactionPayload`). Construtor único porque o modal
 * é hidratado por dois caminhos — o fetch do deep-link e o clique na lista — e um
 * baseline ausente faz o PATCH degradar para o pacote inteiro (fincla-api#90).
 */
export function buildEditBaselineFromUi(ui) {
  if (!ui) return null;
  const paymentMethodKey = modalPaymentKeyFromTransactionUi(ui);
  const isParcelado = !!(ui.parcela && ui.parcela.total > 1);
  const isCard = paymentMethodKey === "credito";
  return {
    tipo: ui.val > 0 ? "receita" : "despesa",
    description: ui.desc,
    value: transactionUiValAbsForEdit(ui),
    paymentMethodKey,
    categoryTagId: ui.categoryTagId ?? null,
    detailTagIds: ui.detailTagIds ?? [],
    dateIso:
      ui.dateIsoForEdit ?? transactionDateIsoFromBrDisplay(ui.date) ?? undefined,
    cardId: ui.cartaoId != null ? Number(ui.cartaoId) : null,
    modality: isCard ? (isParcelado ? "installment" : "cash") : null,
    installmentsCount: isParcelado ? ui.parcela.total : null,
    recurring: !!ui.rec,
  };
}

/** Data local do dia (YYYY-MM-DD). */
export function todayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function novaTxDateStorageKey(organizationId) {
  return `fincla.v2.novaTxDate.${organizationId || "default"}`;
}

/** Lê última data escolhida no modal Nova transação (por organização). */
export function readStoredNovaTransacaoDate(organizationId) {
  try {
    const v = localStorage.getItem(novaTxDateStorageKey(organizationId));
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  } catch (_) {}
  return null;
}

/** Persiste última data escolhida (YYYY-MM-DD). */
export function writeStoredNovaTransacaoDate(organizationId, ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
  try {
    localStorage.setItem(novaTxDateStorageKey(organizationId), ymd);
  } catch (_) {}
}

function novaTxPrefsStorageKey(organizationId) {
  return `fincla.v2.novaTxPrefs.${organizationId || "default"}`;
}

/** Últimas escolhas do modal Nova transação (forma de pagamento, categoria, cartão/modalidade). */
export function readStoredNovaTransacaoPrefs(organizationId) {
  try {
    const raw = localStorage.getItem(novaTxPrefsStorageKey(organizationId));
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch (_) {
    return {};
  }
}

export const NOVA_TX_METHODS_DESPESA = [
  "pix",
  "debito",
  "credito",
  "dinheiro",
  "boleto",
];

export const NOVA_TX_METHODS_RECEITA = ["pix", "dinheiro", "transferencia"];

export function normalizeStoredNovaTxPaymentMethod(method, tipo) {
  const list =
    tipo === "receita" ? NOVA_TX_METHODS_RECEITA : NOVA_TX_METHODS_DESPESA;
  const m = String(method ?? "").trim();
  return list.includes(m) ? m : null;
}

export function clampNovaTxPrefsParcelas(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const r = Math.round(x);
  if (r < 1 || r > 360) return null;
  return r;
}

/**
 * Objeto persistido em JSON — modalidade/parcelas/cartão só quando method é crédito.
 */
export function serializeNovaTxFormStateToStoredPrefs({
  tipo,
  method,
  cat,
  categoryTagId,
  modalidade,
  parcelas,
  cartao,
}) {
  const t = tipo === "receita" ? "receita" : "despesa";
  const pm = normalizeStoredNovaTxPaymentMethod(method, t);
  const effectiveMethod = pm ?? "pix";
  const catStr = cat != null ? String(cat).trim() : "";
  const catId =
    categoryTagId != null && isUuidString(String(categoryTagId))
      ? String(categoryTagId)
      : null;

  const base = {
    tipo: t,
    method: effectiveMethod,
    cat: catStr ? catStr : null,
    categoryTagId: catId,
    modalidade: null,
    parcelas: null,
    cartaoId: null,
  };

  if (effectiveMethod !== "credito") return base;

  const parcelasClamped = clampNovaTxPrefsParcelas(parcelas) ?? 3;
  const mod = modalidade === "avista" ? "avista" : "parcelado";
  const cid =
    cartao != null &&
    String(cartao).trim() !== "" &&
    String(cartao) !== "novo"
      ? String(cartao).trim()
      : null;

  return {
    ...base,
    modalidade: mod,
    parcelas: parcelasClamped,
    cartaoId: cid,
  };
}

export function writeStoredNovaTransacaoPrefs(organizationId, prefsObject) {
  try {
    localStorage.setItem(
      novaTxPrefsStorageKey(organizationId),
      JSON.stringify(prefsObject),
    );
  } catch (_) {}
}

/** Edição ou pré-config explícita de categoria: não aplicar prefs armazenadas à lista de categorias. */
export function shouldApplyStoredNovaTxCategoryPrefs(preConfig) {
  const editing =
    preConfig?.editingTransactionId != null &&
    String(preConfig.editingTransactionId).trim() !== "";
  if (editing) return false;
  if (!preConfig) return true;
  if (
    preConfig.categoryTagId != null &&
    isUuidString(String(preConfig.categoryTagId))
  )
    return false;
  if (preConfig.cat != null && String(preConfig.cat).trim() !== "")
    return false;
  return true;
}

export function resolveStoredNovaTxCategorySelection(
  prefs,
  rows,
  { fallbackToFirst = false } = {},
) {
  const categoryRows = Array.isArray(rows) ? rows : [];
  const prefCategoryId =
    prefs?.categoryTagId != null && isUuidString(String(prefs.categoryTagId))
      ? String(prefs.categoryTagId)
      : null;
  const prefCategoryLabel =
    prefs?.cat != null ? String(prefs.cat).trim() : "";

  if (categoryRows.length === 0) {
    return {
      categoryTagId: prefCategoryId,
      cat: prefCategoryLabel,
    };
  }

  const matchById = prefCategoryId
    ? categoryRows.find(
        (row) => row?.id != null && String(row.id) === prefCategoryId,
      )
    : null;
  if (matchById) {
    return {
      categoryTagId: matchById.id ?? null,
      cat: matchById.labelPt || prefCategoryLabel,
    };
  }

  const matchByLabel = prefCategoryLabel
    ? categoryRows.find((row) => row?.labelPt === prefCategoryLabel)
    : null;
  if (matchByLabel) {
    return {
      categoryTagId: matchByLabel.id ?? null,
      cat: matchByLabel.labelPt,
    };
  }

  if (fallbackToFirst) {
    const firstRow = categoryRows[0] || null;
    return {
      categoryTagId: firstRow?.id ?? null,
      cat: firstRow?.labelPt || prefCategoryLabel,
    };
  }

  return {
    categoryTagId: null,
    cat: prefCategoryLabel,
  };
}

/** Extrai YYYY-MM-DD de ISO ou string de data. */
export function ymdFromAnyDateInput(value) {
  if (value == null || value === "") return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function pickDateIsoForEditTransaction(transaction) {
  for (const value of [transaction.date]) {
    if (value == null || String(value).trim() === "") continue;
    const ymd = ymdFromAnyDateInput(value);
    if (ymd) return `${ymd}T12:00:00`;
  }
  return `${todayLocalYmd()}T12:00:00`;
}

/** Data inicial do campo Data: preConfig, senão última salva, senão hoje. */
export function initialNovaTransacaoDateYmd(organizationId, preConfig) {
  const fromPc = preConfig && ymdFromAnyDateInput(preConfig.dateIso ?? preConfig.transactionDate);
  if (fromPc) return fromPc;
  return readStoredNovaTransacaoDate(organizationId) ?? todayLocalYmd();
}

/** Formata `YYYY-MM-DD` para exibição conforme `locale` (BCP 47). */
export function formatYmdToLocaleDisplay(ymd, locale = "pt-BR") {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  } catch {
    return dt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
}

/** @deprecated Prefira `formatYmdToLocaleDisplay(ymd, locale)` ou `APP_UI_LOCALE`. */
export function formatYmdToBrDisplay(ymd) {
  return formatYmdToLocaleDisplay(ymd, "pt-BR");
}

/** Data local do dia, meio-dia (ISO sem timezone shift agressivo). */
export function defaultTransactionDateIso() {
  return `${todayLocalYmd()}T12:00:00`;
}

/** ISO `YYYY-MM-DDTHH:mm:ss` para API a partir de YYYY-MM-DD. */
export function transactionDateIsoFromYmd(ymd) {
  const y = ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : todayLocalYmd();
  return `${y}T12:00:00`;
}

/**
 * Payload mínimo para POST /transactions (tag_ids obrigatório).
 * Parcelas/cartão: opcionais conforme o backend aceitar.
 */
export function buildCreateTransactionPayload({
  organizationId,
  tipo,
  description,
  value,
  paymentMethodKey,
  categoryTagId,
  detailTagIds = null,
  dateIso,
  cardId = null,
  installmentsCount = null,
  modality = null,
  refundOfTransactionId = null,
  accountId = null,
  paidAt = null,
}) {
  let type;
  if (tipo === "receita") type = "income";
  else if (tipo === "estorno" || tipo === "refund") type = "refund";
  else type = "expense";

  const payload = {
    organization_id: organizationId,
    type,
    description: String(description || "").trim() || "—",
    tag_ids: mergeTransactionTagIds(categoryTagId, detailTagIds),
    value: Number(value),
    payment_method: mapUiPaymentMethodToApi(paymentMethodKey),
    date: dateIso,
  };
  if (cardId != null && Number.isFinite(Number(cardId))) {
    payload.card_id = Number(cardId);
  }
  // Refund em cartão: backend força modality='refund' e installments=1 — não envie nada extra.
  if (type === "refund") {
    if (refundOfTransactionId != null && Number.isFinite(Number(refundOfTransactionId))) {
      payload.refund_of_transaction_id = Number(refundOfTransactionId);
    }
  } else {
    if (modality) payload.modality = modality;
    if (
      modality === "installment" &&
      installmentsCount != null &&
      Number(installmentsCount) >= 1
    ) {
      payload.installments_count = Number(installmentsCount);
    }
  }
  // Fase 0 (cash model): conta de liquidação + settlement opcional.
  // Omitir account_id => backend usa a conta default; omitir paid_at => compromisso pendente.
  if (accountId) payload.account_id = accountId;
  if (paidAt) payload.paid_at = paidAt;
  return payload;
}

/**
 * Corpo para `PUT /transactions/:id` (sem `organization_id` no body).
 * Despesa em cartão: envie `card_id` (como no POST); não envie `card_last4` — não basta para cobrança/parcelas.
 */
export function buildUpdateTransactionPayload({
  tipo,
  description,
  value,
  paymentMethodKey,
  categoryTagId,
  detailTagIds = null,
  dateIso,
  cardId = null,
  installmentsCount = null,
  modality = null,
  recurring = false,
  baseline = null,
}) {
  let type;
  if (tipo === "receita") type = "income";
  else if (tipo === "estorno" || tipo === "refund") type = "refund";
  else type = "expense";
  const payload = {
    type,
    description: String(description || "").trim() || "—",
    value: Number(value),
    payment_method: mapUiPaymentMethodToApi(paymentMethodKey),
    date: dateIso,
    recurring: !!recurring,
  };
  // Só sobrescreve tags se houver um ID válido; caso contrário, a API mantém as existentes.
  if (categoryTagId != null) {
    payload.tag_ids = mergeTransactionTagIds(categoryTagId, detailTagIds);
  }
  if (cardId != null && Number.isFinite(Number(cardId))) {
    payload.card_id = Number(cardId);
  }
  // Refund em cartão: backend força modality='refund' e installments=1 — não envie.
  if (type !== "refund") {
    if (modality) payload.modality = modality;
    if (
      modality === "installment" &&
      installmentsCount != null &&
      Number(installmentsCount) >= 1
    ) {
      payload.installments_count = Number(installmentsCount);
    }
  }
  if (!baseline) return payload;

  // Envia só o que o usuário mexeu. Sem isso o backend recebe o pacote inteiro em toda
  // edição e precisa adivinhar o que mudou — comparando contra valores que chegam
  // *derivados*, não fiéis:
  //   - `value` é remontado como (parcela editada × N). Numa compra de R$ 100,00 em 3x
  //     (33,33 / 33,33 / 33,34) isso dá 99,99 ou 100,02, nunca 100,00.
  //   - `modality` é derivado da contagem de parcelas.
  // Foi assim que editar a categoria de cinco compras moveu R$ 885,05 para fora de uma
  // fatura já paga (fincla-api#90).
  const before = buildUpdateTransactionPayload({ ...baseline, baseline: null });
  const changed = {};
  for (const [key, current] of Object.entries(payload)) {
    if (!sameUpdateField(current, before[key])) changed[key] = current;
  }
  // `date` segue obrigatório no UpdateTxBody da API (fincla-api#91); enquanto for,
  // mandamos sempre. Quando virar opcional, sai daqui junto com os demais.
  changed.date = payload.date;
  return changed;
}

/** Compara dois valores de campo do payload de update, tratando arrays por conteúdo. */
function sameUpdateField(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a.map(String).slice().sort() : [];
    const right = Array.isArray(b) ? b.map(String).slice().sort() : [];
    return left.length === right.length && left.every((v, i) => v === right[i]);
  }
  // Dinheiro em ponto flutuante não sobrevive a `===`: compara na menor unidade real
  // (centavos), que é onde o input já opera. Inteiros passam por aqui sem efeito.
  if (typeof a === "number" && typeof b === "number") {
    return Math.round(a * 100) === Math.round(b * 100);
  }
  return a === b;
}

/* ─── Criação de transação: chave de idempotência + retry ────────────────── */

/**
 * A investigação da issue #102 concluiu que NENHUMA classe de erro observável
 * pelo cliente prova que o servidor não processou um `POST /transactions`:
 * `ECONNRESET` é um RST de TCP que tipicamente chega DEPOIS de bytes
 * trocados; `ERR_NETWORK` no adapter XHR do axios sai do mesmo `onerror`
 * tanto para "recusou antes de enviar" quanto para "caiu depois do 201"; 502
 * acontece com o upstream morrendo já tendo commitado; 504 é o gateway
 * desistindo da espera, não o request sendo descartado; e o próprio backend
 * empacota exceção de infra pós-commit em 503. Por isso não havia retry
 * nenhum aqui — repetir arriscava duplicar um lançamento.
 *
 * `Idempotency-Key` (issue #103) é exatamente o que destrava isso: o backend
 * grava a chave junto do resultado por 24h e, na repetição com a MESMA chave
 * e o MESMO payload, devolve a resposta original (`Idempotent-Replay: true`)
 * em vez de criar de novo. Repetir deixou de arriscar duplicata, então as
 * classes AMBÍGUAS acima voltam a ser repetíveis — não porque provamos que
 * nada foi gravado, mas porque agora tanto faz.
 *
 * O retry só liga depois que o SERVIDOR provou que implementa a feature (ver
 * `hasObservedIdempotencySupport`). Contra um backend sem idempotência —
 * frontend no ar antes da API — repetir voltaria a duplicar, então nesse caso
 * o comportamento continua sendo o de hoje: uma requisição, sem repetição.
 *
 * O que continua FORA do retry:
 *  - 4xx em geral (validação, auth, conflito de negócio): erro definitivo do
 *    pedido; repetir só some com o feedback real do problema.
 *  - 500 genérico: quase sempre bug determinístico do servidor — repetir
 *    queima tempo e a segunda resposta é a mesma.
 *  - 400 `INVALID_IDEMPOTENCY_KEY` e 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`:
 *    são bug NOSSO, não do servidor nem da pessoa. Ver `createTransactionForUi`.
 *
 * Caso especial: 409 `IDEMPOTENCY_KEY_IN_FLIGHT` significa "outra requisição
 * com essa mesma chave está rodando agora". Repetir com a MESMA chave é o
 * comportamento correto e obrigatório (uma chave nova criaria a duplicata que
 * o 409 está justamente impedindo); o backend manda `Retry-After: 2` e
 * publica backoff 2s/4s/8s com parada em ~4 tentativas.
 */
const CREATE_RETRYABLE_NETWORK_CODES = new Set([
  "ERR_NETWORK",
  "ECONNRESET",
  "ECONNABORTED",
  "ETIMEDOUT",
]);
const CREATE_RETRYABLE_STATUSES = new Set([502, 503, 504]);

/** Erros de idempotência que o backend devolve em `detail.error`. */
const IDEMPOTENCY_IN_FLIGHT = "IDEMPOTENCY_KEY_IN_FLIGHT";
const IDEMPOTENCY_PAYLOAD_MISMATCH = "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH";
const IDEMPOTENCY_INVALID_KEY = "INVALID_IDEMPOTENCY_KEY";
const IDEMPOTENCY_ERROR_CODES = new Set([
  IDEMPOTENCY_IN_FLIGHT,
  IDEMPOTENCY_PAYLOAD_MISMATCH,
  IDEMPOTENCY_INVALID_KEY,
]);

// Transiente (rede/502/503/504): poucas tentativas e espera curta — a pessoa
// está olhando a tela esperando o "Registrado!".
const CREATE_MAX_ATTEMPTS = 3;
const CREATE_RETRY_BASE_DELAY_MS = 400;
// 409 in-flight: o backend publica 2s/4s/8s com parada em ~4 tentativas.
// Esperas maiores fazem sentido aqui porque quem responde é uma reserva de
// chave que está prestes a virar resposta pronta.
const CREATE_IN_FLIGHT_MAX_ATTEMPTS = 4;
const CREATE_IN_FLIGHT_BASE_DELAY_MS = 2000;
// Teto POR ESPERA: acomoda o 8s publicado com folga sem deixar um
// `Retry-After` absurdo (já vimos `3600`) congelar o drawer.
const CREATE_RETRY_MAX_DELAY_MS = 10_000;
// Teto do tempo de PAREDE de uma criação, medido do primeiro POST em diante:
// espera dormida MAIS tempo travado dentro das requisições. Contar só o sono
// media a coisa errada — `ECONNABORTED`/`ETIMEDOUT` são repetíveis e o
// timeout de write é 30s, então três tentativas seguravam o drawer por ~90s
// em "Enviando…", desabilitado e sem cancelar, com "orçamento" zerado.
// 20s é o que a pessoa aguenta olhando a tela, e cobre o 2s+4s+8s do
// contrato de in-flight.
const CREATE_RETRY_ELAPSED_BUDGET_MS = 20_000;

/** Lê `detail.error` da resposta de erro; `null` quando não é esse formato. */
export function idempotencyErrorCodeOf(error) {
  const detail = error?.response?.data?.detail;
  if (detail && typeof detail === "object" && typeof detail.error === "string") {
    return detail.error;
  }
  return null;
}

/**
 * Marca no erro que a chave daquela tentativa foi LIBERADA antes do throw.
 * A UI precisa saber: sem chave retida, o reenvio deixa de ser um replay e
 * volta a ser um lançamento novo — logo, volta a merecer o aviso do extrato.
 */
const KEY_RELEASED_FLAG = "__finclaIdempotencyKeyReleased";

export function createErrorReleasedIdempotencyKey(error) {
  return Boolean(error?.[KEY_RELEASED_FLAG]);
}

/**
 * Marca o erro sintético de "criação engolida": o servidor respondeu
 * `Idempotent-Replay: true` para uma chave que ACABOU de nascer, ou seja, a
 * resposta é de um lançamento anterior e nada foi criado agora.
 */
const SWALLOWED_FLAG = "__finclaCreateSwallowedByReplay";

const SWALLOWED_MESSAGE =
  "Este lançamento já tinha sido registrado antes, então nada de novo foi criado agora. Confira seu extrato antes de registrar de novo.";

export function createErrorWasSwallowedByReplay(error) {
  return Boolean(error?.[SWALLOWED_FLAG]);
}

export function isCreateTransactionErrorRetryable(error) {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status == null) {
    return CREATE_RETRYABLE_NETWORK_CODES.has(error.code);
  }
  if (status === 409) return idempotencyErrorCodeOf(error) === IDEMPOTENCY_IN_FLIGHT;
  return CREATE_RETRYABLE_STATUSES.has(status);
}

/**
 * `Retry-After` conforme a RFC: ou um número de SEGUNDOS, ou um HTTP-date.
 * As duas formas são aceitas — tratar a data como `NaN` e cair no backoff
 * curto martelaria justamente quem pediu pausa. `0` é válido (repetir já).
 * Devolve a BASE do backoff, não a espera final (ver `createRetryDelayMs`).
 */
function retryAfterMs(error, nowMs) {
  const raw = readResponseHeader(error?.response?.headers, "Retry-After");
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.max(at - nowMs, 0);
}

/**
 * Espera antes da próxima tentativa. Pura (o `nowMs` entra por parâmetro) para
 * poder ser testada sem cronômetro: uma asserção de tempo real sobre 2s/4s/8s
 * estouraria o timeout do Vitest e ainda seria flaky sob carga.
 *
 * Duas decisões que já deram errado antes:
 *
 *  - `Retry-After` só é honrado no 409 in-flight, que é onde ele é
 *    CONTRATUAL. Honrá-lo em 502/503/504 entregava o ritmo do drawer a um
 *    header que qualquer proxy no caminho pode mandar: um `Retry-After: 3600`
 *    num 503 travava a tela com o botão desabilitado.
 *  - Com header presente, a tentativa CONTINUA contando. Antes o header
 *    substituía o backoff inteiro e, como a API manda sempre `Retry-After: 2`,
 *    o 2s/4s/8s publicado nos dois repositórios virava 2s/2s/2s — quatro POSTs
 *    em seis segundos contra uma reserva órfã. O header passou a ser a BASE
 *    do backoff exponencial, o que reproduz exatamente 2s/4s/8s.
 */
export function createRetryDelayMs(
  error,
  attempt,
  { inFlight = false, nowMs = Date.now(), spentMs = 0 } = {},
) {
  const floor = inFlight ? CREATE_IN_FLIGHT_BASE_DELAY_MS : CREATE_RETRY_BASE_DELAY_MS;
  const fromHeader = inFlight ? retryAfterMs(error, nowMs) : null;
  // PISO no valor do header. `Retry-After: 0` (ou um HTTP-date já vencido) é
  // legítimo e quer dizer "pode repetir agora", mas usar isso como base do
  // backoff zerava a progressão inteira — `0 * 2**n` é `0` em toda tentativa,
  // o orçamento nunca era atingido, e as 4 tentativas do in-flight saíam
  // COLADAS, sem espaçamento nenhum, contra a reserva órfã. Pior do que o
  // problema que a base-vinda-do-header veio resolver.
  const base = Math.max(fromHeader ?? floor, floor);
  const delay = Math.min(base * 2 ** (attempt - 1), CREATE_RETRY_MAX_DELAY_MS);
  // `null` = desista. Limitar só a espera INDIVIDUAL ainda somava um minuto de
  // drawer congelado quando o servidor (ou um proxy no caminho) pedia pausas
  // longas; o orçamento é sobre o TOTAL dormido nesta criação.
  if (spentMs + delay > CREATE_RETRY_ELAPSED_BUDGET_MS) return null;
  return delay;
}

/**
 * Data-hora ISO-8601 COMPLETA (com `T` e hora). Date-only fica de fora de
 * propósito: `2026-08-20` e `2026-08-20T12:00:00` não são o mesmo instante.
 */
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Serializa estável (chaves ordenadas) para comparar payloads por conteúdo.
 *
 * REJEITA entrada que o JSON não representa fielmente, em vez de fingir que
 * representa. `Object.keys` num `Date` devolve `[]`, então sem esta guarda
 * todo `Date` viraria `{}` e duas transações de DIAS DIFERENTES dividiriam a
 * mesma impressão digital — a segunda seria engolida como replay da primeira.
 *
 * As classes de equivalência seguem as do hash canônico do backend, para as
 * duas pontas concordarem sobre "é o mesmo payload":
 *
 *  - campo AUSENTE ≡ campo `null` ≡ campo `undefined`. O backend afrouxou
 *    isso, e alinhar aumenta a proteção: o modal ora omite `card_id`, ora
 *    manda `null`, e antes essa diferença de forma gerava chave NOVA — ou
 *    seja, um lançamento novo onde deveria haver replay.
 *  - data-hora ISO equivalente ≡ mesma data-hora. `T12:00:00`, `Z`, `.000Z`
 *    e offset equivalente batem no mesmo hash lá; canonizamos para o instante
 *    para não gerar chave nova só porque o reenvio reformatou a data.
 *  - tipos DIFERENTES continuam diferentes: `100` não é `"100"`.
 */
function stableStringify(value) {
  if (value === null) return "null";
  const type = typeof value;
  if (type === "boolean") return JSON.stringify(value);
  if (type === "string") {
    if (ISO_DATETIME_RE.test(value)) {
      const at = Date.parse(value);
      // Canoniza para o instante — mas só quando ele é interpretável. Uma
      // string com cara de data e valor impossível segue comparada como texto.
      if (!Number.isNaN(at)) return `"@${at}"`;
    }
    return JSON.stringify(value);
  }
  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Payload de transação com número não-JSON: ${value}`);
    }
    // `100` e `100.0` já são o MESMO number em JS, e o backend normaliza
    // números do mesmo jeito no hash canônico dele — remontar o payload com
    // `toFixed(2)` do lado de lá não gera mismatch.
    return JSON.stringify(value);
  }
  if (type !== "object") {
    throw new TypeError(`Payload de transação com valor não-JSON (${type}).`);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? "null" : stableStringify(v))).join(",")}]`;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(
      `Payload de transação com objeto não-simples (${value.constructor?.name ?? "?"}); use tipos JSON.`,
    );
  }
  const parts = [];
  for (const key of Object.keys(value).sort()) {
    const entry = value[key];
    // `undefined` some do corpo (regra do `JSON.stringify`) e `null` é
    // idêntico a omitir para o backend — as três formas colapsam aqui.
    if (entry === undefined || entry === null) continue;
    parts.push(`${JSON.stringify(key)}:${stableStringify(entry)}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * Chaves retidas de TENTATIVAS DE SALVAR que ainda não deram certo, indexadas
 * pela impressão digital do payload que as gerou. É o que faz a chave ser
 * "uma por tentativa", não "uma por requisição": todo reenvio daquela
 * tentativa — o retry automático aqui dentro e o clique manual em "Tentar
 * novamente" — reusa a mesma chave e por isso não pode duplicar.
 *
 * MAPA, não um slot único: com um slot só, registrar a transação B (sucesso)
 * apagava a chave retida da tentativa A que tinha falhado, e o reenvio de A
 * saía com chave NOVA — duplicando A se o POST original tivesse persistido.
 *
 * Com TTL curto porque a retenção também engole: às 09:00 um "Café R$ 7,00"
 * falha com 503 depois de gravar; às 15:00 a pessoa compra outro café e digita
 * exatamente os mesmos dados (a data vai sempre como `T12:00:00`, então o
 * payload é idêntico byte a byte). Sem expirar, a chave da manhã seria reusada
 * e o backend replayaria o registro antigo: a tela diz "Registrado!" e o
 * lançamento da tarde NUNCA existe. A janela do backend é de 24h; a nossa é de
 * minutos, o tempo de uma pessoa insistir no botão.
 */
const CREATE_KEY_RETENTION_MS = 10 * 60 * 1000;
const retainedCreateKeys = new Map();

function pruneRetainedCreateKeys(nowMs) {
  for (const [fingerprint, entry] of retainedCreateKeys) {
    if (nowMs - entry.createdAt >= CREATE_KEY_RETENTION_MS) {
      retainedCreateKeys.delete(fingerprint);
    }
  }
}

/** Solta TODAS as chaves retidas. Usado pelos testes para isolar cenários. */
export function resetCreateIdempotencyKey() {
  retainedCreateKeys.clear();
}

/**
 * Solta a chave de UMA tentativa. O modal chama isto quando descarta o estado
 * de falha (fechar/reabrir o drawer, resetar o formulário): a partir daí um
 * lançamento com os mesmos dados é intenção NOVA, não reenvio — e reusar a
 * chave antiga faria o backend replayar em vez de criar.
 */
export function releaseCreateIdempotencyKey(fingerprint) {
  if (typeof fingerprint === "string") retainedCreateKeys.delete(fingerprint);
}

/**
 * Impressão digital do payload de criação, por CONTEÚDO. Exportada para o
 * modal poder LIBERAR a chave de uma tentativa que ele abandonou
 * (`releaseCreateIdempotencyKey`) — e só para isso.
 *
 * Para responder "reenviar isto duplica?", use `createResendIsProtected`. O
 * modal já teve a própria noção de proteção, comparando fingerprints com um
 * `ref`; ela divergia deste módulo toda vez que a proteção caía por FORA da
 * mudança de payload (TTL vencido, suporte do servidor ausente, liberação
 * externa) — e em toda divergência a UI escolhia o lado inseguro.
 */
export function createTransactionPayloadFingerprint(payload) {
  return stableStringify(payload);
}

/**
 * Existe chave retida (e ainda dentro do TTL) para este payload? Fato cru
 * sobre o mapa, sem opinião sobre o servidor — os testes usam para inspecionar
 * a retenção. A UI deve perguntar a `createResendIsProtected`.
 */
export function hasRetainedCreateIdempotencyKey(payload) {
  const now = Date.now();
  pruneRetainedCreateKeys(now);
  return retainedCreateKeys.has(stableStringify(payload));
}

/**
 * A ÚNICA pergunta que a UI deve fazer: reenviar exatamente este payload é
 * garantidamente um replay, ou pode criar um segundo lançamento?
 *
 * Três condições, e todas moram aqui de propósito:
 *  1. o servidor precisa ter provado que implementa idempotência — sem isso a
 *     chave é um header ignorado e reenviar duplica como sempre duplicou;
 *  2. precisa haver chave retida para este payload;
 *  3. ela precisa estar dentro do TTL (a poda roda na consulta).
 *
 * Qualquer resposta `false` faz a UI voltar a pedir confirmação — que é o
 * comportamento que já está em produção hoje, e o lado seguro do erro.
 */
export function createResendIsProtected(payload) {
  if (!hasObservedIdempotencySupport()) return false;
  return hasRetainedCreateIdempotencyKey(payload);
}

/**
 * Chave desta tentativa mais `reused`: `true` quando veio do mapa (reenvio de
 * uma tentativa que falhou), `false` quando nasceu agora. A distinção importa
 * porque só uma chave RECÉM-GERADA torna um `Idempotent-Replay: true`
 * impossível de ser legítimo (ver `createTransactionForUi`).
 */
function idempotencyKeyForAttempt(fingerprint) {
  const now = Date.now();
  pruneRetainedCreateKeys(now);
  const retained = retainedCreateKeys.get(fingerprint);
  if (retained) return { key: retained.key, reused: true };
  const key = newIdempotencyKey();
  retainedCreateKeys.set(fingerprint, { key, createdAt: now });
  return { key, reused: false };
}

/**
 * Classifica se um erro de CRIAÇÃO pode ter persistido mesmo tendo retornado
 * erro ao cliente. Continua valendo como fato de rede — o que MUDOU é o uso:
 * com `Idempotency-Key`, reenviar o MESMO payload é seguro mesmo aqui, então
 * isto não serve mais para bloquear o reenvio, e sim para avisar quando a
 * chave deixou de proteger o próximo envio.
 *
 *  - Sem NENHUMA requisição ter saído do navegador: NUNCA ambíguo. Cobre erro
 *    que não é do axios (um `TypeError` em `buildCreateTransactionPayload`
 *    roda no MESMO try, antes da rede) e erro do axios sem `error.request`
 *    (falhou montando o request, nunca despachou).
 *  - Requisição saiu, sem resposta (rede/timeout) ou 5xx: AMBÍGUO.
 *  - 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`: AMBÍGUO apesar de ser 4xx. Só
 *    reusamos chave quando a nossa própria impressão digital garantiu payload
 *    idêntico; se mesmo assim o servidor viu payload DIFERENTE para aquela
 *    chave, é porque ele tem registro dela — ou seja, a requisição anterior
 *    chegou a ser processada. Tratar como "seguro" mandaria a pessoa
 *    registrar de novo por cima de algo que já existe.
 *  - 409 `IDEMPOTENCY_KEY_IN_FLIGHT` esgotado: AMBÍGUO. A reserva órfã pode
 *    corresponder a uma transação criada.
 *  - demais 4xx: SEGURO. A API valida antes de gravar.
 */
export function isCreateTransactionErrorMaybePersisted(error) {
  // Replay em chave nova: o lançamento anterior EXISTE, com certeza. É o caso
  // mais forte de "confira seu extrato" que temos.
  if (createErrorWasSwallowedByReplay(error)) return true;
  if (!axios.isAxiosError(error)) return false;
  // ANTES da guarda de `error.request`: um corpo com código de idempotência é
  // resposta do servidor, logo prova por si só que a requisição foi
  // despachada E processada — mais forte do que a presença do objeto request.
  const idempotencyError = idempotencyErrorCodeOf(error);
  if (idempotencyError === IDEMPOTENCY_PAYLOAD_MISMATCH) return true;
  if (idempotencyError === IDEMPOTENCY_IN_FLIGHT) return true;
  if (!error.request) return false;
  const status = error.response?.status;
  if (status == null) return true; // requisição saiu, sem resposta: rede ou timeout.
  return status >= 500;
}

/** Marca o erro como "a chave desta tentativa foi liberada" e o devolve. */
function releasingKey(error, fingerprint) {
  releaseCreateIdempotencyKey(fingerprint);
  if (error && typeof error === "object") {
    try {
      error[KEY_RELEASED_FLAG] = true;
    } catch {
      // Erro congelado (raro): a UI só perde o aviso extra, nada quebra.
    }
  }
  return error;
}

/**
 * Cria a transação carregando a `Idempotency-Key` da tentativa e repetindo,
 * poucas vezes e com espera crescente, as classes que a chave tornou seguras.
 */
export async function createTransactionForUi(payload) {
  const fingerprint = stableStringify(payload);
  const { key: idempotencyKey, reused: keyWasReused } = idempotencyKeyForAttempt(fingerprint);
  // Relógio de PAREDE, não soma de esperas: o que prende o drawer em
  // "Enviando…" é o tempo total, e boa parte dele pode estar dentro de uma
  // requisição travada até o timeout de 30s, sem nenhum sono envolvido.
  const startedAtMs = Date.now();

  for (let attempt = 1; ; attempt += 1) {
    let replayed = null;
    try {
      const created = await createTransaction(payload, {
        idempotencyKey,
        onIdempotentReplay: (value) => {
          replayed = value;
        },
      });
      // `Idempotent-Replay: true` numa chave que NASCEU nesta chamada, na
      // primeira tentativa, é prova determinística de que a criação foi
      // engolida: o servidor devolveu a resposta de um lançamento anterior e
      // nada foi criado agora. Dizer "Registrado!" aqui seria mentira — a
      // mesma que o TTL de 10 min só consegue chutar. (Replay em chave
      // REUSADA, ou numa tentativa seguinte, é o caminho feliz do reenvio:
      // aquele lançamento existe mesmo, e é dele que a tela está falando.)
      if (replayed === true && !keyWasReused && attempt === 1) {
        const swallowed = new Error(SWALLOWED_MESSAGE);
        swallowed[SWALLOWED_FLAG] = true;
        // Solta a chave: o próximo "Tentar novamente" precisa sair com chave
        // NOVA, senão cai no mesmo replay para sempre.
        throw releasingKey(swallowed, fingerprint);
      }
      // Sucesso confirmado: a chave DESTA tentativa cumpriu o papel e sai do
      // mapa. Se ficasse retida, registrar de novo um lançamento idêntico
      // (mesmo valor, mesma descrição, mesmo dia — café duas vezes no mesmo
      // dia existe) cairia no replay e a segunda transação nunca seria criada.
      releaseCreateIdempotencyKey(fingerprint);
      return created;
    } catch (err) {
      if (createErrorWasSwallowedByReplay(err)) throw err;
      const idempotencyError = idempotencyErrorCodeOf(err);
      if (IDEMPOTENCY_ERROR_CODES.has(idempotencyError)) {
        // Um erro DE IDEMPOTÊNCIA só existe em backend que implementa a
        // feature — vale como prova de suporte igual ao header.
        noteIdempotencySupport();
      }
      if (
        idempotencyError === IDEMPOTENCY_PAYLOAD_MISMATCH ||
        idempotencyError === IDEMPOTENCY_INVALID_KEY
      ) {
        // Bug NOSSO: ou geramos uma chave fora do formato, ou reusamos uma
        // chave com payload diferente. Não repete (repetir dá o mesmo erro) e
        // libera a chave, para que a próxima tentativa nasça limpa em vez de
        // ficar presa no mesmo erro até a janela de 24h vencer.
        throw releasingKey(err, fingerprint);
      }

      const inFlight = idempotencyError === IDEMPOTENCY_IN_FLIGHT;
      const maxAttempts = inFlight ? CREATE_IN_FLIGHT_MAX_ATTEMPTS : CREATE_MAX_ATTEMPTS;
      // Desistir de um in-flight LIBERA a chave: reserva órfã responde 409
      // pelas 24h inteiras, então mantê-la retida prenderia a pessoa num
      // "aguarde alguns segundos" que nunca resolve. Liberando, o próximo
      // "Tentar novamente" sai com chave nova — e a UI avisa sobre o extrato,
      // porque aí pode mesmo duplicar.
      const giveUpError = () => (inFlight ? releasingKey(err, fingerprint) : err);

      if (attempt >= maxAttempts) throw giveUpError();
      if (!isCreateTransactionErrorRetryable(err)) throw err;
      // Retry só depois que o servidor provou que implementa idempotência.
      // Sem essa prova (frontend no ar antes da API), repetir volta a ser o
      // risco de duplicata da issue #102.
      if (!inFlight && !hasObservedIdempotencySupport()) throw err;

      const delay = createRetryDelayMs(err, attempt, {
        inFlight,
        spentMs: Date.now() - startedAtMs,
      });
      if (delay == null) throw giveUpError(); // orçamento de parede esgotado

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function updateTransactionForUi(transactionId, organizationId, payload) {
  return updateTransaction(transactionId, organizationId, payload);
}
