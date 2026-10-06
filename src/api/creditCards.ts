// api/creditCards.ts
//
// Limite, uso e compromissos chegam na forma canônica (fincla-api#132/#133).
// `unwrapMoney` desembrulha em qualquer profundidade — enumerar campo a campo é
// onde se esquece um, e um esquecido vira "R$ NaN" na tela.
import apiClient from './client';
import { toCurrency, unwrapMoney } from './money';
import type {
  CreateCreditCardRequest,
  UpdateCreditCardRequest,
  CreditCard,
  InvoiceResponse,
  InvoiceHistoryResponse,
  InvoiceMarkPaidResponse,
  MarkInvoicePaidRequest,
  MoveInstallmentRequest,
  MoveInstallmentResponse,
  FutureCommitmentsResponse,
  ConsolidatedCommitmentsResponse,
} from './types';

/**
 * Lista todos os cartões de crédito de uma organização
 */
export const listCreditCards = async (
  organizationId: string
): Promise<CreditCard[]> => {
  const response = await apiClient.get<CreditCard[]>(
    '/credit-cards',
    {
      params: { organization_id: organizationId },
    }
  );
  return unwrapMoney(response.data);
};

/**
 * Obtém um cartão de crédito específico
 */
export const getCreditCard = async (
  cardId: number,
  organizationId: string
): Promise<CreditCard> => {
  const response = await apiClient.get<CreditCard>(
    `/credit-cards/${cardId}`,
    {
      params: { organization_id: organizationId },
    }
  );
  return unwrapMoney(response.data);
};

/**
 * Cria um novo cartão de crédito
 */
export const createCreditCard = async (
  card: CreateCreditCardRequest
): Promise<CreditCard> => {
  const response = await apiClient.post<CreditCard>(
    '/credit-cards',
    card
  );
  return unwrapMoney(response.data);
};

/**
 * Atualiza um cartão de crédito existente
 */
export const updateCreditCard = async (
  cardId: number,
  data: UpdateCreditCardRequest
): Promise<CreditCard> => {
  const { organization_id, ...updates } = data;
  const response = await apiClient.patch<CreditCard>(
    `/credit-cards/${cardId}`,
    updates,
    {
      params: { organization_id },
    }
  );
  return unwrapMoney(response.data);
};

/**
 * Deleta um cartão de crédito
 */
export const deleteCreditCard = async (
  cardId: number,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/credit-cards/${cardId}`, {
    params: { organization_id: organizationId },
  });
};

/**
 * Obtém a fatura de um cartão de crédito para um mês específico
 */
export const getCreditCardInvoice = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string
): Promise<InvoiceResponse> => {
  const response = await apiClient.get<InvoiceResponse>(
    `/credit-cards/${cardId}/invoices/${year}/${month}`,
    {
      params: { organization_id: organizationId },
    }
  );
  return unwrapMoney(response.data);
};

/**
 * Fatura em aberto do cartão (a que ainda aceita lançamentos), sem informar ano e mês.
 * `404` também significa "a fatura aberta ainda não tem lançamentos": quem chama decide.
 */
export const getCurrentCreditCardInvoice = async (
  cardId: number,
  organizationId: string
): Promise<InvoiceResponse> => {
  const response = await apiClient.get<InvoiceResponse>(
    `/credit-cards/${cardId}/invoices/current`,
    {
      params: { organization_id: organizationId },
    }
  );
  return unwrapMoney(response.data);
};

/**
 * Obtém o histórico de faturas de um cartão
 */
export const getInvoiceHistory = async (
  cardId: number,
  organizationId: string,
  months: number = 6,
  includeCategorySeries: boolean = false,
  includeCommitments: boolean = false
): Promise<InvoiceHistoryResponse> => {
  const response = await apiClient.get<InvoiceHistoryResponse>(
    `/credit-cards/${cardId}/invoices/history`,
    {
      params: { organization_id: organizationId, months, ...(includeCategorySeries ? { include_category_series: true } : {}), ...(includeCommitments ? { include_commitments: true } : {}) },
    }
  );
  const data = includeCommitments
    ? { ...response.data, monthly_data: response.data.monthly_data.map((row) => ({
      ...row,
      total_amount_currency: toCurrency(row.total_amount),
      installments_amount_currency: toCurrency(row.installments_amount),
      recurrences_amount_currency: toCurrency(row.recurrences_amount),
      commitments_category_breakdown: row.commitments_category_breakdown?.map((category) => ({
        ...category,
        installments_amount_currency: toCurrency(category.installments_amount),
        recurrences_amount_currency: toCurrency(category.recurrences_amount),
      })),
    })) }
    : response.data;
  return unwrapMoney(data);
};

/**
 * Marca uma fatura como paga
 */
export const markInvoicePaid = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string,
  paidDate?: string
): Promise<InvoiceMarkPaidResponse> => {
  const body: MarkInvoicePaidRequest = paidDate ? { paid_date: paidDate } : {};
  const response = await apiClient.patch<InvoiceMarkPaidResponse>(
    `/credit-cards/${cardId}/invoices/${year}/${month}/mark-paid`,
    body,
    { params: { organization_id: organizationId } }
  );
  return unwrapMoney(response.data);
};

/**
 * Desfaz a marcação de pagamento de uma fatura
 */
export const unmarkInvoicePaid = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string
): Promise<InvoiceMarkPaidResponse> => {
  const response = await apiClient.patch<InvoiceMarkPaidResponse>(
    `/credit-cards/${cardId}/invoices/${year}/${month}/unmark-paid`,
    {},
    { params: { organization_id: organizationId } }
  );
  return unwrapMoney(response.data);
};

/**
 * Move uma parcela (transação) para uma fatura diferente (mês/ano).
 * Modelo occurrence-based: a parcela é uma transação; as demais parcelas da
 * mesma compra (série) são reposicionadas automaticamente em torno da âncora.
 */
export const moveInstallmentToInvoice = async (
  cardId: number,
  transactionId: number,
  organizationId: string,
  target: MoveInstallmentRequest
): Promise<MoveInstallmentResponse> => {
  const response = await apiClient.patch<MoveInstallmentResponse>(
    `/credit-cards/${cardId}/installments/${transactionId}/move-invoice`,
    target,
    {
      params: { organization_id: organizationId },
    }
  );

  return unwrapMoney(response.data);
};

/**
 * Retorna uma visão consolidada dos compromissos futuros de um cartão específico
 */
export const getFutureCommitments = async (
  cardId: number,
  organizationId: string,
  months: number = 6,
  includeInventory: boolean = false,
  includeRemaining: boolean = false
): Promise<FutureCommitmentsResponse> => {
  const response = await apiClient.get<FutureCommitmentsResponse>(
    `/credit-cards/${cardId}/future-commitments`,
    {
      params: { organization_id: organizationId, months, ...(includeInventory ? { include_inventory: true } : {}), ...(includeRemaining ? { include_remaining: true } : {}) },
    }
  );
  const data = includeInventory || includeRemaining ? {
    ...response.data,
    monthly_breakdown: includeInventory ? response.data.monthly_breakdown.map((row) => ({
      ...row,
      installments: row.installments?.map((item) => ({ ...item, amount_currency: toCurrency(item.amount) })),
      recurrences: row.recurrences?.map((item) => ({ ...item, amount_currency: toCurrency(item.amount) })),
    })) : response.data.monthly_breakdown,
    remaining_balance: includeRemaining && response.data.remaining_balance ? {
      ...response.data.remaining_balance,
      gross_amount_currency: toCurrency(response.data.remaining_balance.gross_amount),
      linked_refunds_amount_currency: toCurrency(response.data.remaining_balance.linked_refunds_amount),
      net_amount_currency: toCurrency(response.data.remaining_balance.net_amount),
      series: response.data.remaining_balance.series.map((item) => ({
        ...item,
        remaining_amount_currency: toCurrency(item.remaining_amount),
        linked_refunds_amount_currency: toCurrency(item.linked_refunds_amount),
        next_amount_currency: toCurrency(item.next_amount),
      })),
    } : response.data.remaining_balance,
  } : response.data;
  return unwrapMoney(data);
};

/**
 * Retorna uma visão consolidada de TODOS os cartões da organização
 */
export const getConsolidatedCommitments = async (
  organizationId: string,
  months: number = 6
): Promise<ConsolidatedCommitmentsResponse> => {
  const response = await apiClient.get<ConsolidatedCommitmentsResponse>(
    '/credit-cards/consolidated-commitments',
    {
      params: { organization_id: organizationId, months },
    }
  );
  return unwrapMoney(response.data);
};
