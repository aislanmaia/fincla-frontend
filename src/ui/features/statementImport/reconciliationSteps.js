// Os 8 passos da conciliação (spec fincla-api#507), na ordem e com os textos do protótipo
// aprovado. O primeiro passo mostra os pares que o Fincla sugeriu (#510); os passos que ainda
// não têm conteúdo aparecem no trilho e dizem que não há nada a fazer.
import { plural } from "../../plural.js";

export const STEPS = [
  {
    key: "suggested",
    title: "Confirmar lançamentos encontrados",
    todo: "O Fincla achou estes lançamentos do banco já registrados no Fincla. Confira se cada par está certo.",
    then: "Nada muda no Fincla agora: tudo só é aplicado quando você concluir a conciliação, no último passo.",
  },
  {
    key: "doubt",
    title: "Decidir casos com dúvida",
    todo: "Aqui há mais de uma opção parecida ou uma pequena diferença de valor. Cada cartão mostra a dúvida: responda se o lançamento já está no Fincla.",
    then: "Suas respostas ficam guardadas e só são aplicadas ao concluir a conciliação.",
  },
  {
    key: "invoice",
    title: "Conferir pagamento de fatura",
    todo: "O banco mostra o pagamento de uma fatura de cartão. Só confira se é a fatura certa.",
    then: "Nenhuma transação é criada. Ao concluir a conciliação, a fatura fica paga na data do banco.",
  },
  {
    key: "yield",
    title: "Revisar rendimentos pequenos",
    todo: "Rendimentos de centavos. Some todos em um lançamento só no mês, ou deixe adicionar um por um.",
    then: "Nada é adicionado agora: só quando você concluir a conciliação.",
  },
  {
    key: "new",
    title: "Adicionar lançamentos novos",
    todo: "Estes lançamentos do banco não estão no Fincla. Confira a descrição e a categoria de cada um.",
    then: "Eles só entram no Fincla quando você concluir a conciliação.",
  },
  {
    key: "outside",
    title: "Ver o que fica de fora",
    todo: "Nada a fazer aqui. Mostra o que já foi conferido antes e o que é anterior ao início da conta.",
  },
  {
    key: "balance",
    title: "Conferir o saldo",
    todo: "Compare o saldo do banco com o do Fincla, dia a dia, já com as suas respostas.",
    then: "Excluir ou mudar data aqui também só vale ao concluir. Se sobrar diferença, dá para concluir mesmo assim: ela fica registrada.",
  },
  {
    key: "summary",
    title: "Revisar e concluir",
    todo: "Veja tudo o que vai acontecer. Você ainda pode voltar a qualquer passo e mudar.",
    then: "Nada muda no Fincla até você clicar em Concluir conciliação.",
  },
];

/** Os lançamentos do extrato que pertencem a um passo. */
export function entriesOfStep(stepKey, entries) {
  // A sugestão fica no seu passo qualquer que seja a resposta: dá para voltar a ela ali mesmo.
  if (stepKey === "suggested") return entries.filter((e) => e.classification === "suggested");
  // Dúvidas (fincla-api#511): começam sem resposta e continuam aqui depois de respondidas.
  if (stepKey === "doubt") return entries.filter((e) => e.classification === "doubt");
  // Pagamento de fatura (fincla-api#512): já decidido, sem resposta a dar; só conferir.
  if (stepKey === "invoice") return entries.filter((e) => e.classification === "invoice");
  // Os respondidos continuam no passo (Não registrar minimizado, somados dentro da soma): nada some.
  if (stepKey === "new") return entries.filter((e) => e.classification === "new" && e.amount !== 0);
  if (stepKey === "yield") return entries.filter((e) => e.classification === "yield" && e.amount !== 0);
  // "Ver o que fica de fora" (fincla-api#516): já conferidos numa importação anterior, anteriores
  // ao início do saldo da conta (inclusive os trazidos de volta, que continuam aqui com o cartão) e
  // valor zero, que não move dinheiro.
  if (stepKey === "outside") {
    return entries.filter((e) => LEFT_OUT_CLASSES.has(e.classification) || (e.classification === "new" && e.amount === 0));
  }
  return [];
}

const LEFT_OUT_CLASSES = new Set(["reconciled", "before_start"]);

/** Os do passo "Ver o que fica de fora" que continuam fora (não os trazidos de volta). */
export function stillLeftOut(entries) {
  return entries.filter((e) => e.answer === "reconciled" || e.answer === "ignore");
}

/** Passos que só mostram, sem nada a responder. */
const INFO_ONLY = new Set(["outside"]);

/** O primeiro passo com algo a responder; sem nenhum, o resumo. */
export function firstStepWithWork(entries) {
  const step = STEPS.find((s) => !INFO_ONLY.has(s.key) && entriesOfStep(s.key, entries).length > 0);
  return step ? step.key : "summary";
}

/**
 * Estado de um passo no trilho. `passed` = a pessoa já saiu dele: um passo só fica
 * "Conferido" depois que ela passa por ele, mesmo que não haja nada a responder.
 */
export function stepStatus(stepKey, statementImport, passed) {
  if (stepKey === "balance") return { tone: "neutral", text: passed ? "Conferido" : "Depois dos lançamentos" };
  if (stepKey === "summary") return { tone: "neutral", text: "Último passo" };
  const entries = entriesOfStep(stepKey, statementImport.entries);
  if (stepKey === "new") {
    const missing = statementImport.summary.missing_description;
    if (missing) return { tone: "warn", text: plural(missing, "lançamento sem descrição", "lançamentos sem descrição") };
  }
  if (stepKey === "doubt") {
    const pending = entries.filter((e) => e.answer === null).length;
    if (pending) return { tone: "warn", text: plural(pending, "lançamento para responder", "lançamentos para responder") };
  }
  if (passed) return { tone: "done", text: "Conferido" };
  if (!entries.length) return { tone: "neutral", text: "Nada a fazer" };
  if (stepKey === "suggested") {
    const unconfirmed = unconfirmedSuggestions(entries).length;
    if (unconfirmed) return { tone: "ready", text: plural(unconfirmed, "sugestão para confirmar", "sugestões para confirmar") };
    return { tone: "ready", text: "Sugestões prontas · falta você conferir" };
  }
  if (stepKey === "invoice") {
    return { tone: "ready", text: `${plural(entries.length, "pagamento de fatura", "pagamentos de fatura")} · falta você conferir` };
  }
  if (INFO_ONLY.has(stepKey)) {
    const out = stillLeftOut(entries).length;
    const back = entries.length - out;
    const text = `Nada a fazer · ${plural(out, "não vira transação", "não viram transação")}`;
    return { tone: "neutral", text: back ? `${text} · ${plural(back, "trazido de volta", "trazidos de volta")}` : text };
  }
  return { tone: "ready", text: `${plural(entries.length, "lançamento", "lançamentos")} · falta você conferir` };
}

/** Sugestões ainda respondidas "Sim, é esta" sem a pessoa ter confirmado ("Sugerido · falta confirmar"). */
export function unconfirmedSuggestions(entries) {
  return entries.filter((e) => e.classification === "suggested" && e.answer === "pair" && !e.confirmed);
}

/** Por que "Concluir conciliação" está bloqueado, em português. */
export function blockerText(blocker) {
  if (blocker.code === "missing_description") {
    return `${plural(blocker.count, "lançamento novo sem descrição", "lançamentos novos sem descrição")}. Escreva a descrição em Adicionar lançamentos novos.`;
  }
  return `${plural(blocker.count, "lançamento sem resposta", "lançamentos sem resposta")}. Responda todos para concluir (em Decidir casos com dúvida).`;
}
