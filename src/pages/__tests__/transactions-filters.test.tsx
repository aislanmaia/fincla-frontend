import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import TransactionsPage from '../transactions';
import { wrapper } from '@/test/utils/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startOfMonth, endOfMonth, format } from 'date-fns';

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: vi.fn(() => ({
    activeOrgId: 'org-123',
    organizations: [],
    selectOrganization: vi.fn(),
  })),
}));

vi.mock('@/hooks/useDateRange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useDateRange')>();
  const { startOfMonth: sm, endOfMonth: em } = await import('date-fns');
  const range = { from: sm(new Date()), to: em(new Date()) };
  return {
    ...actual,
    useDateRange: vi.fn(() => ({
      dateRange: range,
      setDateRange: vi.fn(),
      setPreset: vi.fn(),
      clearRange: vi.fn(),
    })),
  };
});

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: vi.fn((value: string) => value),
}));

const mockTransactionsResponse = {
  data: [
    {
      id: 1,
      organization_id: 'org-123',
      type: 'expense',
      description: 'Test expense',
      category: 'Alimentação',
      value: 50.0,
      payment_method: 'PIX',
      date: '2024-01-15T10:00:00',
      created_at: '2024-01-15T10:00:00',
      updated_at: '2024-01-15T10:00:00',
      tags: { categoria: [{ id: 'tag-123', name: 'Alimentação', type: 'categoria', color: '#FF5733', is_default: true, is_active: true, organization_id: 'org-123' }] },
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, pages: 1, has_next: false, has_prev: false },
};

function createWrapper() {
  return ({ children }: { children: React.ReactNode }) => wrapper({ children });
}

describe('TransactionsPage - filtros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chama GET /transactions com organization_id e date_start/date_end ao carregar', async () => {
    const capturedParams: Record<string, string>[] = [];
    const range = { from: startOfMonth(new Date()), to: endOfMonth(new Date()) };
    server.use(
      http.get('*/v1/transactions', ({ request }) => {
        const url = new URL(request.url);
        capturedParams.push({
          organization_id: url.searchParams.get('organization_id') ?? '',
          date_start: url.searchParams.get('date_start') ?? '',
          date_end: url.searchParams.get('date_end') ?? '',
        });
        return HttpResponse.json(mockTransactionsResponse);
      })
    );

    render(<TransactionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(capturedParams.length).toBeGreaterThan(0);
      expect(capturedParams[0].organization_id).toBe('org-123');
      expect(capturedParams[0].date_start).toBe(format(range.from, 'yyyy-MM-dd'));
      expect(capturedParams[0].date_end).toBe(format(range.to, 'yyyy-MM-dd'));
    });
  });

  it('chama GET /transactions com description ao digitar na busca', async () => {
    const capturedParams: Record<string, string>[] = [];
    server.use(
      http.get('*/v1/transactions', ({ request }) => {
        const url = new URL(request.url);
        capturedParams.push({ description: url.searchParams.get('description') ?? '' });
        return HttpResponse.json(mockTransactionsResponse);
      })
    );

    render(<TransactionsPage />, { wrapper: createWrapper() });
    const searchInput = await screen.findByPlaceholderText(/por descrição/i);
    await userEvent.type(searchInput, 'mercado');

    await waitFor(
      () => {
        const withDesc = capturedParams.find((p) => p.description === 'mercado');
        expect(withDesc).toBeDefined();
      },
      { timeout: 1000 }
    );
  });

  it('chama GET /transactions com page e limit na requisição inicial', async () => {
    const capturedParams: Record<string, string>[] = [];
    server.use(
      http.get('*/v1/transactions', ({ request }) => {
        const url = new URL(request.url);
        capturedParams.push({
          page: url.searchParams.get('page') ?? '',
          limit: url.searchParams.get('limit') ?? '',
        });
        return HttpResponse.json(mockTransactionsResponse);
      })
    );

    render(<TransactionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(capturedParams.length).toBeGreaterThan(0);
      expect(capturedParams[0].page).toBe('1');
      expect(capturedParams[0].limit).toBe('20');
    });
  });

  it('chama GET /transactions com page=2 ao navegar para próxima página', async () => {
    const capturedParams: Record<string, string>[] = [];
    server.use(
      http.get('*/v1/transactions', ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get('page') ?? '1';
        capturedParams.push({ page });
        return HttpResponse.json({
          ...mockTransactionsResponse,
          pagination: {
            page: parseInt(page, 10),
            limit: 20,
            total: 50,
            pages: 3,
            has_next: parseInt(page, 10) < 3,
            has_prev: parseInt(page, 10) > 1,
          },
        });
      })
    );

    render(<TransactionsPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByRole('combobox', { name: /tipo/i })).toBeInTheDocument());

    const nextBtn = await screen.findByRole('link', { name: /próxima|Go to next page/i });
    await userEvent.click(nextBtn);

    await waitFor(() => {
      const withPage2 = capturedParams.find((p) => p.page === '2');
      expect(withPage2).toBeDefined();
    });
  });
});
