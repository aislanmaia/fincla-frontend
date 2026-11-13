// api/baseCurrencyChange.ts — trocar a moeda base da organização (fincla-api#465).
//
// Dois passos: uma PRÉVIA que lista, agrupado, o que está gravado na base atual
// (com "manter o número" e "converter pela cotação" lado a lado, calculados pelo
// servidor), e uma CONFIRMAÇÃO que aplica tudo numa transação só.
//
// O dinheiro da prévia fica na forma canônica `{amount, currency}`: aqui a moeda
// muda de item para item ("antes" em R$, "depois" em US$), e `unwrapMoney` jogaria
// fora justamente a moeda que a tela precisa mostrar. Só a organização devolvida
// pela confirmação é desembrulhada, como em `api/organizations.ts`.
import apiClient from './client';
import { unwrapMoney } from './money';
import type { CanonicalMoney } from './money';
import type { Organization } from './types';

export type BaseCurrencyChangeGroupKey =
  | 'income'
  | 'budgets'
  | 'goals'
  | 'monthly_plans'
  | 'consultant_income';

export interface BaseCurrencyChangeQuote {
  /** A cotação vem na direção `from → to` (BRL → USD: `rate` = US$ por R$ 1). */
  base: string;
  quote: string;
  rate: string;
  quoted_on: string;
}

export interface BaseCurrencyChangeItem {
  key: string;
  entity_id: string;
  field: string;
  label: string;
  current: CanonicalMoney;
  kept: CanonicalMoney;
  /** `null` sem cotação — nunca uma taxa 1 no lugar dela. */
  converted: CanonicalMoney | null;
  can_skip: boolean;
  locked_reason: 'has_contributions' | string | null;
  /** Aviso sobre o item (ex.: meta cujos aportes futuros precisam vir de conta na moeda nova). */
  warning?: 'contributions_currency' | string | null;
}

export interface BaseCurrencyChangeGroup {
  group: BaseCurrencyChangeGroupKey;
  /** Inclui os itens não exibidos (`undisclosed_count`). */
  count: number;
  locked_count: number;
  undisclosed_count: number;
  items: BaseCurrencyChangeItem[];
}

export interface BaseCurrencyChangePreview {
  organization_id: string;
  from_currency: string;
  to_currency: string;
  quote: BaseCurrencyChangeQuote | null;
  quote_unavailable_reason: string | null;
  fingerprint: string;
  /** Vazio = nada gravado na base: dá para confirmar direto. */
  groups: BaseCurrencyChangeGroup[];
}

export type BaseCurrencyChangeMode = 'keep' | 'convert' | 'skip' | 'value';

export interface ApplyBaseCurrencyChangeRequest {
  to: string;
  fingerprint: string;
  mode: 'keep' | 'convert';
  quote?: { rate: string; quoted_on: string } | null;
  groups?: Record<string, { mode: 'keep' | 'convert' | 'skip' }>;
  items?: Record<string, { mode?: BaseCurrencyChangeMode; value?: string }>;
}

export interface ApplyBaseCurrencyChangeResponse {
  organization: Organization;
  from_currency: string;
  to_currency: string;
  quote: BaseCurrencyChangeQuote | null;
  audit_event_id: string;
  items: Array<{
    key: string;
    group: string;
    label: string;
    mode: BaseCurrencyChangeMode;
    before: CanonicalMoney;
    after: CanonicalMoney;
  }>;
}

/** Só leitura: o impacto de trocar a base para `to`. */
export const previewBaseCurrencyChange = async (
  organizationId: string,
  to: string,
): Promise<BaseCurrencyChangePreview> => {
  const response = await apiClient.get<BaseCurrencyChangePreview>(
    `/organizations/${organizationId}/base-currency-change/preview`,
    { params: { to } },
  );
  return response.data;
};

/**
 * Aplica a troca. `409` = a prévia envelheceu (cotação ou dados mudaram): refaça a
 * prévia. `422` = escolha recusada (a mensagem diz o quê). `403` = sem permissão.
 */
export const applyBaseCurrencyChange = async (
  organizationId: string,
  body: ApplyBaseCurrencyChangeRequest,
): Promise<ApplyBaseCurrencyChangeResponse> => {
  const response = await apiClient.post<ApplyBaseCurrencyChangeResponse>(
    `/organizations/${organizationId}/base-currency-change`,
    body,
  );
  const data = response.data;
  return { ...data, organization: unwrapMoney(data.organization) };
};
