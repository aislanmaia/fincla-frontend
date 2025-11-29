import { api } from '@/lib/axios';
import { FinancialSimulationRequest, FinancialSimulationResponse } from '@/types/api';

/**
 * Simula o impacto financeiro de uma nova compra parcelada.
 * O backend calcula a viabilidade cruzando com receitas, despesas e metas.
 */
export const simulateFinancialImpact = async (
    data: FinancialSimulationRequest
): Promise<FinancialSimulationResponse> => {
    // Em produção, isso chamaria o backend real
    // const response = await api.post<FinancialSimulationResponse>('/financial-impact/simulate', data);
    // return response.data;

    // MOCK TEMPORÁRIO PARA SIMULAR O BACKEND (Enquanto o endpoint não existe)
    // Este mock implementa a lógica descrita em BACKEND_FINANCIAL_SIMULATOR_SPEC.md
    return new Promise((resolve) => {
        setTimeout(() => {
            const { purchase_amount, installments } = data;
            const installmentValue = purchase_amount / installments;
            const startDate = new Date();
            
            const timeline = [];
            let hasDanger = false;
            let hasWarning = false;

            // Mock de dados "reais" do usuário (que viriam do banco)
            const userProfile = {
                projectedIncome: 5200.00,
                baseExpenses: 2800.00,
                savingsGoal: 1000.00
            };

            for (let i = 0; i < installments; i++) {
                const currentMonth = new Date(startDate);
                currentMonth.setMonth(startDate.getMonth() + i + 1); // Começa próximo mês
                
                // Simula variação de parcelas existentes (cai ao longo do tempo)
                const existingCommitments = Math.max(0, 1200 - (i * 100)) + (Math.random() * 200);
                
                const totalObligations = userProfile.baseExpenses + existingCommitments + installmentValue;
                const projectedBalance = userProfile.projectedIncome - totalObligations;
                
                let status: 'success' | 'warning' | 'danger' = 'success';
                let meetsGoal = true;

                if (projectedBalance < 0) {
                    status = 'danger';
                    hasDanger = true;
                    meetsGoal = false;
                } else if (projectedBalance < userProfile.savingsGoal) {
                    status = 'warning';
                    hasWarning = true;
                    meetsGoal = false;
                }

                timeline.push({
                    month: currentMonth.toLocaleString('pt-BR', { month: 'long' }),
                    year: currentMonth.getFullYear(),
                    month_iso: currentMonth.toISOString().slice(0, 7),
                    financial_data: {
                        projected_income: userProfile.projectedIncome,
                        base_expenses: userProfile.baseExpenses,
                        existing_commitments: existingCommitments,
                        new_installment: installmentValue,
                        total_obligations: totalObligations,
                        savings_goal: userProfile.savingsGoal
                    },
                    result: {
                        projected_balance: projectedBalance,
                        status,
                        meets_goal: meetsGoal
                    }
                });
            }

            // Define veredicto
            let verdict: 'viable' | 'caution' | 'high-risk' = 'viable';
            let message = 'Compra segura! Seu orçamento comporta esta despesa sem afetar suas metas.';

            if (hasDanger) {
                verdict = 'high-risk';
                message = 'Esta compra gera risco de endividamento. Em alguns meses, suas despesas superarão suas receitas.';
            } else if (hasWarning) {
                verdict = 'caution';
                message = `Compra viável, mas requer atenção. Você ficará abaixo da sua meta de economia em alguns meses.`;
            }

            resolve({
                simulation_id: crypto.randomUUID(),
                summary: {
                    verdict,
                    verdict_message: message,
                    total_impact: installmentValue,
                    duration_months: installments
                },
                timeline
            });
        }, 800); // Delay artificial de rede
    });
};

