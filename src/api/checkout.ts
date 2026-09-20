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

export interface CheckoutAttempt {
  has_access: boolean;
  id: string;
  status: 'preparing' | 'processing' | 'reconciling' | 'pending_payment' | 'declined' | 'active' | 'cancelled';
  quote: CheckoutQuote;
}

export class CheckoutRequestError extends Error {
  constructor(message: string, public code: string | undefined, public fields: string[] = []) { super(message); }
}

async function checkoutRequest<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/checkout/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new CheckoutRequestError(payload?.detail?.message || 'Não foi possível continuar. Confira os dados e tente novamente.', payload?.detail?.code, Array.isArray(payload?.detail?.fields) ? payload.detail.fields : []);
    return payload;
  } finally { window.clearTimeout(timeout); }
}

export const registerCheckout = (body: { selection?: CheckoutQuote['selection']; persona?: 'personal' | 'consultant'; email: string; password: string; first_name: string; cpf_cnpj: string; phone: string; billing_cycle: string }) => checkoutRequest('register', body);
export const currentCheckout = () => checkoutRequest<CheckoutAttempt | null>('current');
/** Never retry a financial POST; the server reconciles uncertain outcomes. */
export const payCheckout = (body: unknown) => checkoutRequest<CheckoutAttempt>('pay', body);
export const requestWithdrawal = () => checkoutRequest<{ id: string; requested_at: string; status: "received" }>('withdrawal', {});
