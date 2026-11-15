// api/statementImports.ts — Conciliar extrato (fincla-api#507/#508).
//
// O recurso vive aninhado na conta: `/accounts/{accountId}/statement-imports`. A forma da
// resposta é a de `src/api/__fixtures__/statement_import.example.json`, cópia byte a byte da
// fixture canônica do backend (presa aos modelos Pydantic por um teste de lá).
import apiClient from './client';
import { toAmount, toCurrency, toFiniteNumber, type WireMoney } from './money';

/** `reconciled` (fincla-api#516): já conferido numa importação anterior; nunca vem da pessoa e não muda. */
export type StatementEntryAnswer = 'pair' | 'create' | 'ignore' | 'group' | 'invoice_payment' | 'reconciled';
export type StatementTransactionType = 'income' | 'expense' | 'refund';
/** Só o que passa por conta corrente: compra no cartão de crédito sai na fatura, não no extrato. */
export type StatementPaymentMethod = 'pix' | 'boleto' | 'debit_card' | 'bank_transfer' | 'cash';
export type ConcludeBlockerCode = 'unanswered' | 'missing_description';
/** Os 8 passos da revisão guiada, na ordem (fincla-api#507). */
export type ReconciliationStep = 'suggested' | 'doubt' | 'invoice' | 'yield' | 'new' | 'outside' | 'balance' | 'summary';
/** Como o arquivo foi lido (fincla-api#515): OFX, XLS (BIFF), XLSX ou CSV. */
export type StatementFileFormat = 'ofx' | 'xls' | 'xlsx' | 'csv';
/**
 * O arquivo é desta conta? (fincla-api#515) Só avisa e sugere; nunca bloqueia.
 * `other_account` → aviso "parece ser de outra conta", com a conta certa quando o Fincla sabe qual é.
 */
export type AccountCheckStatus = 'not_identified' | 'first_time' | 'same_account' | 'other_account';
export interface AccountCheck {
  status: AccountCheckStatus;
  suggested_account: { id: string; name: string } | null;
}
/** Colunas (a partir de 0, as da prévia) com a data, a descrição e o valor de uma planilha. */
export interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
}
/** Primeiras linhas de uma planilha que o Fincla não reconheceu, para a pessoa indicar as colunas. */
export interface SheetPreview {
  rows: string[][];
  column_count: number;
  /** Mapeamento lembrado na conta para outro formato, para pré-selecionar; `null` se nenhum. */
  suggested_mapping: ColumnMapping | null;
}
/** Rascunho descartado ou expirado é apagado: não há status `discarded` (fincla-api#518). */
export type StatementImportStatus = 'draft' | 'concluded' | 'undone';
export interface StatementImportSummary {
  total: number;
  to_create: number;
  missing_description: number;
  unanswered: number;
  /** Respondidos "Sim, é esta": não viram transação nova (fincla-api#510). */
  to_pair: number;
  /** Respondidos "Não registrar": não viram nada. */
  ignored: number;
  /** Lançamentos somados em alguma soma (fincla-api#513). */
  grouped: number;
  /** Somas: cada uma vira uma transação. */
  groups: number;
  /** Transações que vão para Não classificado (lançamentos novos e somas sem categoria). */
  unclassified: number;
  /** Já conferidos numa importação anterior (fincla-api#516): não viram nada. */
  already_reconciled: number;
  /** Anteriores ao início do saldo da conta que continuam fora (já contados em `ignored`). */
  left_out_before_start: number;
}

/**
 * Este arquivo já foi importado? (fincla-api#516) Só avisa. `already_imported` traz a importação
 * concluída mais recente do mesmo arquivo (desfeita não conta).
 */
export interface FileCheck {
  status: 'new' | 'already_imported';
  import_id: string | null;
  account_id: string | null;
  account_name: string | null;
  concluded_at: string | null;
}

/** Lançamentos antes de `before` ficam fora por padrão: o saldo do Fincla já os inclui (fincla-api#516). */
export interface LeftOutFloor {
  before: string;
  /** `account_start`: saldo inicial declarado na abertura; `balance_adjustment`: último ajuste de saldo. */
  reason: 'account_start' | 'balance_adjustment';
}

/** "Somar em um só lançamento" (fincla-api#513): vira UMA transação ao concluir. */
export interface StatementGroup {
  id: string;
  /** Digitada pela pessoa (obrigatória). */
  description: string;
  transaction_type: StatementTransactionType;
  payment_method: StatementPaymentMethod;
  /** `null` = vai para Não classificado ao concluir. */
  category_tag_id: string | null;
  suggested_category_tag_id: string | null;
  detail_tag_ids: string[];
  /** Lançamentos somados, na ordem das datas. */
  entry_ids: string[];
  /** Soma exata dos lançamentos, com sinal. */
  amount: number;
  currency: string | null;
  /** Data do último lançamento somado: a data da transação. */
  date: string;
  created_transaction_id: number | null;
}

/**
 * Como o Fincla leu o lançamento (fixo, fincla-api#510): `suggested` = uma única transação (ou
 * transferência) da mesma conta, mesmo sentido, mesmo valor e data a até 5 dias (passo "Confirmar
 * lançamentos encontrados"); `doubt` = várias candidatas, ou uma só com diferença de até R$ 1,00
 * (passo "Decidir casos com dúvida", fincla-api#511; começa sem resposta); `yield` = rendimento
 * pequeno (entrada abaixo de R$ 1,00) sem par, que dá para somar no mês (fincla-api#513);
 * `reconciled` = já conferido numa importação anterior e `before_start` = anterior ao início do saldo
 * da conta (fincla-api#516, "Ver o que fica de fora"); `new` = sem par.
 */
export type StatementEntryClassification = 'new' | 'suggested' | 'doubt' | 'yield' | 'reconciled' | 'before_start';

/** O que difere do banco (fincla-api#511): VALOR DIFERENTE, DATAS DIFERENTES, OUTRA CONTA. */
export type MatchDifference = 'amount' | 'date' | 'account';

/**
 * Uma coisa do Fincla que pode ser o par do lançamento (fincla-api#511), lida ao vivo: uma
 * transação (`kind: 'transaction'`) ou uma transferência entre as contas da organização.
 */
export interface FinclaMatch {
  kind: 'transaction' | 'transfer';
  transaction_id: number | null;
  transfer_id: string | null;
  /** Na transferência, a observação (pode vir vazia). */
  description: string;
  type: StatementTransactionType | 'transfer';
  /** Sem sinal. */
  value: number;
  currency: string | null;
  /** Data de competência; a tela lê os 10 primeiros caracteres. */
  date: string;
  /** Dia em que o dinheiro se moveu no Fincla (`paid_at`, senão `date`), "YYYY-MM-DD". */
  day: string;
  status: 'pending' | 'confirmed' | 'paid' | null;
  paid_at: string | null;
  payment_method: string | null;
  category_name: string | null;
  tag_names: string[];
  account_id: string | null;
  account_name: string | null;
  from_account_name: string | null;
  to_account_name: string | null;
  differences: MatchDifference[];
  /** Outro lançamento do extrato já disse "Sim, é esta" com ela: desativada, com "Desfazer lá". */
  taken_by_entry_id: string | null;
}

/** O lado "No Fincla" do par: a transação como está hoje. */
export interface FinclaTransaction {
  id: number;
  description: string;
  type: StatementTransactionType;
  /** Sem sinal. */
  value: number;
  currency: string | null;
  /** Data de competência; a tela lê os 10 primeiros caracteres. */
  date: string;
  status: 'pending' | 'confirmed' | 'paid';
  paid_at: string | null;
  payment_method: string;
  category_name: string | null;
  tag_names: string[];
  account_id: string | null;
  account_name: string | null;
  differences: MatchDifference[];
}

export interface StatementEntry {
  id: string;
  position: number;
  /** Data do banco, "YYYY-MM-DD". Travada. */
  date: string;
  /** Texto do banco: continua visível mesmo depois de renomear. */
  bank_description: string;
  /** Com sinal: negativo é saída. Travado. */
  amount: number;
  /** `null` se o fio não declarar a moeda: nunca inventamos BRL (ver `toCurrency`). */
  currency: string | null;
  /** Só informativo (ADR 0009). */
  fitid: string | null;
  classification: StatementEntryClassification;
  answer: StatementEntryAnswer | null;
  description: string | null;
  transaction_type: StatementTransactionType | null;
  /** Sugerida pelo prefixo do texto do banco (`PIX …`, `PAG BOLETO …`, `RSHOP …`); editável. */
  payment_method: StatementPaymentMethod | null;
  /** `null` = vai para Não classificado ao concluir. */
  category_tag_id: string | null;
  /** O que o histórico sugeriu; igual a `category_tag_id` → "Sugerida pelo seu histórico". */
  suggested_category_tag_id: string | null;
  /** Etiquetas da transação nova, todas da categoria escolhida. */
  detail_tag_ids: string[];
  /** A soma em que o lançamento entrou (`answer: 'group'`). */
  group_id: string | null;
  created_transaction_id: number | null;
  /** Transação que o Fincla sugeriu como par (selo "Sugerido pelo Fincla"). */
  suggested_transaction_id: number | null;
  /** Transação pareada enquanto `answer === 'pair'`. */
  paired_transaction_id: number | null;
  /** A pessoa já passou por este lançamento; sugestão não confirmada = "Sugerido · falta confirmar". */
  confirmed: boolean;
  /** A transação do par (a escolhida, senão a sugerida); `null` se não há. */
  fincla_transaction: FinclaTransaction | null;
  /** Transferência sugerida / pareada (fincla-api#511). */
  suggested_transfer_id: string | null;
  paired_transfer_id: string | null;
  /** O par mostrado, transação OU transferência (a escolhida, senão a sugerida); `null` se não há. */
  fincla_match: FinclaMatch | null;
  /** Candidatas ao vivo na conta (só em rascunho), as mais parecidas primeiro. */
  candidates: FinclaMatch[];
}

export interface StatementImport {
  id: string;
  account_id: string;
  status: StatementImportStatus;
  file_format: StatementFileFormat;
  period: { start: string | null; end: string | null };
  bank_balances: { date: string; balance: number; currency: string | null }[];
  entries: StatementEntry[];
  groups: StatementGroup[];
  summary: StatementImportSummary;
  can_conclude: boolean;
  blockers: { code: ConcludeBlockerCode; count: number }[];
  created_at: string;
  concluded_at: string | null;
  /** Quando a importação foi desfeita (`status: 'undone'`, fincla-api#509). */
  undone_at: string | null;
  /** Última alteração do rascunho (resposta ou passo) — fincla-api#518. */
  last_activity_at: string;
  /** Rascunho parado até aqui é apagado (30 dias sem alteração); `null` fora de rascunho. */
  expires_at: string | null;
  /** Onde a revisão parou; `null` = nunca gravado. */
  current_step: ReconciliationStep | null;
  /** Passos pelos quais a pessoa já passou, na ordem dos passos. */
  reviewed_steps: ReconciliationStep[];
  account_check: AccountCheck;
  /** Concluída e a mais recente da conta: a única que pode ser desfeita (fincla-api#509). */
  latest_concluded: boolean;
  /** O mesmo arquivo já foi importado (fincla-api#516). */
  file_check: FileCheck;
  /** Desde quando o extrato conta para o saldo; `null` = nada fica fora por data. */
  left_out: LeftOutFloor | null;
}

/** A resposta do desfazer: a importação desfeita e quantas transações ele de fato apagou. */
export interface UndoneStatementImport extends StatementImport {
  deleted_transactions: number;
}

/** Uma linha de "Extratos importados" (fincla-api#518): a importação sem os lançamentos. */
export interface StatementImportListItem {
  id: string;
  account_id: string;
  status: StatementImportStatus;
  file_format: StatementFileFormat;
  period: { start: string | null; end: string | null };
  summary: StatementImportSummary;
  /** Diferença registrada ao concluir. `null` = não registrada: nunca vira zero. */
  final_difference: number | null;
  final_difference_currency: string | null;
  created_at: string;
  last_activity_at: string;
  expires_at: string | null;
  concluded_at: string | null;
  undone_at: string | null;
  /** A concluída mais recente da conta: a única que pode ser desfeita. */
  latest_concluded: boolean;
}

export interface UpdateStatementEntryRequest {
  /**
   * Sim, é esta (`pair`) / Não, adicionar agora (`create`) / Não registrar (`ignore`); `null` volta
   * a "sem resposta" (o "Desfazer lá" de uma dúvida, fincla-api#511).
   */
  answer?: 'pair' | 'create' | 'ignore' | null;
  /** Com `pair`: qual transação (uma candidata ou achada na busca). */
  paired_transaction_id?: number | null;
  /** Com `pair`: qual transferência. */
  paired_transfer_id?: string | null;
  /** Responder marca `true`; "Desfazer escolha" devolve o anterior. */
  confirmed?: boolean;
  description?: string;
  transaction_type?: StatementTransactionType;
  payment_method?: StatementPaymentMethod;
  category_tag_id?: string | null;
  detail_tag_ids?: string[];
}

export interface UpdateStatementGroupRequest {
  description?: string;
  transaction_type?: StatementTransactionType;
  payment_method?: StatementPaymentMethod;
  category_tag_id?: string | null;
  detail_tag_ids?: string[];
}

type RawFinclaTransaction = Omit<FinclaTransaction, 'value' | 'currency'> & { value: WireMoney };
type RawFinclaMatch = Omit<FinclaMatch, 'value' | 'currency'> & { value: WireMoney };
type RawEntry = Omit<StatementEntry, 'amount' | 'currency' | 'fincla_transaction' | 'fincla_match' | 'candidates'> & {
  amount: WireMoney;
  fincla_transaction?: RawFinclaTransaction | null;
  fincla_match?: RawFinclaMatch | null;
  candidates?: RawFinclaMatch[];
};

export const normalizeFinclaMatch = (raw: RawFinclaMatch): FinclaMatch => ({
  ...raw,
  value: toAmount(raw.value),
  currency: toCurrency(raw.value),
  differences: raw.differences ?? [],
  taken_by_entry_id: raw.taken_by_entry_id ?? null,
});
type RawGroup = Omit<StatementGroup, 'amount' | 'currency'> & { amount: WireMoney };
type RawImport = Omit<StatementImport, 'entries' | 'bank_balances' | 'groups'> & {
  entries: RawEntry[];
  groups?: RawGroup[];
  bank_balances: { date: string; balance: WireMoney }[];
};

export const normalizeStatementEntry = ({ fincla_transaction, fincla_match, candidates, ...raw }: RawEntry): StatementEntry => ({
  ...raw,
  suggested_transfer_id: raw.suggested_transfer_id ?? null,
  paired_transfer_id: raw.paired_transfer_id ?? null,
  fincla_match: fincla_match ? normalizeFinclaMatch(fincla_match) : null,
  candidates: (candidates ?? []).map(normalizeFinclaMatch),
  amount: toAmount(raw.amount),
  currency: toCurrency(raw.amount),
  suggested_transaction_id: raw.suggested_transaction_id ?? null,
  paired_transaction_id: raw.paired_transaction_id ?? null,
  confirmed: Boolean(raw.confirmed),
  fincla_transaction: fincla_transaction
    ? {
        ...fincla_transaction,
        value: toAmount(fincla_transaction.value),
        currency: toCurrency(fincla_transaction.value),
        differences: fincla_transaction.differences ?? [],
      }
    : null,
});

export const normalizeStatementImport = (raw: RawImport): StatementImport => ({
  ...raw,
  entries: (raw.entries ?? []).map(normalizeStatementEntry),
  groups: (raw.groups ?? []).map((g) => ({ ...g, amount: toAmount(g.amount), currency: toCurrency(g.amount) })),
  bank_balances: (raw.bank_balances ?? []).map((b) => ({
    date: b.date,
    balance: toAmount(b.balance),
    currency: toCurrency(b.balance),
  })),
});

type RawListItem = Omit<StatementImportListItem, 'final_difference' | 'final_difference_currency'> & {
  final_difference: WireMoney;
};

export const normalizeStatementImportListItem = ({ final_difference, ...raw }: RawListItem): StatementImportListItem => ({
  ...raw,
  final_difference: final_difference == null ? null : toFiniteNumber(final_difference),
  final_difference_currency: toCurrency(final_difference),
});

const base = (accountId: string) => `/accounts/${accountId}/statement-imports`;

/**
 * Envia o extrato (OFX, XLS, XLSX ou CSV) e cria o rascunho. Nada muda no Fincla até concluir.
 * Planilha não reconhecida: falha com 422 e a prévia (ver `columnMappingPreviewOf`); reenvie o mesmo
 * arquivo com `columnMapping`.
 */
export const uploadStatement = async (
  accountId: string,
  organizationId: string,
  file: File,
  columnMapping: ColumnMapping | null = null,
): Promise<StatementImport> => {
  const form = new FormData();
  form.append('file', file);
  if (columnMapping) form.append('column_mapping', JSON.stringify(columnMapping));
  const response = await apiClient.post<RawImport>(base(accountId), form, {
    params: { organization_id: organizationId },
    // O cliente nasce com `application/json`: sem trocar, o axios serializa o FormData em JSON.
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeStatementImport(response.data);
};

/**
 * O rascunho em andamento do mesmo arquivo nesta conta, quando o envio foi recusado por isso
 * (409 `draft_in_progress`, fincla-api#516); senão `null`.
 */
export const draftInProgressOf = (error: unknown): { importId: string; message: string } | null => {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail as { reason?: string; import_id?: string; message?: string } | undefined;
  if (response?.status !== 409 || detail?.reason !== 'draft_in_progress' || !detail.import_id) return null;
  return { importId: detail.import_id, message: detail.message ?? '' };
};

/** A prévia de "indique as colunas" quando o envio falhou por planilha não reconhecida; senão `null`. */
export const columnMappingPreviewOf = (error: unknown): SheetPreview | null => {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail as { reason?: string; preview?: SheetPreview } | undefined;
  if (response?.status !== 422 || detail?.reason !== 'column_mapping_required' || !detail.preview) return null;
  return detail.preview;
};

export const getStatementImport = async (
  accountId: string,
  organizationId: string,
  importId: string,
): Promise<StatementImport> => {
  const response = await apiClient.get<RawImport>(`${base(accountId)}/${importId}`, {
    params: { organization_id: organizationId },
  });
  return normalizeStatementImport(response.data);
};

/** Muda a transação nova que o lançamento vai virar. Só os campos enviados mudam. */
export const updateStatementEntry = async (
  accountId: string,
  organizationId: string,
  importId: string,
  entryId: string,
  body: UpdateStatementEntryRequest,
): Promise<StatementEntry> => {
  const response = await apiClient.patch<RawEntry>(`${base(accountId)}/${importId}/entries/${entryId}`, body, {
    params: { organization_id: organizationId },
  });
  return normalizeStatementEntry(response.data);
};

/**
 * "Está no Fincla com outros dados…" (fincla-api#511): procura o par em todas as contas ativas da
 * mesma moeda. `query` é UMA coisa: texto, valor (47,20) ou dia (09/10). Não muda nada.
 */
export const searchFinclaForEntry = async (
  accountId: string,
  organizationId: string,
  importId: string,
  entryId: string,
  query = '',
): Promise<FinclaMatch[]> => {
  const params: Record<string, string> = { organization_id: organizationId };
  if (query.trim()) params.q = query.trim();
  const response = await apiClient.get<{ results: RawFinclaMatch[] }>(
    `${base(accountId)}/${importId}/entries/${entryId}/search`,
    { params },
  );
  return (response.data.results ?? []).map(normalizeFinclaMatch);
};

/** Lote (tudo ou nada): várias mudanças de uma vez. Desfazer = outro lote com o que havia antes. */
export const updateStatementEntries = async (
  accountId: string,
  organizationId: string,
  importId: string,
  entries: (UpdateStatementEntryRequest & { id: string })[],
): Promise<StatementImport> => {
  const response = await apiClient.patch<RawImport>(`${base(accountId)}/${importId}/entries`, { entries }, {
    params: { organization_id: organizationId },
  });
  return normalizeStatementImport(response.data);
};

/** Somar em um só lançamento: mesmo sentido e mesmo mês; descrição obrigatória. */
export const createStatementGroup = async (
  accountId: string,
  organizationId: string,
  importId: string,
  entryIds: string[],
  description: string,
): Promise<StatementImport> => {
  const response = await apiClient.post<RawImport>(
    `${base(accountId)}/${importId}/groups`,
    { entry_ids: entryIds, description },
    { params: { organization_id: organizationId } },
  );
  return normalizeStatementImport(response.data);
};

export const updateStatementGroup = async (
  accountId: string,
  organizationId: string,
  importId: string,
  groupId: string,
  body: UpdateStatementGroupRequest,
): Promise<StatementImport> => {
  const response = await apiClient.patch<RawImport>(`${base(accountId)}/${importId}/groups/${groupId}`, body, {
    params: { organization_id: organizationId },
  });
  return normalizeStatementImport(response.data);
};

/** Desfazer soma: os lançamentos voltam a ser adicionados um por um. */
export const deleteStatementGroup = async (
  accountId: string,
  organizationId: string,
  importId: string,
  groupId: string,
): Promise<StatementImport> => {
  const response = await apiClient.delete<RawImport>(`${base(accountId)}/${importId}/groups/${groupId}`, {
    params: { organization_id: organizationId },
  });
  return normalizeStatementImport(response.data);
};

/**
 * "Confirmar os N de uma vez" (`confirmed: true`) e o desfazer dele (`confirmed: false`), tudo ou
 * nada. Só lançamentos respondidos "Sim, é esta" podem ser confirmados (fincla-api#510).
 */
export const confirmStatementSuggestions = async (
  accountId: string,
  organizationId: string,
  importId: string,
  entryIds: string[],
  confirmed = true,
): Promise<StatementImport> => {
  const response = await apiClient.post<RawImport>(
    `${base(accountId)}/${importId}/suggestions/confirm`,
    { entry_ids: entryIds, confirmed },
    { params: { organization_id: organizationId } },
  );
  return normalizeStatementImport(response.data);
};

/** Aplica todas as respostas de uma vez (tudo ou nada). */
export const concludeStatementImport = async (
  accountId: string,
  organizationId: string,
  importId: string,
): Promise<StatementImport> => {
  const response = await apiClient.post<RawImport>(`${base(accountId)}/${importId}/conclude`, null, {
    params: { organization_id: organizationId },
  });
  return normalizeStatementImport(response.data);
};

// --------------------------------------------------------------------------------------------
// Desfazer importação (fincla-api#509)
// --------------------------------------------------------------------------------------------

export type UndoRefusalCode =
  | 'not_concluded'
  | 'already_undone'
  | 'not_latest'
  | 'linked_to_goal'
  | 'on_paid_invoice'
  | 'in_recurring_series'
  | 'unsupported_change';
export type UndoChangedField =
  | 'description' | 'value' | 'type' | 'date' | 'status' | 'paid_at' | 'account' | 'payment_method' | 'tags' | 'credit_card';

export interface UndoDeletedTransaction {
  transaction_id: number;
  /** Como está hoje (com as edições feitas depois da conclusão). */
  description: string;
  date: string;
  type: StatementTransactionType;
  /** Valor de hoje, sem sinal. */
  amount: number;
  currency: string | null;
  edited_after: boolean;
  changed_fields: UndoChangedField[];
}

export interface UndoRestoredEntity {
  entity_type: 'transaction';
  entity_id: string;
  action: 'updated' | 'deleted';
  /** Como está hoje (`updated`) ou como era antes (`deleted`). */
  description: string;
  /** A pessoa mudou a transação depois de concluir; as edições dela ficam (aviso, não recusa). */
  edited_after: boolean;
  changed_fields: UndoChangedField[];
  /** Do que a conciliação mudou, o que a pessoa mudou de novo depois: fica o valor dela. */
  kept_fields: UndoChangedField[];
  /** O valor que volta (a conciliação pôs o do banco), fincla-api#511; `null` se não muda. */
  value_back: number | null;
  value_back_currency: string | null;
  /** A conta para onde a transação volta (a conciliação a moveu); `null` se não muda. */
  account_back: { id: string; name: string | null } | null;
}

export interface StatementUndoPreview {
  import_id: string;
  can_undo: boolean;
  /** Por que não dá para desfazer agora (mensagem PT-BR pronta); `null` quando dá. */
  refusal: { code: UndoRefusalCode; message: string } | null;
  summary: { to_delete: number; edited_after: number; already_deleted: number; to_restore: number };
  transactions_to_delete: UndoDeletedTransaction[];
  to_restore: UndoRestoredEntity[];
}

type RawRestored = Omit<UndoRestoredEntity, 'value_back' | 'value_back_currency' | 'account_back'> & {
  value_back?: WireMoney | null;
  account_back?: { id: string; name: string | null } | null;
};
type RawUndoPreview = Omit<StatementUndoPreview, 'transactions_to_delete' | 'to_restore'> & {
  transactions_to_delete: (Omit<UndoDeletedTransaction, 'amount' | 'currency'> & { amount: WireMoney })[];
  to_restore?: RawRestored[];
};

export const normalizeStatementUndoPreview = (raw: RawUndoPreview): StatementUndoPreview => ({
  ...raw,
  transactions_to_delete: (raw.transactions_to_delete ?? []).map((t) => ({
    ...t,
    amount: toAmount(t.amount),
    currency: toCurrency(t.amount),
  })),
  to_restore: (raw.to_restore ?? []).map(({ value_back, account_back, ...r }) => ({
    ...r,
    value_back: value_back == null ? null : toAmount(value_back),
    value_back_currency: value_back == null ? null : toCurrency(value_back),
    account_back: account_back ?? null,
  })),
});

/** O que desfazer a importação vai fazer agora (e o motivo, se não der). Não muda nada. */
export const previewStatementImportUndo = async (
  accountId: string,
  organizationId: string,
  importId: string,
): Promise<StatementUndoPreview> => {
  const response = await apiClient.get<RawUndoPreview>(`${base(accountId)}/${importId}/undo-preview`, {
    params: { organization_id: organizationId },
  });
  return normalizeStatementUndoPreview(response.data);
};

/** Desfaz a importação concluída mais recente da conta (tudo ou nada). */
export const undoStatementImport = async (
  accountId: string,
  organizationId: string,
  importId: string,
): Promise<UndoneStatementImport> => {
  const response = await apiClient.post<RawImport & { deleted_transactions: number }>(
    `${base(accountId)}/${importId}/undo`,
    null,
    { params: { organization_id: organizationId } },
  );
  return { ...normalizeStatementImport(response.data), deleted_transactions: response.data.deleted_transactions };
};

// --------------------------------------------------------------------------------------------
// Rascunho e histórico (fincla-api#518)
// --------------------------------------------------------------------------------------------

/** Extratos importados da conta (rascunho, concluída, desfeita), do mais novo para o mais antigo. */
export const listStatementImports = async (
  accountId: string,
  organizationId: string,
): Promise<StatementImportListItem[]> => {
  const response = await apiClient.get<{ imports: RawListItem[] }>(base(accountId), {
    params: { organization_id: organizationId },
  });
  return (response.data.imports ?? []).map(normalizeStatementImportListItem);
};

/** Conciliações em andamento da organização, em todas as contas. */
export const listStatementImportDrafts = async (organizationId: string): Promise<StatementImportListItem[]> => {
  const response = await apiClient.get<{ imports: RawListItem[] }>('/statement-imports/drafts', {
    params: { organization_id: organizationId },
  });
  return (response.data.imports ?? []).map(normalizeStatementImportListItem);
};

/** Grava onde a revisão parou (passo aberto e passos já vistos). Só os campos enviados mudam. */
export const updateStatementImportProgress = async (
  accountId: string,
  organizationId: string,
  importId: string,
  body: { current_step?: ReconciliationStep | null; reviewed_steps?: ReconciliationStep[] },
): Promise<StatementImport> => {
  const response = await apiClient.patch<RawImport>(`${base(accountId)}/${importId}`, body, {
    params: { organization_id: organizationId },
  });
  return normalizeStatementImport(response.data);
};

/** Descarta o rascunho e todas as respostas dele. Nada no Fincla muda. */
export const discardStatementImport = async (
  accountId: string,
  organizationId: string,
  importId: string,
): Promise<void> => {
  await apiClient.delete(`${base(accountId)}/${importId}`, { params: { organization_id: organizationId } });
};
