// Saldo e patrimônio de cada cliente chegam na forma canônica `{amount, currency}`
// (fincla-api#134). `unwrapMoney` desembrulha em qualquer profundidade e descarta o
// rótulo — por isso cada leitura abaixo extrai a moeda ANTES de desembrulhar e a
// devolve num campo `currency` ao lado dos números (fincla-frontend#314).
//
// Duas moedas diferentes viajam por aqui, e não se confundem:
// - a do CLIENTE (`/clients`, `/clients-at-risk`): a base da organização dele. Um
//   cliente em dólar se lê em dólar, seja qual for a moeda do consultor;
// - a de LEITURA do consultor (`/summary`, `/financial-health-index`,
//   `/total-credit-card-debt`, `/cash-flow`, `/expenses-by-category`): o rótulo que o
//   backend põe nos agregados da carteira (`resolve_consultant_reading_currency`).
//   `/summary` e `/financial-health-index` CONVERTEM para ela; os outros três só
//   ROTULAM uma soma não convertida (fincla-api#170) — quem desenha decide se o
//   rótulo merece confiança (`consultantCurrency.js`).
import apiClient from './client';
import { API_CONFIG } from './config';
import { toCurrency, toFiniteNumber, unwrapMoney } from './money';
import type { WireMoney } from './money';
import type {
  ClientHealthResponse,
  ConsultantSummaryQuery,
  ConsultantSummaryResponse,
  ConsultantClientsResponse,
  ActiveGoalsCountQuery,
  ActiveGoalsCountResponse,
  TotalCreditCardDebtQuery,
  TotalCreditCardDebtResponse,
  CashFlowQuery,
  CashFlowResponse,
  ExpensesByCategoryQuery,
  ExpensesByCategoryResponse,
  IncomeCommitmentQuery,
  IncomeCommitmentResponse,
  GoalsProgressByTypeQuery,
  GoalsProgressByTypeResponse,
  ClientsAtRiskQuery,
  ClientsAtRiskResponse,
  FinancialHealthIndexResponse,
  AiEvaluationRequest,
  AiEvaluationResponse,
  AiEvaluationRunStatusResponse,
  AiPortfolioSummaryResponse,
  AiPortfolioSummaryRunStatusResponse,
  AiPortfolioTrendsResponse,
  AiPortfolioTrendsRunStatusResponse,
  AiCopilotoResponse,
  AiCopilotoRunStatusResponse,
  ConsultantCategoryTemplate,
  SaveConsultantCategoryTemplateRequest,
  ConsultantPortfolioExpenseDistributionResponse,
  ConsultantPortfolioExpenseAnalysisResponse,
  ConsultantPortfolioExpenseNarrativeResponse,
  ConsultantPortfolioCategoryContributorsResponse,
} from './types';

/**
 * A moeda do primeiro valor rotulado entre `valores`, ou `null`.
 *
 * Os campos de uma mesma resposta vêm todos com o mesmo rótulo; procurar no
 * primeiro que tiver um cobre o caso em que ele vem `null` (faltou cotação) e o
 * vizinho não. `null` — nunca `"BRL"` — quando nada declara moeda: chutar a moeda
 * é o defeito que esta fronteira existe para não cometer.
 */
const moedaDe = (...valores: unknown[]): string | null => {
  for (const valor of valores) {
    const moeda = toCurrency(valor);
    if (moeda) return moeda;
  }
  return null;
};

export const getConsultantPortfolioExpenseDistribution = async (
  params: { date_start: string; date_end: string },
): Promise<ConsultantPortfolioExpenseDistributionResponse> => {
  const response = await apiClient.get<ConsultantPortfolioExpenseDistributionResponse>(
    '/consultant/expenses-distribution',
    { params },
  );
  // MoneyResponse deve atravessar a fronteira intacta: a moeda é parte do valor.
  return response.data;
};

export type PortfolioExpenseStreamEvent =
  | { type: 'report.ready'; data: ConsultantPortfolioExpenseAnalysisResponse }
  | { type: 'insight.started'; data: Record<string, never> }
  | { type: 'insight.ready'; data: ConsultantPortfolioExpenseNarrativeResponse }
  | { type: 'insight.failed'; data: { code?: string; message: string } }
  | { type: 'completed'; data: Record<string, never> };

export const streamConsultantPortfolioExpenseAnalysis = async (
  params: { date_start: string; date_end: string },
  onEvent: (event: PortfolioExpenseStreamEvent) => void,
  signal?: AbortSignal,
  insightOnly = false,
): Promise<void> => {
  const query = new URLSearchParams({ ...params, ...(insightOnly ? { insight_only: 'true' } : {}) });
  const token = localStorage.getItem('auth_token');
  const requestId = globalThis.crypto?.randomUUID?.();
  const response = await fetch(`${API_CONFIG.BASE_URL}/consultant/expenses-distribution/analysis/stream?${query}`, {
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
    },
    signal,
  });
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new CustomEvent('fincla:auth-expired'));
  }
  if (!response.ok || !response.body) throw new Error(`Report stream failed (${response.status})`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, '\n');
      if (buffer.length > 2_000_000) throw new Error('Report stream frame too large');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const name = frame.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
        const data = frame.split('\n').filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n');
        if (name && data) {
          const event = { type: name, data: JSON.parse(data) } as PortfolioExpenseStreamEvent;
          onEvent(event);
          if (name === 'completed') completed = true;
        }
        boundary = buffer.indexOf('\n\n');
      }
      if (done) { finished = true; break; }
    }
  } finally {
    // A handler or parse error leaves the connection open (and the backend generating a paid
    // reading): cancel it. After a clean end there is nothing left to cancel.
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (!completed) throw new Error('Report stream ended before completion');
};

export const getConsultantPortfolioCategoryContributors = async (
  params: { category_name: string; date_start: string; date_end: string; limit?: number; offset?: number },
): Promise<ConsultantPortfolioCategoryContributorsResponse> => {
  const response = await apiClient.get<ConsultantPortfolioCategoryContributorsResponse>(
    '/consultant/expenses-distribution/contributors', { params },
  );
  return response.data;
};

export const listConsultantCategoryTemplates = async (): Promise<ConsultantCategoryTemplate[]> => {
  const response = await apiClient.get<ConsultantCategoryTemplate[]>('/consultant/category-templates');
  return response.data;
};

export const saveConsultantCategoryTemplate = async (
  templateId: string,
  data: SaveConsultantCategoryTemplateRequest,
): Promise<ConsultantCategoryTemplate> => {
  const response = await apiClient.put<ConsultantCategoryTemplate>(
    `/consultant/category-templates/${encodeURIComponent(templateId)}`,
    data,
  );
  return response.data;
};

export const deleteConsultantCategoryTemplate = async (templateId: string): Promise<void> => {
  await apiClient.delete(`/consultant/category-templates/${encodeURIComponent(templateId)}`);
};

export const previewConsultantCategoryTemplate = async (
  templateId: string,
  organizationId: string,
): Promise<{ additions: string[]; updates: string[]; conflicts: string[] }> => {
  const response = await apiClient.get(
    `/consultant/category-templates/${encodeURIComponent(templateId)}/preview/${encodeURIComponent(organizationId)}`,
  );
  return response.data;
};

/**
 * `/summary` e `/reports/consolidated`: os totais CONVERTIDOS para a moeda de
 * leitura do consultor. Um total some (`null`) quando faltou cotação, e com ele o
 * rótulo — o recibo `consolidation.target_currency` ainda diz qual era o alvo.
 */
const comMoedaDeLeitura = (bruto: ConsultantSummaryResponse): ConsultantSummaryResponse => ({
  ...unwrapMoney(bruto),
  currency:
    moedaDe(bruto?.total_income, bruto?.total_expenses, bruto?.balance) ??
    (bruto as { consolidation?: { target_currency?: string } | null })?.consolidation?.target_currency ??
    null,
});

export const getConsultantSummary = async (
  params?: ConsultantSummaryQuery
): Promise<ConsultantSummaryResponse> => {
  const response = await apiClient.get<ConsultantSummaryResponse>(
    '/consultant/summary',
    { params }
  );
  return comMoedaDeLeitura(response.data);
};

export const getConsultantClients = async (): Promise<ConsultantClientsResponse> => {
  const response = await apiClient.get<ConsultantClientsResponse>(
    '/consultant/clients'
  );
  const bruto = response.data;
  return {
    ...unwrapMoney(bruto),
    // A moeda base de CADA cliente: o backend rotula `balance` e `patrimonio` com
    // ela. `balance` primeiro porque nunca vem `null`; `patrimonio` some quando
    // faltou cotação, e com ele o rótulo.
    clients: (bruto?.clients ?? []).map((cliente) => ({
      ...unwrapMoney(cliente),
      currency: moedaDe(cliente?.balance, cliente?.patrimonio),
    })),
  };
};

/** Removes only the authenticated consultant's relationship; client data remains. */
export const releaseConsultantClient = async (organizationId: string): Promise<void> => {
  await apiClient.delete(`/consultant/clients/${encodeURIComponent(organizationId)}`);
};

export const getConsultantConsolidatedReport = async (
  params?: ConsultantSummaryQuery
): Promise<ConsultantSummaryResponse> => {
  const response = await apiClient.get<ConsultantSummaryResponse>(
    '/consultant/reports/consolidated',
    { params }
  );
  return comMoedaDeLeitura(response.data);
};

export const getFinancialHealthIndex = async (
  params?: ConsultantSummaryQuery
): Promise<FinancialHealthIndexResponse> => {
  const response = await apiClient.get<FinancialHealthIndexResponse>(
    '/consultant/financial-health-index',
    { params }
  );
  const bruto = response.data;
  return {
    ...unwrapMoney(bruto),
    currency: moedaDe(bruto?.total_income, bruto?.total_expenses, bruto?.balance, bruto?.total_debt),
  };
};

/**
 * Força o recálculo do snapshot canônico de saúde de UM cliente.
 *
 * A carteira preenche as lacunas sozinha, mas com teto por request; este endpoint
 * é a saída explícita do consultor quando o score está velho ou ainda pendente.
 * Depois de um 200, invalide a query da carteira para o anel refletir o número novo.
 */
export const recomputeClientHealth = async (organizationId: string): Promise<ClientHealthResponse> => {
  const response = await apiClient.post<ClientHealthResponse>(
    `/consultant/clients/${organizationId}/health/recompute`
  );
  return unwrapMoney(response.data);
};

export const getActiveGoalsCount = async (
  params?: ActiveGoalsCountQuery
): Promise<ActiveGoalsCountResponse> => {
  const response = await apiClient.get<ActiveGoalsCountResponse>(
    '/consultant/active-goals-count',
    { params }
  );
  return unwrapMoney(response.data);
};

export const getTotalCreditCardDebt = async (
  params?: TotalCreditCardDebtQuery
): Promise<TotalCreditCardDebtResponse> => {
  const response = await apiClient.get<TotalCreditCardDebtResponse>(
    '/consultant/total-credit-card-debt',
    { params }
  );
  const bruto = response.data;
  return { ...unwrapMoney(bruto), currency: moedaDe(bruto?.total_debt) };
};

export const getCashFlow = async (
  params?: CashFlowQuery
): Promise<CashFlowResponse> => {
  const response = await apiClient.get<CashFlowResponse>(
    '/consultant/cash-flow',
    { params }
  );
  const bruto = response.data;
  const meses = bruto?.monthly_data ?? [];
  return {
    ...unwrapMoney(bruto),
    currency: moedaDe(...meses.flatMap((m) => [m?.total_income, m?.total_expenses, m?.balance])),
  };
};

export const getExpensesByCategory = async (
  params?: ExpensesByCategoryQuery
): Promise<ExpensesByCategoryResponse> => {
  const response = await apiClient.get<ExpensesByCategoryResponse>(
    '/consultant/expenses-by-category',
    { params }
  );
  const bruto = response.data;
  return {
    ...unwrapMoney(bruto),
    currency: moedaDe(bruto?.total_expenses, ...(bruto?.categories ?? []).map((c) => c?.total)),
  };
};

export const getIncomeCommitment = async (
  params?: IncomeCommitmentQuery
): Promise<IncomeCommitmentResponse> => {
  const response = await apiClient.get<IncomeCommitmentResponse>(
    '/consultant/income-commitment',
    { params }
  );
  return unwrapMoney(response.data);
};

export const getGoalsProgressByType = async (
  params?: GoalsProgressByTypeQuery
): Promise<GoalsProgressByTypeResponse> => {
  const response = await apiClient.get<GoalsProgressByTypeResponse>(
    '/consultant/goals-progress-by-type',
    { params }
  );
  return unwrapMoney(response.data);
};

export const getClientsAtRisk = async (
  params?: ClientsAtRiskQuery
): Promise<ClientsAtRiskResponse> => {
  const response = await apiClient.get<ClientsAtRiskResponse>(
    '/consultant/clients-at-risk',
    { params }
  );
  const bruto = response.data;
  return {
    ...unwrapMoney(bruto),
    // O saldo de cada cliente vem na base DELE (`org.base_currency`).
    clients: (bruto?.clients ?? []).map((cliente) => ({
      ...unwrapMoney(cliente),
      currency: moedaDe(cliente?.current_balance),
    })),
  };
};

// ── Adicionar cliente (S5) ──────────────────────────────────────

export interface CreateConsultantClientPayload {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  occupation?: string;
  org_name?: string;
  org_type?: string;
  /**
   * REQUISIÇÃO, e aqui dinheiro continua sendo decimal em string — de propósito.
   *
   * A assimetria com a leitura (`ConsultantClientProfile.estimated_income`, que
   * chega `{amount, currency}`) é do contrato, não descuido: no cadastro não há
   * moeda a escolher, porque o valor é gravado na base da organização que está
   * sendo criada. Embrulhar isto em `{amount, currency}` faria o backend recusar
   * o corpo (`estimated_income: str | None` no router) e o wizard quebraria no
   * último passo, depois de o consultor ter digitado tudo.
   */
  estimated_income?: string;
  initial_balance?: string;
  card?: { bank?: string; limit?: string; due_day?: string; closing_day?: string } | null;
  income?: { description?: string; value?: string; day?: string } | null;
  notes?: string;
  tags?: string[];
  experience_level?: string;
  main_goal?: string;
  priority?: boolean;
}

export interface CreateConsultantClientResponse {
  organization_id: string;
  client_name: string;
  set_password_link: string;
}

export const createConsultantClient = async (
  payload: CreateConsultantClientPayload
): Promise<CreateConsultantClientResponse> => {
  const response = await apiClient.post<CreateConsultantClientResponse>(
    '/consultant/clients',
    payload
  );
  return unwrapMoney(response.data);
};

export const regenerateClientActivationLink = async (
  organizationId: string
): Promise<{ set_password_link: string }> => {
  const response = await apiClient.post<{ set_password_link: string }>(
    `/consultant/clients/${organizationId}/activation-link`,
    {}
  );
  return unwrapMoney(response.data);
};

export interface ConsultantClientProfile {
  organization_id: string;
  has_profile: boolean;
  notes: string | null;
  tags: string[];
  experience_level: string | null;
  main_goal: string | null;
  priority: boolean;
  phone: string | null;
  occupation: string | null;
  /**
   * Renda estimada que o consultor anotou, desembrulhada para número.
   *
   * Chega no fio como `{amount, currency}` (fincla-api#178) — era string nua
   * (`"8000.00"`) e este tipo continuou declarando `string` depois da mudança.
   * Ninguém renderizava o campo, então não houve pixel quebrado; o que havia era
   * uma declaração falsa, e o próximo a escrever `{profile.estimated_income}`
   * confiando nela desenharia `[object Object]` na tela do consultor.
   *
   * `null` é "não sabemos", NUNCA zero, e por DOIS motivos: o cliente não tem
   * renda cadastrada, ou a moeda base da organização dele não pôde ser lida — e
   * nesse caso o backend prefere omitir o valor a rotulá-lo com uma moeda
   * inventada. Zero afirmaria que a pessoa não ganha nada.
   */
  estimated_income: number | null;
  /**
   * A moeda em que a renda acima está: a base da organização DO CLIENTE, não a
   * de leitura do consultor.
   *
   * `unwrapMoney` descarta o rótulo da moeda de propósito, e para os agregados
   * do consultor isso está certo. Aqui não: o consultor que assessora alguém em
   * euro tem de ler "€ 8.000,00", e "R$ 8.000,00" seria número certo com unidade
   * errada — o defeito que o épico do dinheiro canônico existe para matar. Por
   * isso a conversão deste campo é explícita e não passa por `unwrapMoney`.
   *
   * `null` quando não veio moeda: ou não há renda a rotular, ou a resposta ainda
   * está na forma antiga (string nua) de um backend anterior à #178.
   */
  estimated_income_currency: string | null;
}

/**
 * A resposta como ela chega no fio.
 *
 * Existe para o compilador cobrar a normalização, como os `Raw*` de
 * `balances.ts`: com `apiClient.get<ConsultantClientProfile>` o `return
 * response.data` cru compilava e o tipo virava mentira em silêncio — foi
 * exatamente assim que este campo atravessou a #178.
 */
export interface RawConsultantClientProfile
  extends Omit<ConsultantClientProfile, 'estimated_income' | 'estimated_income_currency'> {
  estimated_income?: WireMoney;
}

/** The consultant's private profile (notes/tags/…) for one client org. */
export const getConsultantClientProfile = async (
  organizationId: string
): Promise<ConsultantClientProfile> => {
  const response = await apiClient.get<RawConsultantClientProfile>(
    `/consultant/clients/${organizationId}/profile`
  );
  const bruto = response.data;
  return {
    // `unwrapMoney` continua caminhando a resposta inteira: se amanhã o perfil
    // ganhar outro campo monetário, ele já sai desembrulhado sem ninguém lembrar.
    ...unwrapMoney(bruto),
    estimated_income: toFiniteNumber(bruto?.estimated_income),
    // Extraída ANTES de desembrulhar, senão o rótulo se perde e a tela formata a
    // renda de um cliente português em real. `toCurrency` devolve `null` em vez
    // de chutar "BRL" — chutar moeda é erro silencioso.
    estimated_income_currency: toCurrency(bruto?.estimated_income),
  };
};

export interface ConsultantQuota {
  limit: number;
  used: number;
  remaining: number;
}

/** Plan client quota: how many clients the consultant may still add. */
export const getConsultantQuota = async (): Promise<ConsultantQuota> => {
  const response = await apiClient.get<ConsultantQuota>('/consultant/quota');
  return unwrapMoney(response.data);
};

// ===== Consultor IA — A1 ("Avaliar com IA") =====

/**
 * Gera o `correlation_id` da avaliação.
 *
 * Precisa ser um **UUID**: o backend responde `400` para um `X-Request-Id`
 * malformado (ele não substitui o id em silêncio, senão cada retry geraria um
 * correlation_id novo e a run cara re-executaria). `crypto.randomUUID` exige
 * secure context; o fallback cobre http:// em dev e jsdom antigo.
 */
export const newEvaluationRequestId = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * O backend tem budget de wall-clock de ~55s (`LLM_TOTAL_BUDGET_SECONDS`) e
 * ainda roda tools + audit por cima. O timeout de write padrão do `apiClient`
 * (30s) abortaria a avaliação no meio, então esta chamada pede mais folga.
 */
const AI_EVALUATION_TIMEOUT_MS = 90_000;

/**
 * `POST /v1/consultant/clients/{organization_id}/ai-evaluation` — roda a Skill
 * `evaluate-client` contra UM cliente. Requer a feature `consultant_ai`.
 *
 * O escopo do tenant vem do path + sessão autenticada, nunca do body.
 *
 * `requestId` é ecoado como `correlation_id` em todas as respostas (sucesso e
 * erro) e é a **chave de idempotência**: repetir o mesmo id devolve `409`.
 * Para um retry legítimo, gere um novo id com `newEvaluationRequestId()`.
 *
 * `refresh` fura o cache do backend e força uma execução nova do LLM. Sem ele,
 * uma avaliação recente do MESMO consultor para o MESMO cliente é reaproveitada
 * (resposta com `cached: true` + `computed_at`).
 *
 * Note que `refresh` e `requestId` resolvem coisas diferentes e não se
 * substituem: um `requestId` novo evita o `409` (retry da mesma request), mas
 * ainda assim cairia no cache. Recalcular de verdade exige os dois.
 */
export const evaluateClientWithAi = async (
  organizationId: string,
  requestId: string,
  body: AiEvaluationRequest = {},
  refresh = false
): Promise<AiEvaluationResponse> => {
  const response = await apiClient.post<AiEvaluationResponse>(
    `/consultant/clients/${organizationId}/ai-evaluation`,
    body,
    {
      headers: { 'X-Request-Id': requestId },
      timeout: AI_EVALUATION_TIMEOUT_MS,
      ...(refresh ? { params: { refresh: true } } : {}),
    }
  );
  return unwrapMoney(response.data);
};

/**
 * `GET /v1/consultant/clients/{organization_id}/ai-evaluation/{run_id}` — o
 * estado de uma avaliação **já iniciada**.
 *
 * Serve a quem perdeu a run de vista: um F5 no meio dela, uma segunda aba, um
 * navegador reaberto. O caminho antigo era pedir outra avaliação — que o backend
 * recusa com `409 evaluation_in_progress` (e faz bem: a run existe e já está
 * sendo paga). Esse 409 carrega o `run_id`, e é com ele que se volta para cá.
 *
 * Consulta barata: lê a linha de audit, não toca no LLM. Pode ser chamada em
 * loop enquanto `status === "running"`.
 */
export const getAiEvaluationRun = async (
  organizationId: string,
  runId: string
): Promise<AiEvaluationRunStatusResponse> => {
  const response = await apiClient.get<AiEvaluationRunStatusResponse>(
    `/consultant/clients/${organizationId}/ai-evaluation/${runId}`
  );
  return unwrapMoney(response.data);
};

// ===== Consultor IA — A2 ("Resumo da base por IA") =====

/**
 * `POST /v1/consultant/ai-portfolio-summary` — roda a Skill `summarize-portfolio`
 * sobre a carteira INTEIRA do consultor. Requer a feature `consultant_ai`.
 *
 * **Sem `organization_id`**: o alvo é a base, e o escopo vem da sessão — não há
 * id vindo do cliente para o backend validar. O corpo é vazio de propósito (o
 * backend rejeita qualquer campo com `extra="forbid"`).
 *
 * O `requestId`/`refresh` seguem exatamente a semântica do `evaluateClientWithAi`:
 * `requestId` é `correlation_id` + chave de idempotência (repetir → `409`), e
 * `refresh` fura o cache. Reusa `newEvaluationRequestId()` e o mesmo timeout
 * (o budget de wall-clock do backend é o mesmo).
 */
export const summarizePortfolioWithAi = async (
  requestId: string,
  refresh = false
): Promise<AiPortfolioSummaryResponse> => {
  const response = await apiClient.post<AiPortfolioSummaryResponse>(
    '/consultant/ai-portfolio-summary',
    {},
    {
      headers: { 'X-Request-Id': requestId },
      timeout: AI_EVALUATION_TIMEOUT_MS,
      ...(refresh ? { params: { refresh: true } } : {}),
    }
  );
  return unwrapMoney(response.data);
};

/**
 * `GET /v1/consultant/ai-portfolio-summary/{run_id}` — estado de um relatório da
 * base já iniciado. Irmão do `getAiEvaluationRun`, mas SEM `organization_id` na
 * rota: o alvo é a carteira. Consulta barata (lê o audit, não toca no LLM);
 * chamada em loop enquanto `status === "running"`. Existe porque o
 * `409 portfolio_summary_in_progress` devolve um `run_id`, e é com ele que se
 * reencontra a run em vez de pagar outra.
 */
export const getAiPortfolioSummaryRun = async (
  runId: string
): Promise<AiPortfolioSummaryRunStatusResponse> => {
  const response = await apiClient.get<AiPortfolioSummaryRunStatusResponse>(
    `/consultant/ai-portfolio-summary/${runId}`
  );
  return unwrapMoney(response.data);
};

// ===== Consultor IA — A3 ("Tendências detectadas pela IA") =====

/**
 * `POST /v1/consultant/ai-portfolio-trends` — detecta 3-6 tendências agregadas da
 * carteira. Mesma forma do resumo (sem `organization_id`, corpo vazio), gated por
 * `consultant_ai`. A tela de Insights auto-dispara isto ao abrir; o cache do
 * backend (1 dia) absorve as reaberturas. `refresh=true` fura o cache (botão
 * "Atualizar"). Reusa `newEvaluationRequestId()` e o timeout longo.
 */
export const detectPortfolioTrendsWithAi = async (
  requestId: string,
  refresh = false
): Promise<AiPortfolioTrendsResponse> => {
  const response = await apiClient.post<AiPortfolioTrendsResponse>(
    '/consultant/ai-portfolio-trends',
    {},
    {
      headers: { 'X-Request-Id': requestId },
      timeout: AI_EVALUATION_TIMEOUT_MS,
      ...(refresh ? { params: { refresh: true } } : {}),
    }
  );
  return unwrapMoney(response.data);
};

/**
 * `GET /v1/consultant/ai-portfolio-trends/{run_id}` — estado de uma detecção já
 * iniciada. Irmão do rejoin do resumo; consulta barata (audit, não LLM). Existe
 * porque o `409 trends_detection_in_progress` entrega um `run_id`.
 */
export const getAiPortfolioTrendsRun = async (
  runId: string
): Promise<AiPortfolioTrendsRunStatusResponse> => {
  const response = await apiClient.get<AiPortfolioTrendsRunStatusResponse>(
    `/consultant/ai-portfolio-trends/${runId}`
  );
  return unwrapMoney(response.data);
};

// ===== Consultor IA — A4 ("Copiloto IA") =====

/**
 * `POST /v1/consultant/ai-copiloto` — uma mensagem do chat escopado à carteira.
 * Requer a feature `consultant_ai`.
 *
 * Diferente dos relatórios (corpo vazio, one-shot), este é CONVERSACIONAL:
 * - `message` é o turno do consultor.
 * - `sessionId` é o THREAD da conversa: passe o MESMO valor em todas as mensagens
 *   de um chat para manter o contexto multi-turno. O backend o namespaceia sob o
 *   consultor autenticado, então um valor forjado nunca lê a conversa de outro.
 * - `requestId` é `correlation_id` + chave de idempotência (repetir → `409`); use
 *   um novo a cada mensagem (`newEvaluationRequestId()`).
 *
 * Cada mensagem é uma run paga (sem cache), com o mesmo timeout longo das irmãs.
 */
export const askCopiloto = async (
  requestId: string,
  message: string,
  sessionId: string,
  presentationStyle: 'dashboard' | 'explanation' = 'dashboard'
): Promise<AiCopilotoResponse> => {
  const response = await apiClient.post<AiCopilotoResponse>(
    '/consultant/ai-copiloto',
    { message, session_id: sessionId, presentation_style: presentationStyle },
    {
      headers: { 'X-Request-Id': requestId },
      timeout: AI_EVALUATION_TIMEOUT_MS,
    }
  );
  // Os valores do relatório agregado são deliberadamente {amount, currency}:
  // ao contrário de métricas pessoais já normalizadas, o Copiloto apresenta
  // mais de uma moeda e precisa manter cada unidade junto ao valor.
  return response.data;
};

/**
 * `GET /v1/consultant/ai-copiloto/{run_id}` — estado de uma mensagem já iniciada.
 * Irmão dos outros rejoins; consulta barata (audit, não LLM). Existe porque o
 * `409 copilot_in_progress` entrega um `run_id`.
 */
export const getAiCopilotoRun = async (
  runId: string
): Promise<AiCopilotoRunStatusResponse> => {
  const response = await apiClient.get<AiCopilotoRunStatusResponse>(
    `/consultant/ai-copiloto/${runId}`
  );
  return response.data;
};
