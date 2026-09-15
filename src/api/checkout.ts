import { API_CONFIG } from './config';

export interface CheckoutQuote {
  catalog_version: string;
  selection: {
    persona: 'personal' | 'consultant';
    billing_cycle: 'monthly' | 'yearly';
    mode: 'progressive' | 'package' | null;
    seats: number | null;
    package_size: number | null;
  };
  total_cents: number;
  capacity: number | null;
  currency: 'BRL';
}

/** Only selection fields leave the browser; the server owns all pricing. */
export async function quoteCheckout(search: string, signal: AbortSignal): Promise<CheckoutQuote> {
  const params = new URLSearchParams(search);
  const selection: Record<string, string | number | null> = {
    persona: params.get('persona'),
    billing_cycle: params.get('billing_cycle'),
  };
  for (const key of ['mode', 'seats', 'package_size']) {
    if (params.has(key)) selection[key] = key === 'mode' ? params.get(key) : Number(params.get(key));
  }
  const response = await fetch(`${API_CONFIG.BASE_URL}/plans/checkout-quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(selection),
    signal,
  });
  if (!response.ok) throw new Error(response.status === 400 || response.status === 422
    ? 'A seleção de plano é inválida. Volte ao site e escolha sua oferta.'
    : 'Não foi possível consultar sua oferta. Tente novamente.');
  return response.json();
}
