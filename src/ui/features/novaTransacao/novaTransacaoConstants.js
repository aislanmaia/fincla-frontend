/* ─── Constantes do drawer Nova Transação ─────────────────── */

/** Cartões "fallback" exibidos no picker quando ainda não há cards carregados da API. */
export const MOCK_CARTOES_MODAL = [
  { id: "nubank", banco: "NUBANK", nome: "Nu Roxinho", dig: "1177", disp: 2400, novo: false },
  { id: "itau", banco: "ITAÚ", nome: "Personnalité", dig: "0034", disp: 8000, novo: false },
  { id: "inter", banco: "INTER", nome: "Mastercard", dig: "5521", disp: 1200, novo: false },
  { id: "novo", banco: "", nome: "+ Novo cartão", dig: "", disp: 0, novo: true },
];

export const NOVA_TX_QUICK_DETAIL_LABELS = ["semanal", "família"];

/* ── Frequência de recorrência ── */
export const FREQ_LABELS = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  anual: "Anual",
  personalizado: "Personalizado",
};
export const FREQ_OPTIONS = ["Semanal", "Quinzenal", "Mensal", "Anual", "Personalizado"];

/** Aceita aliases legados que podem vir de preConfig ou de séries antigas. */
export function normalizeFreqRecId(id) {
  const v = String(id || "").toLowerCase();
  if (v === "diário" || v === "diario") return "mensal";
  if (v === "custom") return "personalizado";
  if (FREQ_LABELS[v]) return v;
  return "mensal";
}

/* ── Encerramento + métodos ── */
export const ENC_LABELS = {
  "sem-fim": "Sem data fim",
  repeticoes: "Após N repetições",
  data: "Data específica",
};
export const MET_LABELS = {
  pix: "Pix",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito",
  transferencia: "Transferência",
};
export const METHODS_DESPESA = [
  ["pix", "Pix"],
  ["debito", "Débito"],
  ["credito", "Crédito"],
  ["dinheiro", "Dinheiro"],
  ["boleto", "Boleto"],
];
export const METHODS_RECEITA = [
  ["pix", "Pix"],
  ["dinheiro", "Dinheiro"],
  ["transferencia", "Transferência"],
];

/* ── Parcelas pré-definidas no picker rápido ── */
export const PARCELA_PRESETS = [2, 3, 4, 6, 8, 10, 12];

/* ── Calendário/datas em PT-BR ── */
export const DOW_LABELS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
export const DOW_LABELS_FULL = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
export const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
export const CUSTOM_UNIT_LABEL = {
  day: ["dia", "dias"],
  week: ["semana", "semanas"],
  month: ["mês", "meses"],
};

/* ── Stamps de hidratação ─────────────────────────────────── */

/**
 * Carimbo estável de `detailTagDisplayById` para entrar em `novaTxModalInitStamp`
 * sem variar a cada renderização.
 */
export function novaTxDetailDisplayStamp(detailTagDisplayById) {
  if (!detailTagDisplayById || typeof detailTagDisplayById !== "object") return "";
  return Object.keys(detailTagDisplayById)
    .sort()
    .map((k) => `${k}=${detailTagDisplayById[k]}`)
    .join(";");
}

/**
 * Carimbo estável do `preConfig` para o modal reaplicar o preenchimento quando o pai
 * atualiza (hidratação da URL, editar com `flushSync` + `navigate`, etc.), sem
 * reexecutar a cada render com o mesmo conteúdo.
 */
export function novaTxModalInitStamp(organizationId, novaRecorrencia, preConfig) {
  const oid = organizationId ?? "";
  if (novaRecorrencia) {
    const pc = preConfig;
    return `${oid}|nr|${pc?.recId ?? ""}|${pc?.isEditRecorrencia ? "1" : "0"}|${pc?.tipo ?? ""}|${String(pc?.valorInicial ?? "")}|${pc?.desc ?? ""}|${pc?.freqRec ?? ""}`;
  }
  const pc = preConfig;
  if (pc == null) return `${oid}|empty`;
  const eid =
    pc.editingTransactionId != null && String(pc.editingTransactionId) !== ""
      ? String(pc.editingTransactionId)
      : "";
  return [
    oid,
    "tx",
    eid,
    pc.desc ?? "",
    String(pc.valorInicial ?? ""),
    pc.cat ?? "",
    String(pc.categoryTagId ?? ""),
    pc.categoryTagIsActive === false ? "0" : "1",
    pc.method ?? "",
    String(pc.cartaoId ?? ""),
    pc.dateIso ?? "",
    pc.dateIsoForEdit ?? "",
    pc.recorre ? "1" : "0",
    pc.modalidade ?? "",
    String(pc.parcelas ?? ""),
    Array.isArray(pc.tags) ? JSON.stringify(pc.tags) : "",
    Array.isArray(pc.detailTagIds) ? pc.detailTagIds.join(",") : "",
    novaTxDetailDisplayStamp(pc.detailTagDisplayById),
    JSON.stringify(pc.detailTagMetaById ?? {}),
    pc.novaRecorrencia ? "1" : "0",
  ].join("|");
}
