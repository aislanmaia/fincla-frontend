// Os 8 passos da conciliação da fatura do cartão (spec fincla-api#554), com os textos do protótipo
// v16. É o segundo conjunto de passos, ao lado do `STEPS` do extrato (`reconciliationSteps.js`):
// mesmo molde, palavras de fatura ("compras", "lançamentos"). A primeira entrega (#555) responde o
// passo 1, a terceira (#557) o passo 5 "Compras novas"; os lançamentos dos outros passos aparecem só
// para leitura, "Fica de fora nesta versão". Cada fluxo tem a sua contagem de passos (decisão 9): o progresso conta os 6 passos de
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

/** Os que a pessoa responde neste passo (os outros são "Fica de fora nesta versão"). */
export const answerableEntries = (entries) => entries.filter((e) => e.answerable);

/** "Adicionar" com a descrição vazia: bloqueia o concluir (fincla-api#557). */
export const missingDescription = (entry) => entry.answer === "create" && !String(entry.description ?? "").trim();

/**
 * Sem resposta (os "Fica de fora nesta versão" já vêm respondidos). Uma compra nova sem descrição
 * conta como sem resposta, como no extrato: o Confirmar fica desligado até ela ter descrição.
 */
export const pendingEntries = (entries) => entries.filter((e) => e.answerable && (e.answer === null || missingDescription(e)));

/** Respondidos e ainda não confirmados (a sugestão que vem marcada "Sim, é esta"). */
export const unconfirmedEntries = (entries) => entries.filter((e) => e.answerable && e.answer !== null && !e.confirmed);

/** As sugestões ainda sem a confirmação da pessoa ("Confirmar as N de uma vez"). */
export const unconfirmedInvoiceSuggestions = (entries) =>
  entries.filter((e) => e.answerable && e.classification === "suggested" && e.answer === "pair" && !e.confirmed);

/**
 * Respondido = confirmado pela pessoa: a sugestão ("Sim, é esta" já marcado) e a compra nova
 * ("Adicionar" já marcado, #557) só depois do Confirmar; uma resposta escolhida já confirma.
 */
export const isInvoiceEntryAnswered = (entry) => (entry.answerable && !entry.confirmed ? false : isAnswered(entry));

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
  const entries = invoiceEntriesOfStep(stepKey, invoiceImport.entries);
  // Os já conferidos (reimportação) aparecem no passo 1, só para leitura.
  const conferred = stepKey === "suggested" ? reconciledEntries(invoiceImport.entries).length : 0;
  const pending = pendingEntries(entries).length;
  if (pending) return { tone: "warn", text: plural(pending, "lançamento para responder", "lançamentos para responder") };
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
  const bankValue = pairs.filter((e) => e.value_change !== null).length;
  const ignored = entries.filter((e) => e.answer === "ignore");
  const readOnly = ignored.filter((e) => !e.answerable).length;
  const rows = [];
  const row = (count, one, many, testId, note = null) => {
    if (count) rows.push({ count, text: count === 1 ? one : many, testId, note });
  };
  row(pairs.length, "compra já estava no Fincla e fica ligada ao banco", "compras já estavam no Fincla e ficam ligadas ao banco", "summary-paired");
  row(bankValue, "compra passa a ter o valor do banco", "compras passam a ter o valor do banco", "summary-bank-value");
  // Compras novas (#557): as transações que entram, com as parcelas das parceladas.
  const creates = entries.filter((e) => e.answer === "create");
  const transactions = creates.reduce((sum, e) => sum + createdTransactionCount(e), 0);
  const paidInstallments = creates.reduce((sum, e) => sum + createdInstallments(e).filter((i) => i.invoice_paid).length, 0);
  const createdNote = [
    transactions !== creates.length ? `de ${plural(creates.length, "compra", "compras")}, com as parcelas` : null,
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
