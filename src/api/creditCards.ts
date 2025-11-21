// api/creditCards.ts
import apiClient from './client';
import { CreateCreditCardRequest, CreditCard, InvoiceResponse } from '../types/api';

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
  return response.data;
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
  return response.data;
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
  return response.data;
};


