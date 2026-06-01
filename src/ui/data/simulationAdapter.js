import { simulateFinancialImpact } from "../../api/financialImpact";
import { handleApiError } from "../../api/client";

export function mapScenarioToApiRequest(organizationId, items, simulationMonths = 12) {
  const newCardCommitments = items
    .filter((item) => item.tipo === "despesa_parcelada" && !item.isReceita)
    .map((item) => ({
      card_last4: "",
      value: Math.abs(item.total),
      installments_count: item.parcelas || 1,
      description: item.nome,
    }));

  return {
    organization_id: organizationId,
    new_card_commitments:
      newCardCommitments.length > 0 ? newCardCommitments : undefined,
    simulation_months: simulationMonths,
  };
}

export async function simulateForUi(organizationId, items, simulationMonths = 12) {
  const request = mapScenarioToApiRequest(organizationId, items, simulationMonths);
  return await simulateFinancialImpact(request);
}

export function formatSimulationApiError(error) {
  return handleApiError(error) || "Erro ao simular cenário.";
}

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function fmtMonthLabel(isoMonth) {
  const [y, m] = isoMonth.split("-");
  return `${MONTH_LABELS[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

export function deriveRisksFromResponse(response, fmtCurrency) {
  const risks = [];
  const months = response?.months ?? [];
  const dangerMonths = months.filter((m) => m.status === "danger");
  const warningMonths = months.filter((m) => m.status === "warning");
  const successMonths = months.filter((m) => m.status === "success");

  if (dangerMonths.length > 0) {
    const first = dangerMonths[0];
    risks.push({
      nivel: "ALTO",
      color: "#DC2626",
      dot: "#EF4444",
      title: `Estouro do orçamento em ${fmtMonthLabel(first.month)}`,
      desc: `A simulação ultrapassa o orçamento em ${fmtCurrency(Math.abs(num(first.balance)))} em ${dangerMonths.length} ${dangerMonths.length === 1 ? "mês" : "meses"}.`,
    });
  }

  if (warningMonths.length > 0) {
    risks.push({
      nivel: "MÉDIO",
      color: "#D97706",
      dot: "#F59E0B",
      title: "Margem apertada em alguns meses",
      desc: `${warningMonths.length} ${warningMonths.length === 1 ? "mês exige" : "meses exigem"} atenção — o saldo fica próximo do limite.`,
    });
  }

  if (months.length > 0 && successMonths.length === months.length) {
    risks.push({
      nivel: "BAIXO",
      color: "#059669",
      dot: "#10B981",
      title: "Fluxo sustentável no período",
      desc: "Todos os meses ficam dentro do orçamento projetado.",
    });
  } else if (successMonths.length > 0) {
    risks.push({
      nivel: "BAIXO",
      color: "#059669",
      dot: "#10B981",
      title: `${successMonths.length} ${successMonths.length === 1 ? "mês" : "meses"} dentro do orçamento`,
      desc: `Após os meses críticos, o fluxo se normaliza.`,
    });
  }

  return risks;
}

// Os campos numéricos do backend chegam como string (Decimal serializado).
// `num` normaliza para Number, tolerando null/undefined/strings vazias.
function num(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lê os totais agregados do summary respeitando o contrato real da API
 * (`total_projected_income`, `total_base_expenses`, etc).
 * Tolerante a snake_case curto (`income`, `base_expenses`) caso o backend
 * evolua para enviar os atalhos.
 */
function summaryTotals(response) {
  const s = response?.summary ?? {};
  return {
    income: num(s.total_projected_income ?? s.income),
    baseExpenses: num(s.total_base_expenses ?? s.base_expenses),
    cardCommitments: num(s.total_card_commitments ?? s.card_commitments),
    savingsGoal: num(s.total_savings_goal ?? s.savings_goal),
  };
}

export function deriveImpactsFromResponse(response, items) {
  const catMap = {};

  for (const item of items) {
    if (item.isReceita) continue;
    const key = item.cat || "Outros";
    if (!catMap[key]) catMap[key] = { cat: key, val: 0 };
    catMap[key].val += Math.abs(item.valParcela || item.total);
  }

  const CAT_ICONS = {
    Tecnologia: "💻",
    Alimentação: "🛒",
    Transporte: "🚗",
    Moradia: "🏠",
    Lazer: "🎮",
    Saúde: "💊",
    Assinaturas: "⚡",
    Renda: "📈",
    Outros: "📦",
  };

  const { baseExpenses } = summaryTotals(response);
  const monthsCount = Array.isArray(response?.months) ? response.months.length : 0;
  const budget = monthsCount > 0 ? baseExpenses / monthsCount : 0;

  return Object.values(catMap)
    .sort((a, b) => b.val - a.val)
    .map((c) => {
      const limite = Math.round(budget * 0.3);
      const pct = limite > 0 ? Math.round((c.val / limite) * 100) : 100;
      return {
        cat: c.cat,
        icon: CAT_ICONS[c.cat] || "🏷️",
        val: Math.round(c.val),
        limite,
        pct,
      };
    });
}

export function deriveRecsFromResponse(response, items) {
  const recs = [];
  const verdict = response.global_verdict;

  const parcelados = items.filter((i) => i.tipo === "despesa_parcelada");
  const recorrentes = items.filter(
    (i) => i.tipo === "despesa_recorrente" && !i.isReceita,
  );

  if (verdict === "high-risk" && parcelados.length > 0) {
    const biggest = parcelados.reduce(
      (max, i) => (Math.abs(i.total) > Math.abs(max.total) ? i : max),
      parcelados[0],
    );
    recs.push({
      emoji: "💡",
      txt: `Considere adiar **${biggest.nome}** para o próximo mês para distribuir o impacto e aliviar o orçamento.`,
    });
  }

  if (verdict !== "viable" && parcelados.length > 0) {
    const p = parcelados[0];
    if (p.parcelas < 18) {
      const novaParcela = (Math.abs(p.total) / 18).toFixed(2);
      recs.push({
        emoji: "📦",
        txt: `Parcelar **${p.nome}** em **18×** reduz o impacto mensal para R$ ${novaParcela}.`,
      });
    }
  }

  if (recorrentes.length > 0 && verdict !== "viable") {
    recs.push({
      emoji: "✂️",
      txt: `Revise as despesas recorrentes — cortar ou reduzir pode liberar margem no orçamento.`,
    });
  }

  if (verdict === "viable") {
    recs.push({
      emoji: "✅",
      txt: "O cenário é **viável**. Todas as projeções ficam dentro da margem segura.",
    });
  }

  if (recs.length === 0) {
    recs.push({
      emoji: "💬",
      txt: "Adicione mais itens ao cenário para receber recomendações personalizadas.",
    });
  }

  return recs;
}

export function deriveChartDataFromResponse(response) {
  return (response?.months ?? []).map((m) => ({
    label: fmtMonthLabel(m.month),
    month: m.month,
    receita: num(m.projected_income),
    despBase: num(m.base_expenses),
    comSim: num(m.total_expenses),
    saldo: num(m.balance),
    status: m.status,
  }));
}

export function deriveKpisFromResponse(response /*, budgetAtivo */) {
  const totals = summaryTotals(response);
  const totalSim = totals.cardCommitments + totals.savingsGoal;
  const totalExpenses = totals.baseExpenses + totalSim;
  const margem = totals.income - totalExpenses;
  const projecaoOk = margem >= 0;
  const lastMonth = Array.isArray(response?.months) && response.months.length > 0
    ? response.months[response.months.length - 1].month
    : null;

  return {
    totalSim,
    totalExpenses,
    income: totals.income,
    baseExpenses: totals.baseExpenses,
    cardCommitments: totals.cardCommitments,
    savingsGoal: totals.savingsGoal,
    margem,
    projecaoOk,
    verdict: response.global_verdict,
    // Mês final da janela de simulação — usado pelo label "Projeção <mês>"
    // (antes hardcoded "março") para refletir dinamicamente o intervalo.
    lastMonthIso: lastMonth,
    lastMonthLabel: lastMonth ? fmtMonthLabel(lastMonth) : null,
  };
}
