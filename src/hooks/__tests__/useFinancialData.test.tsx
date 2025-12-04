import { renderHook, waitFor } from '@testing-library/react';
import { useFinancialData } from '../useFinancialData';
import { wrapper } from '@/test/utils/test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as useOrganizationModule from '../useOrganization';

// Mock useOrganization
vi.mock('../useOrganization', () => ({
    useOrganization: vi.fn(),
}));

describe('useFinancialData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should start with empty data and then fetch from backend', async () => {
        // Setup mocks
        (useOrganizationModule.useOrganization as any).mockReturnValue({
            activeOrgId: 'org-123',
        });

        const { result } = renderHook(() => useFinancialData(), { wrapper });

        // Initially should have empty data
        expect(result.current.summary.balance).toBe(0);
        expect(result.current.summary.income).toBe(0);
        expect(result.current.summary.expenses).toBe(0);

        // Wait for query to resolve
        await waitFor(() => {
            expect(result.current.recentTransactions).toBeDefined();
            // Check if data is processed from MSW response
            // MSW returns 1 transaction: expense 50.0
        });

        // Based on MSW handler for GET /api/v1/transactions:
        // It returns 1 transaction with value 50.0, type 'expense'

        // Analytics processing should result in:
        // Expenses: 50.0
        // Income: 0
        // Balance: -50.0

        await waitFor(() => {
            expect(result.current.summary.expenses).toBe(50.0);
        });

        expect(result.current.summary.income).toBe(0);
        expect(result.current.summary.balance).toBe(-50.0);
        expect(result.current.recentTransactions).toHaveLength(1);
        expect(result.current.recentTransactions[0].amount).toBe(-50.0);
    });

    it('should not fetch data when no organization is selected', () => {
        // Setup mocks
        (useOrganizationModule.useOrganization as any).mockReturnValue({
            activeOrgId: null, // No organization selected
        });

        const { result } = renderHook(() => useFinancialData(), { wrapper });

        // Should have empty initial data
        expect(result.current.summary.balance).toBe(0);
        expect(result.current.summary.income).toBe(0);
        expect(result.current.summary.expenses).toBe(0);
        expect(result.current.recentTransactions).toHaveLength(0);
        expect(result.current.loading).toBe(false); // Query is disabled
    });
});
