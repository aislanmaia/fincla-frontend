// api/cardInvoiceImports.ts — Conciliar fatura (fincla-api#554; primeira entrega #555, segunda #556:
// desfazer, rascunho, "Faturas conciliadas" do cartão e reimportação; terceira #557: compras novas,
// à vista e parceladas; quarta #558: encargos, tarifas e estornos, com o grupo de encargos).
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
import { normalizeStatementUndoPreview, type StatementUndoPreview, type UndoRefusalCode } from './statementImports';

/** Os 8 passos da conciliação da fatura, na ordem (cada fluxo com a sua contagem, decisão 9). */
export type InvoiceReconciliationStep =
  | 'suggested' | 'other_invoice' | 'doubt' | 'charges' | 'new' | 'leftover' | 'total' | 'summary';
/**
 * O passo do lançamento, fixo: responder outra coisa não muda o passo. `reconciled` (#556): já
 * conferido por uma conciliação concluída deste cartão (reimportação), só leitura, "já conferido".
 */
export type InvoiceEntryClassification = 'reconciled' | 'suggested' | 'other_invoice' | 'doubt' | 'charges' | 'new';
/**
 * `pair`, `ignore` e (#557) `create`; as próximas fatias trazem `move`, `move_series`.
 * `reconciled` e (#558) `pair_sum` (o grupo de encargos somado numa transação, respondido pelo
 * grupo) só vêm do servidor: nunca se enviam num lançamento.
 */
export type InvoiceEntryAnswer = 'pair' | 'ignore' | 'create' | 'move' | 'move_series' | 'reconciled' | 'pair_sum';
/** As respostas do grupo de encargos (#558): Sim, somados em <transação> · Não, adicionar cada um · Não registrar. */
export type ChargeGroupAnswer = 'pair_sum' | 'create' | 'ignore';
/** A seção do PDF onde o banco imprimiu o lançamento. */
export type InvoiceSection = 'purchases' | 'international' | 'services' | 'charges';
export type CardInvoiceImportStatus = 'draft' | 'concluded' | 'undone';

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

/**
 * Compra parcelada nova (#557, decisão 5): `full` = Compra inteira (parcelas 1 a M, o padrão);
 * `from_current` = Só daqui em diante (N a M). `null` à vista.
 */
export type InstallmentsScope = 'full' | 'from_current';

/** Uma parcela da compra nova, na fatura em que cai (`invoice_month` = mês em que ela fecha). */
export interface NewPurchaseInstallment {
  number: number;
  amount: number;
  currency: string | null;
  invoice_year: number;
  invoice_month: number;
  /** `false` = o banco não listou esta parcela: o valor é o da parcela N ("valor estimado"). */
  from_bank: boolean;
  /** A fatura dela já está paga: a parcela entra já paga (a única exceção à decisão 1). */
  invoice_paid: boolean;
}

/**
 * A compra parcelada nova inteira (1..M), cada parcela na sua fatura. `total_amount` é o mesmo nas
 * duas opções. `null` à vista, em crédito e fora de `suggested`/`new`.
 */
export interface NewPurchase {
  installments_count: number;
  total_amount: InvoiceMoney | null;
  installments: NewPurchaseInstallment[];
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
  /** Fatura já paga no Fincla: o par liga sem trocar o valor (decisão 1). E `create` é recusado. */
  value_locked: boolean;
  // A compra nova (#557): o formulário de "Adicionar" / "Não, adicionar agora".
  /** Pré-preenchida com o texto do banco sem o "NN/MM"; vazia bloqueia o concluir. */
  description: string;
  /** Travado: `expense` (cobrança) ou `refund` (crédito). */
  transaction_type: 'expense' | 'refund';
  category_tag_id: string | null;
  /** A categoria pelo histórico (#513); `null` = sem histórico parecido. */
  suggested_category_tag_id: string | null;
  /** Só da categoria escolhida. */
  detail_tag_ids: string[];
  installments_scope: InstallmentsScope | null;
  new_purchase: NewPurchase | null;
  /** Depois de concluir com `create`: a transação criada nesta fatura (na parcelada, a parcela N). */
  created_transaction_id: number | null;
  /** O grupo de encargos do lançamento (#558): a resposta e o confirmar vêm pelo grupo. `null` fora dele. */
  charge_group_id: string | null;
  /**
   * "Adicionar" é uma resposta possível agora (#558, QA F3 OBS-09): `false` em fatura já paga, em
   * crédito parcelado e fora dos passos respondíveis. Sem ele, o formulário fica só leitura.
   */
  addable: boolean;
}

/**
 * O grupo de encargos do passo 4 (#558): os lançamentos da seção Encargos sem par, respondidos
 * juntos. `total` = a Soma, no sentido do dinheiro (negativa).
 */
export interface ChargeGroup {
  id: string;
  /** Os lançamentos do grupo, na ordem do banco. */
  entry_ids: string[];
  total: number;
  currency: string | null;
  /** A transação cujo valor é a soma, ao centavo ("A soma bate"); `null` = nenhuma bate. */
  suggested_transaction_id: number | null;
  paired_transaction_id: number | null;
  /** `null` = sem resposta (bloqueia o concluir). */
  answer: ChargeGroupAnswer | null;
  confirmed: boolean;
  /** `false` numa conciliação concluída ou desfeita. */
  answerable: boolean;
  /** "Não, adicionar cada um" é possível: `false` em fatura já paga (decisão 1). */
  addable: boolean;
  /** A transação somada, ao vivo, também com `create`/`ignore` (a tela a mostra cinza listrada). */
  fincla_transaction: InvoiceFinclaTransaction | null;
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
  /**
   * O cartão do PDF, quando é outro da organização ("Conciliar no cartão X"). Com `other_card` pode
   * vir `null` (mais de um outro cartão com o final do PDF): o aviso fica, sem o botão.
   */
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
  /** Já conferidos por uma conciliação concluída deste cartão (reimportação, #556); fora de `read_only`. */
  already_reconciled: number;
  /** Respondidos `create` (#557). */
  to_create: number;
  /** `create` sem descrição: bloqueia o concluir. */
  missing_description: number;
  /** `create` sem categoria: vão para Não classificado ao concluir. */
  uncategorized: number;
  /** Lançamentos do grupo de encargos respondidos `pair_sum` ("encargos já somados", #558). */
  summed_charges: number;
}

/** O mesmo PDF já veio numa conciliação concluída deste cartão (`already_imported`): só avisa. */
export interface InvoiceFileCheck {
  status: 'new' | 'already_imported';
  import_id: string | null;
  concluded_at: string | null;
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
  /** Nome do arquivo enviado, como o navegador mandou; `null` = não veio nome. */
  file_name: string | null;
  bank_summary: InvoiceBankSummary;
  entries: InvoiceEntry[];
  /** O grupo de encargos (#558, no máximo um): vazio quando não há encargos sem par. */
  charge_groups: ChargeGroup[];
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
  undone_at: string | null;
  /** É a concluída mais recente do cartão: a única que pode ser desfeita. */
  latest_concluded: boolean;
  file_check: InvoiceFileCheck;
}

/** Uma linha de "Faturas conciliadas" do cartão: o detalhe sem `entries` (nem cartão, resumo do banco). */
export type CardInvoiceImportListItem = Pick<
  CardInvoiceImport,
  | 'id' | 'status' | 'invoice' | 'file_name' | 'summary' | 'difference_now' | 'final_difference' | 'can_conclude' | 'blockers'
  | 'current_step' | 'created_at' | 'last_activity_at' | 'expires_at' | 'concluded_at' | 'undone_at' | 'latest_concluded'
>;

/**
 * A recusa do desfazer: as do extrato, e `invoice_paid` (decisão 8: a fatura já foi paga). Em
 * `invoice_paid`, `invoice_year`/`invoice_month` dizem QUAL fatura paga segura o desfazer (a
 * conciliada ou uma anterior, onde entrou uma parcela); `null` nos outros códigos. A `message` já a
 * nomeia.
 */
export type CardInvoiceUndoPreview = Omit<StatementUndoPreview, 'refusal'> & {
  refusal: {
    code: UndoRefusalCode | 'invoice_paid';
    message: string;
    invoice_year?: number | null;
    invoice_month?: number | null;
  } | null;
};

/** O desfazer feito: `status: 'undone'`, com quantas transações ele apagou. */
export type UndoneCardInvoiceImport = CardInvoiceImport & { deleted_transactions: number | null };

/**
 * O grupo inteiro (#558): responder confirma, a menos que `confirmed` venha junto; só `{confirmed}`
 * mantém a resposta. `answer: null` (enviado) volta o grupo a sem resposta (`confirmed: false`): o
 * "Desfazer escolha" da primeira resposta de um grupo que começou sem resposta.
 */
export interface UpdateChargeGroupRequest {
  answer?: ChargeGroupAnswer | null;
  confirmed?: boolean;
}

export interface UpdateInvoiceEntryRequest {
  answer?: 'pair' | 'ignore' | 'create';
  transaction_id?: number | null;
  confirmed?: boolean;
  // A compra nova (#557): mudam com ou sem `answer`.
  description?: string;
  category_tag_id?: string | null;
  detail_tag_ids?: string[];
  installments_scope?: InstallmentsScope;
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

const normalizeNewPurchase = (raw: Raw | null | undefined): NewPurchase | null => {
  if (!raw) return null;
  return {
    installments_count: Number(raw.installments_count),
    total_amount: moneyOrNull(raw.total_amount as WireMoney),
    installments: ((raw.installments as Raw[]) ?? []).map((i) => ({
      number: Number(i.number),
      amount: toAmount(i.amount as WireMoney),
      currency: toCurrency(i.amount),
      invoice_year: Number(i.invoice_year),
      invoice_month: Number(i.invoice_month),
      from_bank: Boolean(i.from_bank),
      invoice_paid: Boolean(i.invoice_paid),
    })),
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
    description: (raw.description as string | null) ?? '',
    transaction_type: (raw.transaction_type as InvoiceEntry['transaction_type'] | null) ?? (toAmount(raw.amount as WireMoney) > 0 ? 'refund' : 'expense'),
    category_tag_id: (raw.category_tag_id as string | null) ?? null,
    suggested_category_tag_id: (raw.suggested_category_tag_id as string | null) ?? null,
    detail_tag_ids: (raw.detail_tag_ids as string[] | null) ?? [],
    installments_scope: (raw.installments_scope as InstallmentsScope | null) ?? null,
    new_purchase: normalizeNewPurchase(raw.new_purchase as Raw | null),
    created_transaction_id: (raw.created_transaction_id as number | null) ?? null,
    charge_group_id: (raw.charge_group_id as string | null) ?? null,
    // Um backend sem o campo (anterior à #558): Adicionar vale onde a resposta vale.
    addable: raw.addable === undefined ? Boolean(raw.answerable) : Boolean(raw.addable),
  };
};

export const normalizeChargeGroup = (raw: Raw): ChargeGroup => ({
  id: String(raw.id),
  entry_ids: (raw.entry_ids as string[]) ?? [],
  total: toAmount(raw.total as WireMoney),
  currency: toCurrency(raw.total),
  suggested_transaction_id: (raw.suggested_transaction_id as number | null) ?? null,
  paired_transaction_id: (raw.paired_transaction_id as number | null) ?? null,
  answer: (raw.answer as ChargeGroupAnswer | null) ?? null,
  confirmed: Boolean(raw.confirmed),
  answerable: Boolean(raw.answerable),
  addable: Boolean(raw.addable),
  fincla_transaction: normalizeFincla(raw.fincla_transaction as Raw | null),
});

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

const normalizeDifferenceNow = (raw: unknown): InvoiceDifferenceNow => {
  const diff = (raw as { bank: WireMoney; fincla: WireMoney; difference: WireMoney } | null) ?? null;
  return {
    bank: diff ? toFiniteNumber(diff.bank) : null,
    fincla: diff ? toFiniteNumber(diff.fincla) : null,
    difference: diff ? toFiniteNumber(diff.difference) : null,
    currency: diff ? toCurrency(diff.bank) : null,
  };
};

const normalizeInvoiceRef = (raw: unknown): InvoiceRef => {
  const invoice = raw as Raw;
  return { ...(invoice as unknown as InvoiceRef), total: moneyOrNull(invoice?.total as WireMoney) };
};

const normalizeSummary = (raw: unknown): CardInvoiceImportSummary => {
  const summary = (raw ?? {}) as CardInvoiceImportSummary;
  return {
    ...summary,
    already_reconciled: summary.already_reconciled ?? 0,
    to_create: summary.to_create ?? 0,
    missing_description: summary.missing_description ?? 0,
    uncategorized: summary.uncategorized ?? 0,
    summed_charges: summary.summed_charges ?? 0,
  };
};

/** Os campos de uma conciliação comuns ao detalhe e à linha da lista. */
const normalizeCommon = (raw: Raw) => ({
  invoice: normalizeInvoiceRef(raw.invoice),
  file_name: (raw.file_name as string | null) ?? null,
  summary: normalizeSummary(raw.summary),
  difference_now: normalizeDifferenceNow(raw.difference_now),
  blockers: (raw.blockers as CardInvoiceImport['blockers']) ?? [],
  final_difference: moneyOrNull(raw.final_difference as WireMoney),
  current_step: (raw.current_step as InvoiceReconciliationStep | null) ?? null,
  expires_at: (raw.expires_at as string | null) ?? null,
  concluded_at: (raw.concluded_at as string | null) ?? null,
  undone_at: (raw.undone_at as string | null) ?? null,
  latest_concluded: Boolean(raw.latest_concluded),
});

export const normalizeCardInvoiceImport = (raw: Raw): CardInvoiceImport => {
  const fileCheck = raw.file_check as InvoiceFileCheck | null | undefined;
  return {
    ...(raw as unknown as CardInvoiceImport),
    ...normalizeCommon(raw),
    kind: 'card_invoice',
    card_check: (raw.card_check as CardCheck) ?? { status: 'same_card', file_last4: null, suggested_card: null },
    bank_summary: normalizeBankSummary(raw.bank_summary as Raw),
    entries: ((raw.entries as Raw[]) ?? []).map(normalizeInvoiceEntry),
    charge_groups: ((raw.charge_groups as Raw[]) ?? []).map(normalizeChargeGroup),
    reviewed_steps: (raw.reviewed_steps as InvoiceReconciliationStep[]) ?? [],
    file_check: {
      status: fileCheck?.status ?? 'new',
      import_id: fileCheck?.import_id ?? null,
      concluded_at: fileCheck?.concluded_at ?? null,
    },
  };
};

export const normalizeCardInvoiceImportListItem = (raw: Raw): CardInvoiceImportListItem => ({
  ...(raw as unknown as CardInvoiceImportListItem),
  ...normalizeCommon(raw),
  can_conclude: Boolean(raw.can_conclude),
});

/** A resposta de um envio é uma fatura de cartão? (a área de envio da conta aceita PDF, #555) */
export const isCardInvoiceResponse = (raw: unknown): boolean =>
  Boolean(raw && typeof raw === 'object' && (raw as Raw).kind === 'card_invoice');

/**
 * Já há conciliação em andamento desta fatura (409 `invoice_draft_in_progress`): o rascunho a abrir.
 * `creditCardId` é o `id` inteiro do cartão; a URL da tela usa `creditCardPublicId`.
 */
export interface InvoiceDraftInProgress {
  importId: string;
  creditCardId: number | null;
  creditCardPublicId: string | null;
  message: string;
}

export const invoiceDraftInProgressOf = (error: unknown): InvoiceDraftInProgress | null => {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail as
    | { reason?: string; import_id?: string; credit_card_id?: number; credit_card_public_id?: string; message?: string }
    | undefined;
  if (response?.status !== 409 || detail?.reason !== 'invoice_draft_in_progress' || !detail.import_id) return null;
  return {
    importId: detail.import_id,
    creditCardId: detail.credit_card_id ?? null,
    creditCardPublicId: detail.credit_card_public_id ?? null,
    message: detail.message ?? '',
  };
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

/**
 * O mesmo, em lote (tudo ou nada). `groups` (#558) responde/confirma grupos de encargos como a rota
 * do grupo, aplicados depois dos `entries`, na mesma transação: o "Próximo" que confirma lançamentos
 * e o grupo é uma chamada só. Só a lista que vier vai no corpo.
 */
export const updateCardInvoiceEntries = async (
  cardId: number,
  organizationId: string,
  importId: string,
  entries: (UpdateInvoiceEntryRequest & { id: string })[],
  groups: (UpdateChargeGroupRequest & { id: string })[] = [],
): Promise<CardInvoiceImport> => {
  const body = groups.length ? { ...(entries.length ? { entries } : null), groups } : { entries };
  const response = await apiClient.patch<Raw>(`${base(cardId)}/${importId}/entries`, body, {
    params: { organization_id: organizationId },
  });
  return normalizeCardInvoiceImport(response.data);
};

/**
 * Responde (ou só confirma) o grupo de encargos inteiro (#558). Devolve o rascunho: a resposta vale
 * para todos os lançamentos do grupo. Um lançamento do grupo nunca é respondido sozinho (`422`
 * `card_invoice_import.charge_group_member`).
 */
export const updateCardInvoiceChargeGroup = async (
  cardId: number,
  organizationId: string,
  importId: string,
  groupId: string,
  body: UpdateChargeGroupRequest,
): Promise<CardInvoiceImport> => {
  const response = await apiClient.patch<Raw>(`${base(cardId)}/${importId}/charge-groups/${groupId}`, body, {
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

/** "Faturas conciliadas" do cartão: rascunhos, concluídas e desfeitas, da mais nova para a mais antiga. */
export const listCardInvoiceImports = async (cardId: number, organizationId: string): Promise<CardInvoiceImportListItem[]> => {
  const response = await apiClient.get<{ imports: Raw[] }>(base(cardId), { params: { organization_id: organizationId } });
  return (response.data.imports ?? []).map(normalizeCardInvoiceImportListItem);
};

/** O que desfazer vai fazer agora (e o motivo, se não der). Não muda nada. Mesmas peças do extrato. */
export const previewCardInvoiceImportUndo = async (
  cardId: number,
  organizationId: string,
  importId: string,
): Promise<CardInvoiceUndoPreview> => {
  const response = await apiClient.get(`${base(cardId)}/${importId}/undo-preview`, { params: { organization_id: organizationId } });
  return normalizeStatementUndoPreview(response.data as Parameters<typeof normalizeStatementUndoPreview>[0]) as CardInvoiceUndoPreview;
};

/** Desfaz a conciliação concluída mais recente do cartão (tudo ou nada). */
export const undoCardInvoiceImport = async (cardId: number, organizationId: string, importId: string): Promise<UndoneCardInvoiceImport> => {
  const response = await apiClient.post<Raw>(`${base(cardId)}/${importId}/undo`, null, { params: { organization_id: organizationId } });
  const deleted = response.data.deleted_transactions;
  return { ...normalizeCardInvoiceImport(response.data), deleted_transactions: typeof deleted === 'number' ? deleted : null };
};
