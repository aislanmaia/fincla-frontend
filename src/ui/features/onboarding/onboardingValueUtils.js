const MONTHS_SHORT_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function parseMoneyInput(value) {
  if (!value) return null;

  const normalized = value
    .toString()
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildOrganizationDescription(orgType) {
  if (orgType === "couple" || orgType === "casal") {
    return "Organizacao de casal criada no onboarding";
  }
  if (orgType === "business" || orgType === "negocio") {
    return "Organizacao de negocio criada no onboarding";
  }
  if (orgType === "personal" || orgType === "outro" || orgType === "other") {
    return "Organizacao pessoal criada no onboarding";
  }
  if (orgType === "familia" || orgType === "family") {
    return "Organizacao familiar criada no onboarding";
  }
  return "Organizacao criada no onboarding";
}

export function formatLocalIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDatePtBr(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatMonthYearPtBr(date) {
  return `${MONTHS_SHORT_PT[date.getMonth()]} ${date.getFullYear()}`;
}

function resolveNextRecurringDate(dayOfMonth, now = new Date()) {
  const day = Number.parseInt(dayOfMonth, 10) || 5;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), now.getMonth(), day);

  if (next < today) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  }

  return next;
}

export function buildImmediateRecurringPreview(data, now = new Date()) {
  const value = parseMoneyInput(data?.recVal);
  if (data?.temRec !== "sim" || value == null || value <= 0) return null;

  const day = Number.parseInt(data?.recDia, 10) || 5;
  const nextDate = resolveNextRecurringDate(day, now);

  return {
    id: "onb-rec-1",
    desc: data?.recDesc || "Receita mensal",
    cat: "Renda",
    val: value,
    dia: day,
    ativa: true,
    proximo: formatDatePtBr(nextDate),
    proximoFull: formatDatePtBr(nextDate),
    tipo: "receita",
    metodo: "Pix",
    freq: `Mensal · dia ${day}`,
    inicio: formatMonthYearPtBr(now),
    enc: "Sem data fim",
    pago: false,
    icone: "💼",
    progPct: 0,
    valorTipo: data?.recTipo || "fixo",
  };
}

export function buildImmediateCreditCardPreview(data) {
  if (data?.temCartao !== "sim" || !data?.cardNome?.trim()) return null;

  const limit = parseMoneyInput(data?.cardLim) || 0;
  const dueDay = Number.parseInt(data?.cardVenc, 10) || 10;

  return {
    id: "onb-card-1",
    banco: data.cardNome,
    nome: data.cardNome,
    dig: "••••",
    bandeira: "Mastercard",
    vencimento: dueDay,
    fechamento: Math.max(1, dueDay - 7),
    limite: limit,
    disponivel: limit,
    cor1: "#1F2937",
    cor2: "#374151",
    corChip: "#9CA3AF",
    corText: "#fff",
    faturas: [],
    itens: [],
    parcelas_ativas: [],
    tendencia: [],
    _empty: true,
  };
}
