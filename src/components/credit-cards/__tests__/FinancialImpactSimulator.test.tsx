import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FinancialImpactSimulator } from '../FinancialImpactSimulator';
import { toast } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock simplificado dos componentes UI para isolar o teste
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 role="heading">{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className} data-testid="card">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

// Mock do toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  }
}));

// Mock do useOrganization para evitar chamadas de API
vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: () => ({
    activeOrganization: { id: 'test-org-id', name: 'Test Org' },
    isLoading: false,
    error: null,
  }),
}));

// Mock da API de cartões de crédito
vi.mock('@/api/creditCards', () => ({
  listCreditCards: vi.fn().mockResolvedValue([
    { id: 1, last4: '1234', brand: 'Visa', description: 'Cartão Principal', due_day: 10 },
    { id: 2, last4: '5678', brand: 'Mastercard', description: 'Cartão Secundário', due_day: 15 },
  ]),
}));

// Wrapper com QueryClientProvider para os testes
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('FinancialImpactSimulator Integration', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the form initially', () => {
    render(<FinancialImpactSimulator open={true} onOpenChange={mockOnOpenChange} />, { wrapper: createWrapper() });
    
    expect(screen.getByRole('heading', { name: /Simulador de Impacto Financeiro/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Descrição da Compra/i)).toBeInTheDocument();
  });

  it('should render form fields correctly', () => {
    render(<FinancialImpactSimulator open={true} onOpenChange={mockOnOpenChange} />, { wrapper: createWrapper() });

    // Verifica que os campos do formulário estão presentes
    expect(screen.getByLabelText(/Descrição da Compra/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor Total/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Número de Parcelas/i)).toBeInTheDocument();
    
    // Verifica os botões
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simular Impacto/i })).toBeInTheDocument();
    
    // O botão de simular deve estar desabilitado inicialmente (campos vazios)
    expect(screen.getByRole('button', { name: /Simular Impacto/i })).toBeDisabled();
  });
});
