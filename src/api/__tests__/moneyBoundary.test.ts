import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { getConsultantClientProfile, getConsultantClients } from '../consultant';
import { getEconomyCapacity, getFinancialHealth } from '../financialHealth';
import { getGoalProjection, listGoalContributions, listGoals } from '../goals';
import { getMonthlyPlan } from '../monthlyPlans';

import consultantFamily from '../__fixtures__/consultant_family.example.json';
import goalFamily from '../__fixtures__/goal_family.example.json';
import goalProjection from '../__fixtures__/goal_projection.example.json';
import healthFamily from '../__fixtures__/health_family.example.json';

/**
 * A FRONTEIRA, exercitada com as fixtures canônicas do backend.
 *
 * Por que este arquivo existe: cada tela que consome estes módulos os substitui por
 * `vi.mock`, então a suíte inteira ficava verde com o desembrulho ausente. Foi assim
 * que `financialHealth.ts` atravessou a migração de quatro superfícies devolvendo
 * `r.data` cru — o nome da variável era outro, e nenhum teste chamava a função de
 * verdade. Aqui o módulo roda inteiro; só o axios é falso.
 *
 * As fixtures são cópia byte a byte de `fincla-api/docs/contracts/*.example.json`, e
 * um teste do backend as prende aos modelos Pydantic. Se o contrato mudar sem a
 * fixture mudar junto, os dois lados quebram — que é o ponto.
 */
vi.mock('../client', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const responde = (data: unknown) => vi.mocked(apiClient.get).mockResolvedValueOnce({ data } as never);

/** Todo valor monetário que sobrou embrulhado, em qualquer profundidade.
 *
 * A quebra por moeda (`*_by_currency`) é a exceção declarada: ali o embrulho é o
 * ponto — sem o código, `300` seria desenhado como trezentos reais. Ver `money.ts`.
 */
function sobraramEmbrulhados(node: unknown, caminho = ''): string[] {
  if (Array.isArray(node)) return node.flatMap((v, i) => sobraramEmbrulhados(v, `${caminho}[${i}]`));
  if (node !== null && typeof node === 'object') {
    const chaves = Object.keys(node);
    if (chaves.length === 2 && chaves.includes('amount') && chaves.includes('currency')) {
      return [caminho];
    }
    return Object.entries(node).flatMap(([k, v]) =>
      /by_currency$/.test(k) ? [] : sobraramEmbrulhados(v, `${caminho}.${k}`),
    );
  }
  return [];
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset();
});

describe('nenhum módulo devolve dinheiro embrulhado', () => {
  it('metas', async () => {
    responde([goalFamily.goal]);
    expect(sobraramEmbrulhados(await listGoals('org'))).toEqual([]);
  });

  it('aportes da meta', async () => {
    responde(goalFamily.contribution_list);
    expect(sobraramEmbrulhados(await listGoalContributions('g', 'org'))).toEqual([]);
  });

  it('projeção da meta', async () => {
    responde(goalProjection);
    expect(sobraramEmbrulhados(await getGoalProjection('org', 'g'))).toEqual([]);
  });

  it('painel de saúde', async () => {
    responde(healthFamily.financial_health_score);
    expect(sobraramEmbrulhados(await getFinancialHealth('org'))).toEqual([]);
  });

  it('planejado × realizado', async () => {
    responde(healthFamily.monthly_plan_comparison);
    expect(sobraramEmbrulhados(await getMonthlyPlan('org', 2026, 6))).toEqual([]);
  });

  it('carteira do consultor', async () => {
    responde(consultantFamily.clients);
    expect(sobraramEmbrulhados(await getConsultantClients())).toEqual([]);
  });

  it('perfil privado do cliente', async () => {
    responde(consultantFamily.client_profile);
    expect(sobraramEmbrulhados(await getConsultantClientProfile('org'))).toEqual([]);
  });
});

/**
 * O perfil privado do cliente (#205).
 *
 * A #178 trocou `estimated_income` de string nua para `{amount, currency}` e o tipo
 * do frontend continuou dizendo `string | null`. Nenhuma tela lia o campo, então não
 * havia pixel quebrado — havia uma declaração falsa, e nenhum teste na ponta TS.
 *
 * A moeda aqui NÃO é descartável: é a base da organização DO CLIENTE, e o consultor
 * que assessora alguém em euro tem de ler euro. Por isso ela sai num campo próprio
 * em vez de morrer dentro de `unwrapMoney`.
 */
describe('perfil do cliente: a renda estimada sai com número E moeda (#205)', () => {
  it('a fixture canônica sai como número somável, não como objeto', async () => {
    responde(consultantFamily.client_profile);

    const perfil = await getConsultantClientProfile('org');

    // Sem desembrulho, `{profile.estimated_income}` desenharia `[object Object]`.
    expect(perfil.estimated_income).toBe(8000);
    expect(typeof perfil.estimated_income).toBe('number');
  });

  it('a moeda do cliente sobrevive à fronteira', async () => {
    responde({ ...consultantFamily.client_profile, estimated_income: { amount: '3200.00', currency: 'EUR' } });

    const perfil = await getConsultantClientProfile('org');

    // `unwrapMoney` sozinho devolvia 3200 e nada mais: a tela formataria a renda
    // de um cliente português como "R$ 3.200,00" — número certo, unidade errada.
    expect(perfil.estimated_income_currency).toBe('EUR');
    expect(perfil.estimated_income).toBe(3200);
  });

  it('renda ausente continua null nos dois campos, e nunca vira zero', async () => {
    // `null` chega tanto de "não cadastrou renda" quanto de "não deu para ler a
    // moeda base do cliente" — o backend omite o valor em vez de inventar a
    // unidade. Zero afirmaria que a pessoa não ganha nada.
    responde({ ...consultantFamily.client_profile, estimated_income: null });

    const perfil = await getConsultantClientProfile('org');

    expect(perfil.estimated_income).toBeNull();
    expect(perfil.estimated_income_currency).toBeNull();
  });

  it('a forma antiga (string nua) ainda atravessa, sem moeda', async () => {
    // Cobre o skew de deploy: um backend anterior à #178 no ar com este frontend.
    // O valor tem de chegar; a moeda é que não existe para ser afirmada.
    responde({ ...consultantFamily.client_profile, estimated_income: '8000.00' });

    const perfil = await getConsultantClientProfile('org');

    expect(perfil.estimated_income).toBe(8000);
    expect(perfil.estimated_income_currency).toBeNull();
  });

  it('perfil vazio (has_profile=false) não inventa renda', async () => {
    responde({ organization_id: 'o', has_profile: false, tags: [] });

    const perfil = await getConsultantClientProfile('org');

    expect(perfil.estimated_income).toBeNull();
    expect(perfil.estimated_income_currency).toBeNull();
  });
});

describe('a quebra por moeda atravessa a fronteira inteira (#170)', () => {
  it('a capacidade de economia mantém o código de cada fatia', async () => {
    responde({
      avg_income: { amount: '5000.00', currency: 'BRL' },
      avg_expense: null,
      avg_surplus: null,
      savings_rate: null,
      trend: 'unknown',
      months: [],
      window_months: 3,
      months_with_data: 0,
      avg_expense_by_currency: [
        { amount: '300.00', currency: 'USD' },
        { amount: '4000.00', currency: 'BRL' },
      ],
      consolidation: { target_currency: 'BRL', rates: [], unavailable: 'USD/BRL: sem cotação' },
    });

    const capacidade = await getEconomyCapacity('org', 3);

    // Sem isto a tela recebia `[300, 4000]` e desenhava dólar formatado como real
    // — exatamente o caso para o qual a quebra existe.
    expect(capacidade.avg_expense_by_currency).toEqual([
      { amount: '300.00', currency: 'USD' },
      { amount: '4000.00', currency: 'BRL' },
    ]);
    // E o total continua virando número, como todo o resto.
    expect(capacidade.avg_income).toBe(5000);
  });
});

describe('o que sai da fronteira é número, e ausência continua ausência', () => {
  it('o saldo projetado vira uma série de números somáveis', async () => {
    responde(goalProjection);

    const projecao = await getGoalProjection('org', 'g');

    expect(projecao.series.length).toBeGreaterThan(0);
    for (const ponto of projecao.series) expect(typeof ponto).toBe('number');
    // O defeito que originou a #112: `0 + "120.00"` concatena em vez de somar.
    const soma = projecao.series.reduce((s, v) => s + v, 0);
    expect(Number.isFinite(soma)).toBe(true);
  });

  it('a moeda da meta sobrevive ao desembrulho', async () => {
    // `unwrapMoney` descarta a moeda de DENTRO do valor; `currency` no topo é
    // atributo da meta, e é por ele que a tela sabe o que está mostrando.
    responde(goalProjection);

    expect(typeof (await getGoalProjection('org', 'g')).currency).toBe('string');
  });

  it('o patrimônio ausente continua null, e nunca vira zero', async () => {
    responde(consultantFamily.clients);

    const { clients } = await getConsultantClients();

    const ausente = clients.find((c) => c.patrimonio === null);
    const presente = clients.find((c) => c.patrimonio !== null);
    // `null` = "não deu para consolidar"; zero afirmaria que ele não tem patrimônio.
    expect(ausente).toBeDefined();
    expect(typeof presente?.patrimonio).toBe('number');
  });

  it('o patrimônio do painel de saúde é somável, não NaN', async () => {
    responde(healthFamily.financial_health_score);

    const saude = await getFinancialHealth('org');

    // Sem desembrulho, `Number({…})` é NaN e a tela mostra "R$ NaN".
    expect(Number.isFinite(Number(saude.patrimonio_liquido))).toBe(true);
    expect(Number(saude.ativo) - Number(saude.passivo)).toBeCloseTo(Number(saude.patrimonio_liquido), 2);
  });

  it('a razão e a contagem de meses NÃO são embrulhadas em dinheiro', async () => {
    responde(healthFamily.financial_health_score);

    const saude = await getFinancialHealth('org');

    // `emergency_fund_months` é tempo. Embrulhá-lo diria que 3,5 meses são reais.
    expect(typeof saude.income_commitment).toBe('number');
    expect(saude.emergency_fund_months === null || typeof saude.emergency_fund_months === 'number').toBe(true);
  });
});
