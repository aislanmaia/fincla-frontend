// Os 8 passos da conciliação (spec fincla-api#507), na ordem e com os textos do protótipo
// aprovado. Nesta entrega (#508) todo lançamento lido é "novo"; os passos que ainda não têm
// conteúdo aparecem no trilho e dizem que não há nada a fazer.
import { plural } from "../../plural.js";

export const STEPS = [
  {
    key: "suggested",
    title: "Confirmar lançamentos encontrados",
    todo: "O Fincla achou estes lançamentos do banco já registrados no Fincla. Confira se cada par está certo.",
  },
  {
    key: "doubt",
    title: "Decidir casos com dúvida",
    todo: "Aqui ficam os lançamentos com mais de uma opção parecida ou com uma pequena diferença de valor.",
  },
  {
    key: "invoice",
    title: "Conferir pagamento de fatura",
    todo: "Aqui aparece o pagamento de fatura de cartão que o banco mostra no extrato.",
  },
  {
    key: "yield",
    title: "Revisar rendimentos pequenos",
    todo: "Aqui ficam os rendimentos de centavos, que dá para somar em um lançamento só no mês.",
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
    todo: "Compare o saldo do banco com o do Fincla, já com as suas respostas.",
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
  if (stepKey === "new") return entries.filter((e) => e.classification === "new" && e.answer === "create");
  // Não somem: o que não vira transação (hoje só valor zero) fica visível aqui.
  if (stepKey === "outside") return entries.filter((e) => e.answer === "ignore");
  return [];
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
  if (passed) return { tone: "done", text: "Conferido" };
  if (!entries.length) return { tone: "neutral", text: "Nada a fazer" };
  if (INFO_ONLY.has(stepKey)) return { tone: "neutral", text: `Nada a fazer · ${plural(entries.length, "não vira transação", "não viram transação")}` };
  return { tone: "ready", text: `${plural(entries.length, "lançamento", "lançamentos")} · falta você conferir` };
}

/** Por que "Concluir conciliação" está bloqueado, em português. */
export function blockerText(blocker) {
  if (blocker.code === "missing_description") {
    return `${plural(blocker.count, "lançamento novo sem descrição", "lançamentos novos sem descrição")}. Escreva a descrição em Adicionar lançamentos novos.`;
  }
  return `${plural(blocker.count, "lançamento sem resposta", "lançamentos sem resposta")}. Responda todos para concluir.`;
}
