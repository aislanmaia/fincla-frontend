// api/cardInvoiceImports.ts — Conciliar fatura (fincla-api#554, primeira entrega #555).
//
// O recurso vive aninhado no cartão: `/credit-cards/{cardId}/invoice-imports`, com o `id` INTEIRO
// do cartão (a URL da tela usa o `public_id`). A forma da resposta é a de
// `src/api/__fixtures__/card_invoice_import.example.json`, cópia byte a byte da fixture canônica do
// backend (presa aos modelos Pydantic por um teste de lá).
//
// Dinheiro: o fio manda `{amount, currency}`. A fronteira converte para número + moeda; o que pode
// faltar (o total do Fincla, a diferença) fica `null` = "não sabemos", nunca zero.
import apiClient from './client';
import { toAmount, toCurrency, toFiniteNumber, type WireMoney } from './money';

/** Os 8 passos da conciliação da fatura, na ordem (cada fluxo com a sua contagem, decisão 9). */
export type InvoiceReconciliationStep =
  | 'suggested' | 'other_invoice' | 'doubt' | 'charges' | 'new' | 'leftover' | 'total' | 'summary';
/** O passo do lançamento, fixo: responder outra coisa não muda o passo. */
export type InvoiceEntryClassification = 'suggested' | 'other_invoice' | 'doubt' | 'charges' | 'new';
/** Nesta versão só `pair` e `ignore`; as próximas fatias trazem `create`, `move`, `move_series`. */
export type InvoiceEntryAnswer = 'pair' | 'ignore' | 'create' | 'move' | 'move_series';
/** A seção do PDF onde o banco imprimiu o lançamento. */
export type InvoiceSection = 'purchases' | 'international' | 'services' | 'charges';
export type CardInvoiceImportStatus = 'draft' | 'concluded';

/** Um valor em dinheiro já convertido: `amount` com sinal como veio, `currency` declarada pelo fio. */
export interface InvoiceMoney {
  amount: number;
  currency: string | null;
}

/** "NN/MM" da parcela. */
export interface InstallmentPosition {
  number: number;
  count: number;
}

/** O lado "No Fincla", lido ao vivo. */
export interface InvoiceFinclaTransaction {
  id: number;
  description: string;
  type: 'expense' | 'refund' | 'income';
  /** Sem sinal. */
  value: number;
  currency: string | null;
  /** Numa parcela é o vencimento da fatura (regra aa087); a tela lê os 10 primeiros caracteres. */
  date: string;
  /** A data da compra da série (parcela) ou a da própria compra; é por ela que o par é feito. */
  purchase_date: string | null;
  installment: InstallmentPosition | null;
  invoice_id: number | null;
  status: string;
  paid_at: string | null;
  category_name: string | null;
  tag_names: string[];
  /** `amount`: valor ≠ do banco; `date`: dia da compra ≠ do banco. */
  differences: ('amount' | 'date')[];
}

export interface InvoiceEntry {
  id: string;
  position: number;
  /** Dia da compra no banco, "YYYY-MM-DD" (numa parcela, o da compra original). */
  date: string;
  /** Texto do banco, com o "NN/MM" da parcela como o banco imprime. */
  bank_description: string;
  /** No sentido do dinheiro: cobrança negativa, crédito positivo. */
  amount: number;
  currency: string | null;
  section: InvoiceSection;
  installment: InstallmentPosition | null;
  /** O que o banco vai cobrar nas próximas parcelas desta compra; vazio = não listou. Positivo. */
  next_installments: { number: number; amount: number; currency: string | null }[];
  /** Só informativo (compra internacional). */
  foreign_amount: { amount: string; currency: string } | null;
  /** Final do cartão (titular ou adicional): etiqueta "final 1234". */
  card_last4: string | null;
  classification: InvoiceEntryClassification;
  answer: InvoiceEntryAnswer | null;
  confirmed: boolean;
  /** `false` = "Fica de fora nesta versão": só leitura (e, numa concluída, tudo). */
  answerable: boolean;
  suggested_transaction_id: number | null;
  paired_transaction_id: number | null;
  fincla_transaction: InvoiceFinclaTransaction | null;
  /** Com `pair` e valor diferente: ao concluir a transação passa de `from` para `to` (o valor do banco). */
  value_change: { from: number; to: number; currency: string | null } | null;
  /** Fatura já paga no Fincla: o par liga sem trocar o valor (decisão 1). */
  value_locked: boolean;
}

export interface InvoiceRef {
  id: number;
  year: number;
  /** O mês em que a fatura fecha. */
  month: number;
  due_date: string;
  closing_date: string;
  status: 'open' | 'closed' | 'paid' | string;
  /** O total no Fincla hoje (estorno subtrai); `null` = a fatura sumiu (não sabemos). */
  total: InvoiceMoney | null;
}

export interface CardRef {
  id: number;
  public_id: string;
  name: string;
}

export interface CardCheck {
  status: 'same_card' | 'other_card';
  file_last4: string | null;
  /** O cartão do PDF, quando é outro da organização ("Conciliar no cartão X"). */
  suggested_card: CardRef | null;
}

/** O resumo da página 1 do PDF. Pagamento e saldo financiado são só referência (decisão 6). */
export interface InvoiceBankSummary {
  previous_total: InvoiceMoney | null;
  payment: { amount: InvoiceMoney | null; date: string | null } | null;
  financed_balance: InvoiceMoney | null;
  charges: InvoiceMoney | null;
  current_entries: InvoiceMoney | null;
  total: InvoiceMoney | null;
  due_date: string | null;
  issue_date: string | null;
  posting_date: string | null;
  next_closing_date: string | null;
}

export interface CardInvoiceImportSummary {
  total: number;
  suggested: number;
  to_pair: number;
  unconfirmed: number;
  value_changes: number;
  /** Inclui os `read_only`. */
  ignored: number;
  read_only: number;
  unanswered: number;
}

/** Banco − Fincla, com as respostas projetadas. `fincla`/`difference` `null` = não sabemos (nunca zero). */
export interface InvoiceDifferenceNow {
  bank: number | null;
  fincla: number | null;
  difference: number | null;
  currency: string | null;
}

export interface CardInvoiceImport {
  kind: 'card_invoice';
  id: string;
  status: CardInvoiceImportStatus;
  /** A conta de liquidação do cartão. */
  account_id: string;
  credit_card: CardRef & { last4: string | null };
  invoice: InvoiceRef;
  card_check: CardCheck;
  bank_summary: InvoiceBankSummary;
  entries: InvoiceEntry[];
  summary: CardInvoiceImportSummary;
  difference_now: InvoiceDifferenceNow;
  can_conclude: boolean;
  blockers: { code: string; count: number }[];
  /** Registrada ao concluir. `null` = ainda não (nunca zero). */
  final_difference: InvoiceMoney | null;
  current_step: InvoiceReconciliationStep | null;
  reviewed_steps: InvoiceReconciliationStep[];
  created_at: string;
  last_activity_at: string;
  expires_at: string | null;
  concluded_at: string | null;
}

export interface UpdateInvoiceEntryRequest {
  answer?: 'pair' | 'ignore';
  transaction_id?: number | null;
  confirmed?: boolean;
}

// --------------------------------------------------------------------------------------------
// Fronteira
// --------------------------------------------------------------------------------------------

type Raw = Record<string, unknown>;

const moneyOrNull = (value: WireMoney): InvoiceMoney | null => {
  const amount = toFiniteNumber(value);
  return amount === null ? null : { amount, currency: toCurrency(value) };
};

const normalizeFincla = (raw: Raw | null | undefined): InvoiceFinclaTransaction | null => {
  if (!raw) return null;
  return {
    ...(raw as unknown as InvoiceFinclaTransaction),
    value: toAmount(raw.value as WireMoney),
    currency: toCurrency(raw.value),
    purchase_date: (raw.purchase_date as string | null) ?? null,
    installment: (raw.installment as InstallmentPosition | null) ?? null,
    tag_names: (raw.tag_names as string[]) ?? [],
    differences: (raw.differences as InvoiceFinclaTransaction['differences']) ?? [],
  };
};

export const normalizeInvoiceEntry = (raw: Raw): InvoiceEntry => {
  const change = raw.value_change as { from: WireMoney; to: WireMoney } | null | undefined;
  return {
    ...(raw as unknown as InvoiceEntry),
    amount: toAmount(raw.amount as WireMoney),
    currency: toCurrency(raw.amount),
    installment: (raw.installment as InstallmentPosition | null) ?? null,
    next_installments: ((raw.next_installments as { number: number; amount: WireMoney }[]) ?? []).map((n) => ({
      number: n.number,
      amount: toAmount(n.amount),
      currency: toCurrency(n.amount),
    })),
    foreign_amount: (raw.foreign_amount as InvoiceEntry['foreign_amount']) ?? null,
    card_last4: (raw.card_last4 as string | null) ?? null,
    answer: (raw.answer as InvoiceEntryAnswer | null) ?? null,
    confirmed: Boolean(raw.confirmed),
    answerable: Boolean(raw.answerable),
    suggested_transaction_id: (raw.suggested_transaction_id as number | null) ?? null,
    paired_transaction_id: (raw.paired_transaction_id as number | null) ?? null,
    fincla_transaction: normalizeFincla(raw.fincla_transaction as Raw | null),
    value_change: change ? { from: toAmount(change.from), to: toAmount(change.to), currency: toCurrency(change.to) } : null,
    value_locked: Boolean(raw.value_locked),
  };
};

const normalizeBankSummary = (raw: Raw | null | undefined): InvoiceBankSummary => {
  const r = raw ?? {};
  const payment = r.payment as { amount: WireMoney; date: string | null } | null | undefined;
  return {
    previous_total: moneyOrNull(r.previous_total as WireMoney),
    payment: payment ? { amount: moneyOrNull(payment.amount), date: payment.date ?? null } : null,
    financed_balance: moneyOrNull(r.financed_balance as WireMoney),
    charges: moneyOrNull(r.charges as WireMoney),
    current_entries: moneyOrNull(r.current_entries as WireMoney),
    total: moneyOrNull(r.total as WireMoney),
    due_date: (r.due_date as string | null) ?? null,
    issue_date: (r.issue_date as string | null) ?? null,
    posting_date: (r.posting_date as string | null) ?? null,
    next_closing_date: (r.next_closing_date as string | null) ?? null,
  };
};

export const normalizeCardInvoiceImport = (raw: Raw): CardInvoiceImport => {
  const invoice = raw.invoice as Raw;
  const diff = (raw.difference_now as { bank: WireMoney; fincla: WireMoney; difference: WireMoney } | null) ?? null;
  return {
    ...(raw as unknown as CardInvoiceImport),
    kind: 'card_invoice',
    invoice: { ...(invoice as unknown as InvoiceRef), total: moneyOrNull(invoice?.total as WireMoney) },
    card_check: (raw.card_check as CardCheck) ?? { status: 'same_card', file_last4: null, suggested_card: null },
    bank_summary: normalizeBankSummary(raw.bank_summary as Raw),
    entries: ((raw.entries as Raw[]) ?? []).map(normalizeInvoiceEntry),
    difference_now: {
      bank: diff ? toFiniteNumber(diff.bank) : null,
      fincla: diff ? toFiniteNumber(diff.fincla) : null,
      difference: diff ? toFiniteNumber(diff.difference) : null,
      currency: diff ? toCurrency(diff.bank) : null,
    },
    blockers: (raw.blockers as CardInvoiceImport['blockers']) ?? [],
    final_difference: moneyOrNull(raw.final_difference as WireMoney),
    current_step: (raw.current_step as InvoiceReconciliationStep | null) ?? null,
    reviewed_steps: (raw.reviewed_steps as InvoiceReconciliationStep[]) ?? [],
  };
};

/** A resposta de um envio é uma fatura de cartão? (a área de envio da conta aceita PDF, #555) */
export const isCardInvoiceResponse = (raw: unknown): boolean =>
  Boolean(raw && typeof raw === 'object' && (raw as Raw).kind === 'card_invoice');

/**
 * Já há conciliação em andamento desta fatura (409 `invoice_draft_in_progress`): o rascunho a abrir.
 * `creditCardId` é o `id` inteiro do cartão; a URL da tela pede o `public_id`.
 */
export const invoiceDraftInProgressOf = (
  error: unknown,
): { importId: string; creditCardId: number | null; message: string } | null => {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail as
    | { reason?: string; import_id?: string; credit_card_id?: number; message?: string }
    | undefined;
  if (response?.status !== 409 || detail?.reason !== 'invoice_draft_in_progress' || !detail.import_id) return null;
  return { importId: detail.import_id, creditCardId: detail.credit_card_id ?? null, message: detail.message ?? '' };
};

// --------------------------------------------------------------------------------------------
// Rotas
// --------------------------------------------------------------------------------------------

const base = (cardId: number) => `/credit-cards/${cardId}/invoice-imports`;

/** Envia o PDF da fatura (até 5 MB) e cria o rascunho. */
export const uploadCardInvoice = async (cardId: number, organizationId: string, file: File): Promise<CardInvoiceImport> => {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post<Raw>(base(cardId), form, {
    params: { organization_id: organizationId },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeCardInvoiceImport(response.data);
};

export const getCardInvoiceImport = async (cardId: number, organizationId: string, importId: string): Promise<CardInvoiceImport> => {
  const response = await apiClient.get<Raw>(`${base(cardId)}/${importId}`, { params: { organization_id: organizationId } });
  return normalizeCardInvoiceImport(response.data);
};

/** Grava onde a revisão parou (passo aberto e passos já vistos). */
export const updateCardInvoiceImportProgress = async (
  cardId: number,
  organizationId: string,
  importId: string,
  body: { current_step?: InvoiceReconciliationStep | null; reviewed_steps?: InvoiceReconciliationStep[] },
): Promise<CardInvoiceImport> => {
  const response = await apiClient.patch<Raw>(`${base(cardId)}/${importId}`, body, { params: { organization_id: organizationId } });
  return normalizeCardInvoiceImport(response.data);
};

/** Descarta o rascunho. Nada no Fincla muda. */
export const discardCardInvoiceImport = async (cardId: number, organizationId: string, importId: string): Promise<void> => {
  await apiClient.delete(`${base(cardId)}/${importId}`, { params: { organization_id: organizationId } });
};

/** Responde um lançamento. Responder confirma, a menos que `confirmed` venha junto (Desfazer escolha). */
export const updateCardInvoiceEntry = async (
  cardId: number,
  organizationId: string,
  importId: string,
  entryId: string,
  body: UpdateInvoiceEntryRequest,
): Promise<InvoiceEntry> => {
  const response = await apiClient.patch<Raw>(`${base(cardId)}/${importId}/entries/${entryId}`, body, {
    params: { organization_id: organizationId },
  });
  return normalizeInvoiceEntry(response.data);
};

/** O mesmo, em lote (tudo ou nada). */
export const updateCardInvoiceEntries = async (
  cardId: number,
  organizationId: string,
  importId: string,
  entries: (UpdateInvoiceEntryRequest & { id: string })[],
): Promise<CardInvoiceImport> => {
  const response = await apiClient.patch<Raw>(`${base(cardId)}/${importId}/entries`, { entries }, {
    params: { organization_id: organizationId },
  });
  return normalizeCardInvoiceImport(response.data);
};

/** "Confirmar as N de uma vez" (`confirmed: true`) e o Desfazer da faixa (`confirmed: false`). */
export const confirmCardInvoiceSuggestions = async (
  cardId: number,
  organizationId: string,
  importId: string,
  entryIds: string[],
  confirmed = true,
): Promise<CardInvoiceImport> => {
  const response = await apiClient.post<Raw>(
    `${base(cardId)}/${importId}/suggestions/confirm`,
    { entry_ids: entryIds, confirmed },
    { params: { organization_id: organizationId } },
  );
  return normalizeCardInvoiceImport(response.data);
};

/** Aplica tudo de uma vez (ou nada). Não paga a fatura. */
export const concludeCardInvoiceImport = async (cardId: number, organizationId: string, importId: string): Promise<CardInvoiceImport> => {
  const response = await apiClient.post<Raw>(`${base(cardId)}/${importId}/conclude`, null, {
    params: { organization_id: organizationId },
  });
  return normalizeCardInvoiceImport(response.data);
};
