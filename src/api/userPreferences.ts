// api/userPreferences.ts — preferências da pessoa (não da organização), fincla-api#517.
//
// `GET/PATCH /users/me/preferences`: cada um lê e grava só as suas. Quem nunca gravou recebe o padrão.
import apiClient from './client';

/** Cartões do Conciliar extrato: "Detalhada" (padrão) ou "Compacta" (rótulos ao lado dos valores). */
export type StatementReconciliationView = 'detailed' | 'compact';

export interface UserPreferences {
  statement_reconciliation_view: StatementReconciliationView;
}

const normalize = (raw: Partial<UserPreferences> | null | undefined): UserPreferences => ({
  statement_reconciliation_view: raw?.statement_reconciliation_view === 'compact' ? 'compact' : 'detailed',
});

export const getUserPreferences = async (): Promise<UserPreferences> => {
  const response = await apiClient.get<UserPreferences>('/users/me/preferences');
  return normalize(response.data);
};

/** Muda só o que for enviado; devolve todas as preferências gravadas. */
export const updateUserPreferences = async (changes: Partial<UserPreferences>): Promise<UserPreferences> => {
  const response = await apiClient.patch<UserPreferences>('/users/me/preferences', changes);
  return normalize(response.data);
};
