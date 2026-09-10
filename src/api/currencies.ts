// api/currencies.ts — o registro de moedas (fincla-api GET /v1/currencies).
//
// É a autoridade sobre QUE moedas o Fincla oferece e como cada uma se escreve.
// Sem ele o app só sabe desenhar real: `Intl.NumberFormat` conhece toda moeda ISO,
// mas ninguém pergunta a ele quais o produto suporta.
import apiClient from './client';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
}

interface CurrencyListResponse {
  currencies: Currency[];
}

/**
 * Todas as moedas do registro, **ativas e inativas**.
 *
 * O backend não filtra de propósito, e este cliente também não: uma conta criada
 * quando o euro estava ativo continua em euro se o euro for desativado, e o saldo
 * dela continua sendo desenhado. Quem oferece uma escolha filtra por `is_active`;
 * quem formata um valor, não.
 */
export const listCurrencies = async (): Promise<Currency[]> => {
  const response = await apiClient.get<CurrencyListResponse>('/currencies');
  return Array.isArray(response.data?.currencies) ? response.data.currencies : [];
};
