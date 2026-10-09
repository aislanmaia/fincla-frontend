import { detailLabelPtForTag } from "../../data/categoryLabels.js";

/**
 * Chips das tags de detalhe da série, no formato que o modal lê do `preConfig`.
 * Calculado só aqui (ao abrir a edição) e não por linha da lista de recorrências.
 */
function buildDetailTagPreConfig(detailTags = []) {
  const detailTagIds = [];
  const detailTagDisplayById = {};
  const detailTagMetaById = {};
  for (const tag of detailTags) {
    const id = String(tag.id);
    const label = detailLabelPtForTag(tag) || `Tag ${id.slice(0, 8)}…`;
    detailTagIds.push(id);
    detailTagDisplayById[id] = label;
    detailTagMetaById[id] = { id, name: label, isActive: tag.is_active !== false };
  }
  return { detailTagIds, detailTagDisplayById, detailTagMetaById };
}

/**
 * Pré-preenchimento do modal ao EDITAR uma série (linha de Recorrências → `preConfig`).
 *
 * Função pura, fora do `onEditar`, para ser testável: a edição já perdeu as tags de
 * detalhe da série aqui, e o modal em si estava certo.
 *
 * Os fallbacks por rótulo (`freq`, `enc`, `metodo`) atendem linhas que não vêm do
 * mapper da API (ex.: recorrências semeadas no onboarding).
 */
export function buildEditRecurringPreConfig(rec) {
  const freqId = rec.freqId || rec.freq?.split(" ")[0]?.toLowerCase() || "mensal";
  const encId =
    rec.encId ||
    (rec.enc === "Após N repetições"
      ? "repeticoes"
      : rec.enc === "Data específica"
        ? "data"
        : "sem-fim");
  const methodId =
    rec.methodId ||
    (rec.metodo === "Pix" ? "pix"
      : rec.metodo === "Boleto" ? "boleto"
      : rec.metodo === "Débito" || rec.metodo === "Débito auto." ? "debito"
      : rec.metodo === "Transferência" ? "transferencia"
      : rec.metodo === "Cartão crédito" ? "credito"
      : "pix");
  return {
    tipo: rec.tipo,
    desc: rec.desc,
    cat: rec.cat,
    categoryTagId: rec.categoryTagId ?? undefined,
    ...buildDetailTagPreConfig(rec.detailTags),
    method: methodId,
    valorInicial: rec.val,
    recorre: true,
    freqRec: freqId,
    encRec: encId,
    dataFimRec: rec.endDateRaw || undefined,
    encEndDateYmdRec: rec.endDateRaw || undefined,
    valorTipoRec: rec.valorTipo || "fixo",
    isEditRecorrencia: true,
    recId: rec.id,
    cartaoId: rec.creditCardId != null ? String(rec.creditCardId) : undefined,
    transactionDate: rec.nextOccurrenceIso || undefined,
    selectedDayOfWeek: rec.dayOfWeek ?? null,
    selectedDayOfMonth: rec.dayOfMonth ?? null,
    customIntervalRec: rec.interval ?? 1,
    customUnitRec: rec.intervalUnit || "month",
    firstOccurrenceYmd: rec.startDateRaw || rec.nextOccurrenceIso || undefined,
  };
}
