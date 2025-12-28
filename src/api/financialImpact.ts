import apiClient from './client';
import { SimulateFinancialImpactRequest, SimulateFinancialImpactResponse } from '@/types/api';

/**
 * Simula o impacto financeiro de novos compromissos de cartão de crédito e metas de economia.
 * O backend calcula a viabilidade cruzando com receitas, despesas e metas.
 */
export const simulateFinancialImpact = async (
    request: SimulateFinancialImpactRequest
): Promise<SimulateFinancialImpactResponse> => {
    const response = await apiClient.post<SimulateFinancialImpactResponse>(
        '/financial-impact/simulate',
        request
    );
    return response.data;
};

