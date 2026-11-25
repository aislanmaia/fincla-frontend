// Os 8 passos da conciliação da fatura do cartão (spec fincla-api#554), com os textos do protótipo
// v16. É o segundo conjunto de passos, ao lado do `STEPS` do extrato (`reconciliationSteps.js`):
// mesmo molde, palavras de fatura ("compras", "lançamentos"). A primeira entrega (#555) responde o
// passo 1, a terceira (#557) o passo 5 "Compras novas", a quarta (#558) o passo 4 "Encargos, tarifas
// e estornos", onde o grupo de encargos é UM item da fila, e a quinta (#559) os passos 2 "Compras em
// outra fatura" e 3 "Decidir casos com dúvida": desde ela todo passo de lançamentos responde (o "Fica
// de fora nesta versão" só sobra para o que o backend ainda mandar só leitura). Cada fluxo tem a sua contagem de passos (decisão 9): o progresso conta os 6 passos de
// lançamentos, como no protótipo.
import { plural } from "../../plural.js";
import { isAnswered } from "./entryQueue.jsx";

export const INVOICE_STEPS = [
  {
    key: "suggested",
    title: "Confirmar compras encontradas",
    todo: "O Fincla achou estas compras do banco já lançadas nesta fatura. Confira se cada par está certo.",
    then: "Parcela com alguns centavos de diferença: vale o valor do banco.",
  },
  {
    key: "other_invoice",
    title: "Compras em outra fatura",
    todo: "Estas compras o banco cobrou nesta fatura, mas no Fincla estão em outra. Diga se movemos para esta.",
    then: "Compra parcelada: dá para mover a parcela sozinha ou a série inteira.",
  },
  {
    key: "doubt",
    title: "Decidir casos com dúvida",
    todo: "Aqui há mais de uma opção parecida ou uma pequena diferença de valor. Responda se a compra já está no Fincla.",
  },
  {
    key: "charges",
    title: "Encargos, tarifas e estornos",
    todo: "Juros, multa, IOF, anuidade e estornos que o banco lançou. Confira se já estão no Fincla — às vezes somados numa transação só.",
  },
  {
    key: "new",
    title: "Compras novas",
    todo: "Estas compras não estão no Fincla. Confira a descrição e a categoria de cada uma.",
  },
  {
    key: "leftover",
    title: "Sobrando no Fincla",
    todo: "Itens desta fatura no Fincla que o banco não cobrou. Decida o que fazer com cada um.",
  },
  {
    key: "total",
    title: "Conferir o total",
    todo: "Compare o total da fatura do banco com o da fatura no Fincla, já com as suas respostas.",
  },
  {
    key: "summary",
    title: "Revisar e concluir",
    todo: "Veja tudo o que vai acontecer. Você ainda pode voltar a qualquer passo e mudar.",
  },
];

export const INVOICE_STEP_KEYS = INVOICE_STEPS.map((s) => s.key);

/** Os passos de lançamentos (os que mostram os lançamentos do banco, pela classificação). */
export const INVOICE_ENTRY_STEPS = new Set(["suggested", "other_invoice", "doubt", "charges", "new"]);

/** Os passos que contam no progresso: os de lançamentos e "Sobrando no Fincla" (como no protótipo). */
export const INVOICE_PROGRESS_STEPS = INVOICE_STEPS.filter((s) => s.key !== "total" && s.key !== "summary");

/** O traço do trilho antes de "Conferir o total": os dois últimos passos vêm depois dos lançamentos. */
export const INVOICE_RAIL_SEPARATOR = new Set(["total"]);

/**
 * Já conferidos por uma conciliação concluída deste cartão (reimportação, fincla-api#556): só
 * leitura, mostrados no passo 1 como "já conferido". Nada acontece com eles ao concluir.
 */
export const reconciledEntries = (entries) => entries.filter((e) => e.classification === "reconciled");

/** Os lançamentos da fatura que pertencem a um passo (a classificação é fixa). */
export function invoiceEntriesOfStep(stepKey, entries) {
  if (!INVOICE_ENTRY_STEPS.has(stepKey)) return [];
  return entries.filter((e) => e.classification === stepKey);
}

/** O item da fila que é o grupo de encargos (#558), e não um lançamento. */
export const CHARGE_GROUP = "charge_group";
export const isChargeGroupItem = (item) => item?.kind === CHARGE_GROUP;

/**
 * O grupo de encargos como um item da fila do passo 4 (#558): a resposta e o confirmar são do
 * grupo; `members` são os lançamentos dele, na ordem do banco. `date` é a do último (a do par).
 */
export function chargeGroupItem(group, entries) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const members = group.entry_ids.map((id) => byId.get(id)).filter(Boolean);
  return {
    kind: CHARGE_GROUP,
    id: group.id,
    group,
    members,
    classification: "charges",
    answer: group.answer,
    confirmed: group.confirmed,
    answerable: group.answerable,
    amount: group.total,
    currency: group.currency,
    date: members.at(-1)?.date ?? "",
  };
}

/**
 * Os itens de um passo, como a fila os mostra: no passo 4 o grupo de encargos vem primeiro, como um
 * item só, no lugar dos lançamentos dele (nenhum é respondido sozinho, #558). Nos outros passos, os
 * lançamentos.
 */
export function invoiceStepItems(stepKey, invoiceImport) {
  const entries = invoiceEntriesOfStep(stepKey, invoiceImport.entries);
  const groups = stepKey === "charges" ? (invoiceImport.charge_groups ?? []) : [];
  if (!groups.length) return entries;
  const grouped = new Set(groups.flatMap((g) => g.entry_ids));
  return [...groups.map((g) => chargeGroupItem(g, invoiceImport.entries)), ...entries.filter((e) => !grouped.has(e.id))];
}

/**
 * Quantos itens, com o grupo de encargos (#558) pelo nome: "1 grupo de encargos", "1 grupo de
 * encargos e 2 lançamentos", "3 lançamentos". O grupo é um item da fila, mas não é "um lançamento".
 */
export function itemsCountText(items, one = "lançamento", many = "lançamentos") {
  const groups = items.filter(isChargeGroupItem).length;
  const rest = items.length - groups;
  return [
    groups ? plural(groups, "grupo de encargos", "grupos de encargos") : null,
    rest || !groups ? plural(rest, one, many) : null,
  ].filter(Boolean).join(" e ");
}

/** "Mover para esta fatura" / "Mover só esta" e "Mover esta e as próximas" (#559). */
export const MOVE_ANSWERS = new Set(["move", "move_series"]);
export const isMoveAnswer = (answer) => MOVE_ANSWERS.has(answer);

/**
 * "Mover esta e as próximas" é uma opção para esta parcela (o lançamento do passo 2, ou uma opção da
 * dúvida/busca)? Não numa série uma fatura atrás (`series_movable: false` sem `move_refusal`, #559):
 * lá ela nunca vale, e a parcela se move sozinha, como uma compra à vista. Desligada COM motivo, ela
 * continua à vista, com o motivo.
 */
export const seriesIsAnOption = (item) => Boolean(item.series_movable || item.move_refusal || item.answer === "move_series");

// A folga de uma dúvida (fincla-api#559, a mesma do backend): até R$ 1,00 do valor do banco; numa
// compra internacional, até 5% dele (decisão 4 do Owner).
export const DOUBT_AMOUNT_TOLERANCE = 1;
export const INTERNATIONAL_DOUBT_RATIO = 0.05;

/**
 * O valor do Fincla está além da folga de uma dúvida? Só a busca chega a uma compra assim (QA F5
 * OBS-03): escolhê-la troca o valor pelo do banco ao concluir, e a tela diz isso com os dois valores.
 */
export function beyondDoubtTolerance(entry, value) {
  const bank = Math.abs(Number(entry.amount));
  const gap = Math.abs(Number(value) - bank);
  const limit = entry.section === "international" ? bank * INTERNATIONAL_DOUBT_RATIO : DOUBT_AMOUNT_TOLERANCE;
  return gap - limit >= 0.005;
}

/** A resposta liga o lançamento a uma compra do Fincla (a desta fatura, ou a movida de outra). */
export const linksTransaction = (answer) => answer === "pair" || isMoveAnswer(answer);

/** Os que a pessoa responde neste passo (os outros são "Fica de fora nesta versão"). */
export const answerableEntries = (entries) => entries.filter((e) => e.answerable);

const blankDescription = (entry) => !String(entry.description ?? "").trim();

/**
 * "Adicionar" com a descrição vazia: bloqueia o concluir (fincla-api#557). No grupo de encargos
 * (#558), "Não, adicionar cada um" com um lançamento sem descrição.
 */
export const missingDescription = (entry) => {
  if (entry.answer !== "create") return false;
  return isChargeGroupItem(entry) ? entry.members.some(blankDescription) : blankDescription(entry);
};

/**
 * Sem resposta (os "Fica de fora nesta versão" já vêm respondidos). Uma compra nova sem descrição
 * conta como sem resposta, como no extrato: o Confirmar fica desligado até ela ter descrição.
 */
export const pendingEntries = (entries) => entries.filter((e) => e.answerable && (e.answer === null || missingDescription(e)));

/** Respondidos e ainda não confirmados (a sugestão que vem marcada "Sim, é esta"). */
export const unconfirmedEntries = (entries) => entries.filter((e) => e.answerable && e.answer !== null && !e.confirmed);

/**
 * O que falta num passo, pelo estado de cada item (QA F4 OBS-03): os sem resposta ("Falta responder",
 * âmbar no trilho) e as escolhas que já vêm marcadas e só faltam confirmar ("escolhas para confirmar",
 * azul no trilho). O cabeçalho da lista e o aviso do rodapé usam as mesmas palavras do trilho.
 */
export function stepRemaining(items, one = "lançamento", many = "lançamentos") {
  const unanswered = pendingEntries(items);
  const waiting = new Set(unanswered);
  const toConfirm = unconfirmedEntries(items).filter((e) => !waiting.has(e)).length;
  const what = unanswered.length ? itemsCountText(unanswered, one, many) : "";
  const choices = plural(toConfirm, "escolha", "escolhas");
  let footer = null;
  if (unanswered.length && toConfirm) footer = `Falta responder ${what} e confirmar ${choices} deste passo`;
  else if (unanswered.length) footer = `Falta responder ${what} deste passo`;
  else if (toConfirm) footer = `Falta confirmar ${choices} deste passo`;
  const header = [
    unanswered.length ? plural(unanswered.length, "sem resposta", "sem resposta") : null,
    toConfirm ? plural(toConfirm, "escolha para confirmar", "escolhas para confirmar") : null,
  ].filter(Boolean).join(" · ") || null;
  return { unanswered: unanswered.length, toConfirm, header, footer };
}

/** As sugestões ainda sem a confirmação da pessoa ("Confirmar as N de uma vez"). */
export const unconfirmedInvoiceSuggestions = (entries) =>
  entries.filter((e) => e.answerable && e.classification === "suggested" && e.answer === "pair" && !e.confirmed);

/**
 * Respondido = confirmado pela pessoa: a sugestão ("Sim, é esta" já marcado) e a compra nova
 * ("Adicionar" já marcado, #557) só depois do Confirmar; uma resposta escolhida já confirma.
 */
export const isInvoiceEntryAnswered = (entry) => {
  if (entry.answerable && !entry.confirmed) return false;
  if (isChargeGroupItem(entry)) return entry.answer !== null && !missingDescription(entry);
  return isAnswered(entry);
};

/** O primeiro passo com algo a responder; sem nenhum, o resumo. */
export function firstInvoiceStepWithWork(entries) {
  const step = INVOICE_STEPS.find((s) => answerableEntries(invoiceEntriesOfStep(s.key, entries)).length > 0);
  return step ? step.key : "summary";
}

/**
 * Estado de um passo no trilho (protótipo v16): "N lançamentos para responder" (âmbar), "N escolhas
 * para confirmar" (azul), "Pronto · falta você conferir" (azul), "Conferido" (verde). Um passo fica
 * Conferido quando a pessoa sai dele com tudo respondido e confirmado (`passed`). Os que esta versão
 * ainda não responde dizem quantos ficam de fora; os vazios, que não há nada a fazer.
 */
export function invoiceStepStatus(stepKey, invoiceImport, passed) {
  if (stepKey === "total") return { tone: "neutral", text: "Depois dos lançamentos" };
  if (stepKey === "summary") return { tone: "neutral", text: "Último passo" };
  const entries = invoiceStepItems(stepKey, invoiceImport);
  // Os já conferidos (reimportação) aparecem no passo 1, só para leitura.
  const conferred = stepKey === "suggested" ? reconciledEntries(invoiceImport.entries).length : 0;
  const pending = pendingEntries(entries);
  if (pending.length) return { tone: "warn", text: `${itemsCountText(pending)} para responder` };
  const unconfirmed = unconfirmedEntries(entries).length;
  if (unconfirmed) return { tone: "ready", text: plural(unconfirmed, "escolha para confirmar", "escolhas para confirmar") };
  if (passed) return { tone: "done", text: "Conferido" };
  if (answerableEntries(entries).length) return { tone: "ready", text: "Pronto · falta você conferir" };
  if (entries.length) return { tone: "neutral", text: `Nada a fazer · ${plural(entries.length, "fica de fora nesta versão", "ficam de fora nesta versão")}` };
  if (conferred) return { tone: "neutral", text: `Nada a fazer · ${plural(conferred, "já conferido", "já conferidos")}` };
  return { tone: "neutral", text: "Nada a fazer" };
}

/** "Seu progresso: N de 6 passos conferidos". */
export function invoiceStepProgress(invoiceImport, passed) {
  const done = INVOICE_PROGRESS_STEPS.filter((s) => invoiceStepStatus(s.key, invoiceImport, passed.has(s.key)).tone === "done").length;
  return { done, total: INVOICE_PROGRESS_STEPS.length };
}

/** O nome do mês da fatura ("dezembro/2026"). */
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const invoiceMonthName = (month) => MONTHS[(Number(month) || 1) - 1];
export const invoiceMonthLabel = ({ year, month }) => `${invoiceMonthName(month)}/${year}`;

/**
 * A fatura de uma opção da dúvida ou da busca que o backend não sabe dizer (`invoice: null`, #559):
 * a tela escreve "não sabemos", nunca um mês inventado.
 */
export const UNKNOWN_INVOICE = Object.freeze({ id: null, year: null, month: null, status: null, unknown: true });

/** "janeiro/2027", ou "não sabemos" para a fatura desconhecida. */
export const invoiceWhereLabel = (invoice) => (!invoice || invoice.unknown ? "não sabemos" : invoiceMonthLabel(invoice));

/** "03" de 3: a parcela como o banco imprime. */
export const pad2 = (n) => String(n).padStart(2, "0");

/**
 * As parcelas que a compra nova cria ao concluir, pela opção escolhida (#557, decisão 5): a compra
 * inteira (1..M) ou só daqui em diante (N..M). À vista: nenhuma (é uma transação só).
 */
export function createdInstallments(entry) {
  const purchase = entry.new_purchase;
  if (!purchase || !entry.installment) return [];
  if (entry.installments_scope === "from_current") return purchase.installments.filter((i) => i.number >= entry.installment.number);
  return purchase.installments;
}

/** Quantas transações a compra nova vira ao concluir: as parcelas criadas, ou 1 à vista. */
export const createdTransactionCount = (entry) => (entry.new_purchase && entry.installment ? createdInstallments(entry).length : 1);

/**
 * As contagens de "Revisar e concluir", uma linha por efeito que exista (protótipo v16). Nesta
 * versão: compras ligadas, parcelas com o valor do banco, transações novas (#557) e lançamentos não
 * registrados (com os que ficam de fora nesta versão).
 */
export function invoiceSummaryRows(invoiceImport) {
  const entries = invoiceImport.entries;
  const pairs = entries.filter((e) => e.answer === "pair");
  // O valor do banco vale também na compra movida (#559).
  const bankValue = entries.filter((e) => linksTransaction(e.answer) && e.value_change !== null).length;
  const ignored = entries.filter((e) => e.answer === "ignore");
  const readOnly = ignored.filter((e) => !e.answerable).length;
  const rows = [];
  const row = (count, one, many, testId, note = null) => {
    if (count) rows.push({ count, text: count === 1 ? one : many, testId, note });
  };
  row(pairs.length, "compra já estava no Fincla e fica ligada ao banco", "compras já estavam no Fincla e ficam ligadas ao banco", "summary-paired");
  row(bankValue, "compra passa a ter o valor do banco", "compras passam a ter o valor do banco", "summary-bank-value");
  // Compras em outra fatura (#559): a compra (ou só a parcela) que vem para esta fatura, e as séries
  // que voltam uma fatura desta parcela em diante.
  const moved = entries.filter((e) => e.answer === "move");
  const movedInstallments = moved.filter((e) => e.installment).length;
  row(
    moved.length,
    "compra sai de outra fatura e entra nesta",
    "compras saem de outra fatura e entram nesta",
    "summary-moved",
    movedInstallments ? `${plural(movedInstallments, "parcela muda", "parcelas mudam")} sozinha${movedInstallments === 1 ? "" : "s"}: as outras da compra ficam onde estão` : null,
  );
  row(
    entries.filter((e) => e.answer === "move_series").length,
    "série de parcelas volta uma fatura, desta parcela em diante",
    "séries de parcelas voltam uma fatura, desta parcela em diante",
    "summary-moved-series",
  );
  // O grupo de encargos somado numa transação (#558): os lançamentos ficam ligados a ela, nada mais muda.
  const summed = entries.filter((e) => e.answer === "pair_sum");
  const summedInto = (invoiceImport.charge_groups ?? []).find((g) => g.answer === "pair_sum")?.fincla_transaction?.description;
  row(
    summed.length,
    "encargo já estava somado no Fincla",
    "encargos já estavam somados no Fincla",
    "summary-summed-charges",
    summedInto ? `em “${summedInto}”, que fica ligada a ${summed.length === 1 ? "ele" : "todos eles"}` : null,
  );
  // Compras novas (#557): as transações que entram, com as parcelas das parceladas.
  const creates = entries.filter((e) => e.answer === "create");
  const transactions = creates.reduce((sum, e) => sum + createdTransactionCount(e), 0);
  const paidInstallments = creates.reduce((sum, e) => sum + createdInstallments(e).filter((i) => i.invoice_paid).length, 0);
  const refunds = creates.filter((e) => e.transaction_type === "refund").length;
  const createdNote = [
    transactions !== creates.length ? `de ${plural(creates.length, "compra", "compras")}, com as parcelas` : null,
    refunds ? `${plural(refunds, "estorno diminui", "estornos diminuem")} o total da fatura` : null,
    paidInstallments ? `${plural(paidInstallments, "parcela entra", "parcelas entram")} já paga${paidInstallments === 1 ? "" : "s"} em fatura já paga` : null,
  ].filter(Boolean).join(" · ") || null;
  row(transactions, "transação nova entra no Fincla", "transações novas entram no Fincla", "summary-created", createdNote);
  row(
    reconciledEntries(entries).length,
    "lançamento já foi conferido numa conciliação anterior: nada muda nele",
    "lançamentos já foram conferidos numa conciliação anterior: nada muda neles",
    "summary-already-reconciled",
  );
  row(
    ignored.length,
    "lançamento não será registrado",
    "lançamentos não serão registrados",
    "summary-ignored",
    readOnly ? `${plural(readOnly, "fica de fora nesta versão", "ficam de fora nesta versão")}` : null,
  );
  return rows;
}
