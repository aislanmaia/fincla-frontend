// api/statementImports.ts — Conciliar extrato (fincla-api#507/#508).
//
// O recurso vive aninhado na conta: `/accounts/{accountId}/statement-imports`. A forma da
// resposta é a de `src/api/__fixtures__/statement_import.example.json`, cópia byte a byte da
// fixture canônica do backend (presa aos modelos Pydantic por um teste de lá).
import apiClient from './client';
import { toAmount, toCurrency, type WireMoney } from './money';

export type StatementEntryAnswer = 'pair' | 'create' | 'ignore' | 'group' | 'invoice_payment';
export type StatementTransactionType = 'income' | 'expense' | 'refund';
/** Só o que passa por conta corrente: compra no cartão de crédito sai na fatura, não no extrato. */
export type StatementPaymentMethod = 'pix' | 'boleto' | 'debit_card' | 'bank_transfer' | 'cash';
export type ConcludeBlockerCode = 'unanswered' | 'missing_description';

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
  classification: 'new';
  answer: StatementEntryAnswer | null;
  description: string | null;
  transaction_type: StatementTransactionType | null;
  /** Sugerida pelo prefixo do texto do banco (`PIX …`, `PAG BOLETO …`, `RSHOP …`); editável. */
  payment_method: StatementPaymentMethod | null;
  /** `null` = vai para Não classificado ao concluir. */
  category_tag_id: string | null;
  created_transaction_id: number | null;
}

export interface StatementImport {
  id: string;
  account_id: string;
  status: 'draft' | 'concluded' | 'undone' | 'discarded';
  file_format: 'ofx';
  period: { start: string | null; end: string | null };
  bank_balances: { date: string; balance: number; currency: string | null }[];
  entries: StatementEntry[];
  /** `ignored`: não viram transação (hoje só lançamentos de valor zero). */
  summary: { total: number; to_create: number; missing_description: number; unanswered: number; ignored: number };
  can_conclude: boolean;
  blockers: { code: ConcludeBlockerCode; count: number }[];
  created_at: string;
  concluded_at: string | null;
}

export interface UpdateStatementEntryRequest {
  description?: string;
  transaction_type?: StatementTransactionType;
  payment_method?: StatementPaymentMethod;
  category_tag_id?: string | null;
}

type RawEntry = Omit<StatementEntry, 'amount' | 'currency'> & { amount: WireMoney };
type RawImport = Omit<StatementImport, 'entries' | 'bank_balances'> & {
  entries: RawEntry[];
  bank_balances: { date: string; balance: WireMoney }[];
};

export const normalizeStatementEntry = (raw: RawEntry): StatementEntry => ({
  ...raw,
  amount: toAmount(raw.amount),
  currency: toCurrency(raw.amount),
});

export const normalizeStatementImport = (raw: RawImport): StatementImport => ({
  ...raw,
  entries: (raw.entries ?? []).map(normalizeStatementEntry),
  bank_balances: (raw.bank_balances ?? []).map((b) => ({
    date: b.date,
    balance: toAmount(b.balance),
    currency: toCurrency(b.balance),
  })),
});

const base = (accountId: string) => `/accounts/${accountId}/statement-imports`;

/** Envia o extrato (OFX) e cria o rascunho. Nada muda no Fincla até concluir. */
export const uploadStatement = async (
  accountId: string,
  organizationId: string,
  file: File,
): Promise<StatementImport> => {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post<RawImport>(base(accountId), form, {
    params: { organization_id: organizationId },
    // O cliente nasce com `application/json`: sem trocar, o axios serializa o FormData em JSON.
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeStatementImport(response.data);
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
