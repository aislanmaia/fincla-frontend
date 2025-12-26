import { render, screen } from '@/test/utils/test-utils';
import { SummaryCards } from '../SummaryCards';
import { describe, it, expect } from 'vitest';

describe('SummaryCards', () => {
    const mockSummary = {
        balance: 1234.56,
        income: 5000.00,
        expenses: 3765.44,
        savingsGoal: 10000,
        savingsProgress: 1500,
    };

    it('should render loading state', () => {
        render(<SummaryCards isLoading={true} summary={mockSummary} monthlyData={[]} />);
        // Check that values are NOT displayed when loading
        expect(screen.queryByText(/1\.234,56/)).not.toBeInTheDocument();
    });

    it('should render data correctly', () => {
        render(<SummaryCards isLoading={false} summary={mockSummary} monthlyData={[]} />);

        // Check for values formatted as currency
        // Using regex to match formatted currency strings
        expect(screen.getByText(/1\.234,56/)).toBeInTheDocument();
        expect(screen.getByText(/5\.000,00/)).toBeInTheDocument();
        expect(screen.getByText(/3\.765,44/)).toBeInTheDocument();
    });

    it('should render empty state', () => {
        const emptySummary = {
            balance: 0,
            income: 0,
            expenses: 0,
        };
        render(<SummaryCards isLoading={false} summary={emptySummary} monthlyData={[]} />);

        // Should show 0,00 for empty values
        expect(screen.getAllByText(/0,00/)).toHaveLength(3); // Balance, Income, Expenses
    });
});
