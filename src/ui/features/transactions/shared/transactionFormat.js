import { T } from "../../../tokens";

/** `shortDateLabel` com identidade estável — ver `cacheDeRotuloDeData`. */
export function rotuloDeData(raw) {
  const hoje = new Date();
  const chave = `${raw}|${hoje.getFullYear()}-${hoje.getMonth()}-${hoje.getDate()}`;
  let v = cacheDeRotuloDeData.get(chave);
  if (v === undefined) {
    v = shortDateLabel(raw, hoje);
    /* Teto simples: a chave inclui a data de hoje, então o cache rotaciona
       sozinho a cada dia; o limite só existe para uma sessão que role por
       milhares de datas distintas. */
    if (cacheDeRotuloDeData.size > 2000) cacheDeRotuloDeData.clear();
    cacheDeRotuloDeData.set(chave, v);
  }
  return v;
}


export const CAT_COLORS = {
  Alimentação: "#059669",
  Transporte: "#2563EB",
  Moradia: "#6B7280",
  Saúde: "#DC2626",
  Receita: "#059669",
  Assinaturas: "#7C3AED",
  "Assinaturas & Software": "#0891B2",
  Streaming: "#7C3AED",
  Lazer: "#D97706",
  "Lazer & Entretenimento": "#D97706",
  Compras: "#0891B2",
  "Compras Pessoais": "#DC2626",
  Educação: "#7C3AED",
  Outros: "#374151",
  Serviços: "#6B7280",
  "Impostos & Taxas": "#D97706",
  Vestuário: "#BE185D",
};
export const catColor = (label) => CAT_COLORS[label] || T.inkMid;

/** "20/08/2026" -> { top: "20 ago", sub: "qua" }. Duas linhas curtas cabem numa
 *  coluna de 54 px sem quebrar; a data por extenso não cabia. */
const MONTHS_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WEEKDAYS_SHORT = ["dom","seg","ter","qua","qui","sex","sáb"];
/* Cache por data. `shortDateLabel` devolve um OBJETO ({top, sub}), e a linha o
   recebe como prop: sem cache, cada render inventava um objeto novo para a
   mesma data e a memoização da linha caía por completo. Medido: esta prop
   sozinha respondia por 526 das quebras de igualdade ao abrir a dock.
   A chave inclui o dia de hoje porque "hoje"/"ontem" dependem dele — virar o
   dia com a aba aberta tem de reescrever os rótulos. */
const cacheDeRotuloDeData = new Map();

export function shortDateLabel(raw, today = new Date()) {
  if (!raw) return { top: "—", sub: "" };
  const parts = String(raw).split("/");
  if (parts.length < 2) return { top: String(raw).slice(0, 6), sub: "" };
  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = parts.length === 3 ? Number(parts[2]) : today.getFullYear();
  if (!Number.isFinite(day) || !Number.isFinite(month) || month < 0 || month > 11) {
    return { top: String(raw).slice(0, 6), sub: "" };
  }
  const d = new Date(year, month, day);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const top = `${String(day).padStart(2, "0")} ${MONTHS_SHORT[month]}`;
  if (sameDay(d, today)) return { top, sub: "hoje" };
  if (sameDay(d, yesterday)) return { top, sub: "ontem" };
  return { top, sub: WEEKDAYS_SHORT[d.getDay()] || "" };
}
export const catBg = (label) => `${catColor(label)}18`;

export function transactionStatus(status) {
  return status === "confirmado"
    ? { label: "✓ Confirmado", background: T.greenLight, color: T.green }
    : { label: "⏳ Pendente", background: T.amberLight, color: T.amber };
}

export const fmtBRL = v => "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});

/* O valor de uma LINHA na moeda dela, não na base da organização.
 *
 * A lista mostra lançamentos de contas em moedas diferentes lado a lado, e cada
 * um é o dinheiro dele mesmo — nada aqui é agregado, então não há o que
 * converter. Formatar tudo com "R$" fazia um gasto de 100 euros aparecer como
 * "R$ 100,00": o número certo com a unidade errada, que é pior que um número
 * faltando porque parece conferível.
 *
 * Sem moeda declarada cai no real, que é o que toda organização de moeda única
 * sempre viu. */
export const fmtValorDaLinha = (v, moeda) => {
  if (!moeda || moeda === "BRL") return fmtBRL(v);
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda,
    }).format(Math.abs(v));
  } catch {
    return `${moeda}\u00a0${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  }
};
