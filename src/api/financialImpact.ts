import apiClient from './client';
import { FinancialSimulationRequest, FinancialSimulationResponse } from '@/types/api';

/**
 * Simula o impacto financeiro de uma nova compra parcelada.
 * O backend calcula a viabilidade cruzando com receitas, despesas e metas.
 */
export const simulateFinancialImpact = async (
    data: FinancialSimulationRequest
): Promise<FinancialSimulationResponse> => {
    const response = await apiClient.post<FinancialSimulationResponse>(
        '/financial-impact/simulate',
        data
    );
    return response.data;
};

