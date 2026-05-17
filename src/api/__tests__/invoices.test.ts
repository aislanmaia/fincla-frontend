import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { getInvoice, listInvoices } from '../invoices';

vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('invoices API client', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('listInvoices sem params usa default do backend', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { items: [], limit: 20, offset: 0 },
    });
    await listInvoices();
    expect(apiClient.get).toHaveBeenCalledWith('/invoices', { params: {} });
  });

  it('listInvoices repassa limit e offset', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { items: [], limit: 5, offset: 10 },
    });
    await listInvoices({ limit: 5, offset: 10 });
    expect(apiClient.get).toHaveBeenCalledWith('/invoices', {
      params: { limit: 5, offset: 10 },
    });
  });

  it('getInvoice chama /invoices/:id', async () => {
    const invoice = {
      id: 'inv_1',
      amount_cents: 3990,
      currency: 'BRL',
      status: 'paid' as const,
      due_date: '2026-06-01',
      paid_at: '2026-06-02T00:00:00',
      payment_method: 'pix' as const,
      invoice_url: null,
      pdf_url: null,
      description: 'Fatura junho',
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: invoice });
    const got = await getInvoice('inv_1');
    expect(got.id).toBe('inv_1');
    expect(apiClient.get).toHaveBeenCalledWith('/invoices/inv_1');
  });
});
