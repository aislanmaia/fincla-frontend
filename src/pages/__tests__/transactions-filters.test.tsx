import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TransactionsPage from '../transactions';
import { createTestQueryClient, wrapper } from '@/test/utils/test-utils';
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

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/components/NewTransactionSheet', () => ({
  NewTransactionSheet: ({ onInvalidateCache, open }: { onInvalidateCache?: () => void; open?: boolean }) => {
    if (!open) return null;
    return (
      <div data-testid="mock-transaction-sheet">
        <button type="button" onClick={() => onInvalidateCache?.()}>
          Simular sucesso
        </button>
      </div>
    );
  },
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

describe('TransactionsPage - invalidação de cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chama GET /transactions e GET /transactions/summary ao carregar a página', async () => {
    const transactionsCalls: unknown[] = [];
    const summaryCalls: unknown[] = [];
    server.use(
      http.get('*/v1/transactions/summary', () => {
        summaryCalls.push({});
        return HttpResponse.json({
          total_transactions: 1,
          total_value: 50.0,
          total_income: 0,
          total_expenses: 50.0,
          balance: -50.0,
          average_transaction: 50.0,
          period: { start_date: '2024-01-01', end_date: '2024-01-31' },
          filters_applied: {},
        });
      }),
      http.get('*/v1/transactions', ({ request }) => {
        transactionsCalls.push(request);
        return HttpResponse.json({
          data: [
            {
              id: 1,
              organization_id: 'org-123',
              type: 'expense',
              description: 'Test',
              category: 'Alimentação',
              value: 50.0,
              payment_method: 'PIX',
              date: '2024-01-15T10:00:00',
              created_at: '2024-01-15T10:00:00',
              updated_at: '2024-01-15T10:00:00',
              tags: {},
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, pages: 1, has_next: false, has_prev: false },
        });
      })
    );

    render(<TransactionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(transactionsCalls.length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(summaryCalls.length).toBeGreaterThan(0);
    });
  });

  it('invalida transactions e transactions-summary ao confirmar exclusão', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    server.use(
      http.get('*/v1/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/summary')) {
          return HttpResponse.json({
            total_transactions: 1,
            total_value: 50.0,
            total_income: 0,
            total_expenses: 50.0,
            balance: -50.0,
            average_transaction: 50.0,
            period: { start_date: '2024-01-01', end_date: '2024-01-31' },
            filters_applied: {},
          });
        }
        return HttpResponse.json({
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
        });
      })
    );

    render(<TransactionsPage />, { wrapper: TestWrapper });

    await waitFor(() => expect(screen.getByText('Test expense')).toBeInTheDocument());

    const table = screen.getByRole('table');
    const tbody = table.querySelector('tbody');
    expect(tbody).toBeInTheDocument();
    const rowButtons = within(tbody!).getAllByRole('button');
    const deleteBtn = rowButtons[rowButtons.length - 1];
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /confirmar exclusão/i })).toBeInTheDocument();
    });
    const confirmInput = screen.getByPlaceholderText('EXCLUIR');
    await userEvent.type(confirmInput, 'EXCLUIR');

    const confirmBtn = screen.getByRole('button', { name: /confirmar exclusão/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      const transactionsInvalidation = invalidateSpy.mock.calls.find(
        (call) => Array.isArray(call[0]?.queryKey) && call[0].queryKey[0] === 'transactions' && call[0].queryKey[1] === 'org-123'
      );
      const summaryInvalidation = invalidateSpy.mock.calls.find(
        (call) => Array.isArray(call[0]?.queryKey) && call[0].queryKey[0] === 'transactions-summary' && call[0].queryKey[1] === 'org-123'
      );
      expect(transactionsInvalidation).toBeDefined();
      expect(summaryInvalidation).toBeDefined();
    });
  });

  it('invalida transactions e transactions-summary quando onInvalidateCache é chamado (criação/atualização)', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(<TransactionsPage />, { wrapper: TestWrapper });

    await waitFor(() => expect(screen.getByText('Test expense')).toBeInTheDocument());

    const table = screen.getByRole('table');
    const tbody = table.querySelector('tbody');
    expect(tbody).toBeInTheDocument();
    const rowButtons = within(tbody!).getAllByRole('button');
    const editBtn = rowButtons[0];
    await userEvent.click(editBtn);

    const simularBtn = await screen.findByRole('button', { name: /simular sucesso/i }, { timeout: 5000 });
    await userEvent.click(simularBtn);

    await waitFor(() => {
      const transactionsInvalidation = invalidateSpy.mock.calls.find(
        (call) => Array.isArray(call[0]?.queryKey) && call[0].queryKey[0] === 'transactions' && call[0].queryKey[1] === 'org-123'
      );
      const summaryInvalidation = invalidateSpy.mock.calls.find(
        (call) => Array.isArray(call[0]?.queryKey) && call[0].queryKey[0] === 'transactions-summary' && call[0].queryKey[1] === 'org-123'
      );
      expect(transactionsInvalidation).toBeDefined();
      expect(summaryInvalidation).toBeDefined();
    });
  });
});
