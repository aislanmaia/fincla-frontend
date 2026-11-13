import { T } from "../../tokens";
import { fmtAbs } from "../../formatters";
import { HEALTH_BAND_NONE, clientHealthBand } from "./consultantClientsView";
import { formatMoney } from "../../money/formatMoney.js";
import { currencyInfo } from "../../money/currencyRegistry.js";

export const DASH = "—";
const LOADING = "…";

/**
 * Formata um valor agregado do consultor distinguindo os 3 estados:
 * carregando ("…"), carregado-vazio ("—") e com dado (via `format`).
 * Compartilhado por `consultantKpis` (KPIs do Painel) para não
 * duplicar a regra de placeholder.
 */
export function aggregateValue(raw, hasLoaded, format) {
  if (raw != null) return format(raw);
  return hasLoaded ? DASH : LOADING;
}

// --- Apresentação por-cliente (compartilhado entre o card e a tabela da carteira) ---

/**
 * Tom (cor/fundo/rótulo) por faixa de saúde 0–100.
 *
 * `health == null` (score ainda não calculado) recebe um tom NEUTRO. Cair no
 * `return` vermelho pintaria de "Em risco" um cliente que ninguém avaliou.
 */
export function healthTone(health) {
  const band = clientHealthBand(health);
  if (band === HEALTH_BAND_NONE) return { color: T.inkGhost, bg: T.grayLight, label: "Sem score" };
  if (band === "healthy") return { color: T.green, bg: T.greenLight, label: "Saudável" };
  if (band === "attention") return { color: T.amber, bg: T.amberLight, label: "Atenção" };
  // "Frágil", não "Em risco": risco é o gatilho por regras do Painel, com motivo.
  return { color: T.red, bg: T.redLight, label: "Frágil" };
}

/**
 * `true` quando a chamada ESQUECEU a moeda — não confundir com `null` explícito,
 * que é "não sabemos a moeda" e vira travessão.
 *
 * Mesmo contrato de `formatters.js` (#310): estes formatadores tinham "BRL" como
 * padrão, e foi por ele que um cliente em dólar aparecia em real na área do
 * consultor (#314). No teste a omissão LANÇA, para a suíte pegar; fora dele, loga
 * e escreve travessão — nunca "R$".
 */
function moedaEsquecida(nome, args) {
  const moeda = args[1];
  const esquecida = args.length < 2 || (moeda != null && typeof moeda !== "string");
  if (!esquecida) return false;
  const msg = `${nome}: moeda ausente — passe a moeda dos valores (ver #314)`;
  if (import.meta.env?.MODE === "test") throw new Error(msg);
  console.error(msg);
  return true;
}

/** O número de `value`, ou `null` quando não há valor (ausência nunca vira zero). */
function numeroOuNulo(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Dinheiro (patrimônio/saldo cru) com sinal só quando negativo. `fmtSgn` força "+".
 *
 * Ausência vira "—", nunca "R$ 0". O backend devolve `patrimonio: null` quando o
 * cliente tem conta em mais de uma moeda e faltou cotação (fincla-api#144) — e ele
 * se recusa a mostrar total parcial justamente para o consultor não decidir sobre
 * um número incompleto. Coagir para zero aqui desfaria a garantia no último metro,
 * e "R$ 0" é pior que "—": afirma que o cliente não tem patrimônio.
 *
 * A moeda é OBRIGATÓRIA: a do cliente (`client.currency`) para um valor dele, a
 * de leitura para um agregado da carteira (#314). `null` = não sabemos → "—".
 */
export function fmtMoney(value, currency) {
  if (moedaEsquecida("fmtMoney", arguments)) return DASH;
  const n = numeroOuNulo(value);
  if (n === null || !currency) return DASH;
  return (n < 0 ? "−" : "") + fmtAbs(n, currency);
}

/** Dinheiro pt-BR sem centavos (R$ 1.234), sinal só quando negativo. Espelha o
 * `fmtBRL0` da referência de design do consultor — o nome mudou porque a moeda
 * deixou de ser sempre real (#314). Ausência de valor ou de moeda vira "—". */
export function fmtMoney0(value, currency) {
  if (moedaEsquecida("fmtMoney0", arguments)) return DASH;
  const bruto = numeroOuNulo(value);
  if (bruto === null || !currency) return DASH;
  const n = Math.round(bruto);
  const { symbol } = currencyInfo(currency);
  return (n < 0 ? "−" : "") + symbol + " " + Math.abs(n).toLocaleString("pt-BR");
}

/**
 * Dinheiro NA MOEDA que veio com ele, ou "—" quando não veio valor.
 *
 * A renda estimada do perfil e os valores do relatório de gastos da carteira saem
 * do backend rotulados `{amount, currency}`; esta é a forma de desenhá-los com o
 * rótulo que trouxeram, no espaçamento do `Intl` (U+00A0).
 *
 * Ausência vira "—", nunca "R$ 0,00": o backend devolve `null` tanto quando não
 * há renda cadastrada quanto quando não deu para ler a moeda base do cliente
 * (aí ele omite o valor em vez de inventar a unidade). Zero afirmaria que a
 * pessoa não ganha nada. Sem moeda, também "—" — o último recurso "BRL" que havia
 * aqui era o mesmo chute de moeda que a #314 removeu: quem chama passa a moeda do
 * cliente quando o rótulo não veio.
 */
export function fmtMoneyIn(value, currency) {
  if (moedaEsquecida("fmtMoneyIn", arguments)) return DASH;
  if (!currency) return DASH;
  return formatMoney(value, currency) ?? DASH;
}

/** Percentual com 1 casa, robusto a valor ausente/não-finito. */
export function fmtPct(value) {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;
}

/** Seta de tendência do saldo mês a mês. */
export function trendGlyph(trend) {
  if (trend === "up") return { glyph: "↑", color: T.green };
  if (trend === "down") return { glyph: "↓", color: T.red };
  return { glyph: "→", color: T.inkLight };
}

/** Última atividade em pt-BR (YYYY-MM-DD → dd/mm/aaaa), ou "—". */
export function fmtLastActive(iso) {
  if (!iso) return DASH;
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return DASH;
  return `${d}/${m}/${y}`;
}

/**
 * "há 3 minutos" — quando uma avaliação em cache foi de fato calculada.
 *
 * Recebe o `computed_at` do backend: ISO **com offset**. O offset não é detalhe:
 * sem ele o JS interpretaria o timestamp como hora local e um servidor em UTC
 * daria 3h de erro para um browser em BRT — o drawer anunciaria "há 3 horas"
 * numa avaliação de 3 minutos.
 *
 * Devolve `null` (e não uma string qualquer) quando não há o que dizer: quem
 * chama decide se some com o rótulo, em vez de exibir um "—" sem sentido.
 */
export function fmtComputedAt(iso, now = Date.now()) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const seconds = Math.round((now - then) / 1000);
  // Relógios de cliente e servidor divergem; um "há -2 minutos" seria absurdo na
  // tela. Tudo que parece futuro vira "agora mesmo".
  if (seconds < 60) return "agora mesmo";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
