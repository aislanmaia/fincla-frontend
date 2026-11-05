import { parseBRL } from "../features/accounts/accountMeta.js";
import { currencyInfo } from "./currencyRegistry.js";

/**
 * Campo de dinheiro → número, ciente da moeda do campo (fincla-frontend#284).
 *
 * Regra do Owner: a leitura "vírgula = milhar, ponto = decimal" só vale quando a
 * MOEDA do campo é escrita assim ("1,234.56": USD, GBP, JPY… — `DOT_DECIMAL`). Moeda de convenção
 * "1.234,56" (BRL, EUR…) continua com o parser que o campo já usava, sem mudança
 * nenhuma — conta real não pode mudar de número.
 *
 * Numa moeda de ponto decimal, quem é brasileiro ainda digita "52,40" por hábito;
 * por isso a leitura é "o inequívoco primeiro":
 *   - "1,234.56" / "1.234,56" → o ÚLTIMO separador é o decimal, o outro agrupa milhar;
 *   - um separador só, seguido de 1–2 dígitos → decimal ("52,40", "52.4");
 *   - um separador só, seguido de exatamente 3 dígitos → milhar ("1,500", "1.500");
 *   - qualquer outra forma → inválido (nunca um número errado em silêncio).
 */

/**
 * Moedas escritas com ponto decimal ("1,234.56"). Tabela explícita, sem `Intl` em
 * tempo de execução: a resposta do `Intl` depende da versão do ICU do navegador e
 * cai na localidade padrão quando não conhece a língua da região — MXN e CHF
 * saíam "vírgula" e PYG saía pt-BR. Fora da tabela (BRL, EUR, ARS, CLP, COP, UYU,
 * ZAR…, ou desconhecida) = convenção brasileira, o parser de sempre.
 */
const DOT_DECIMAL = new Set([
  "USD", "GBP", "JPY", "CAD", "AUD", "NZD", "CHF", "MXN", "CNY", "HKD", "SGD",
  "INR", "KRW", "ILS", "PEN", "GTQ", "DOP", "HNL", "NIO", "PAB", "THB", "TWD",
  "PHP", "MYR", "AED", "SAR",
]);

/** A moeda se escreve com ponto decimal? Só a tabela decide. */
export function currencyUsesDotDecimal(currency) {
  return DOT_DECIMAL.has(String(currency ?? "").trim().toUpperCase());
}

/* Milhar só começa por 1–9: "0,500" / "012,500" não são milhares — são ambíguos. */
const GROUPED_RE = /^[1-9]\d{0,2}(?:S\d{3})+$/;

function groupedDigits(intPart, sep) {
  const re = new RegExp(GROUPED_RE.source.replace("S", sep === "." ? "\\." : ","));
  return re.test(intPart) ? intPart.split(sep).join("") : null;
}

const INVALID = { status: "invalid", value: null };

/**
 * Leitura "o inequívoco primeiro". `{ status: "empty" | "invalid" | "ok", value }`.
 * `decimals` = casas da moeda (JPY/KRW: 0) — com 0, qualquer parte decimal é recusada.
 */
export function readDotDecimalMoney(text, { decimals = 2 } = {}) {
  const raw = String(text ?? "").replace(/\s/g, "");
  if (raw === "") return { status: "empty", value: null };
  const m = /^(-)?([\d.,]+)$/.exec(raw);
  if (!m || !/\d/.test(m[2])) return INVALID;
  const sign = m[1] ? -1 : 1;
  const body = m[2];
  const commas = (body.match(/,/g) || []).length;
  const dots = (body.match(/\./g) || []).length;
  const fracOk = (frac) => decimals > 0 && new RegExp(`^\\d{1,${Math.min(decimals, 2)}}$`).test(frac);
  let digits = null;
  if (commas === 0 && dots === 0) {
    digits = body;
  } else if (commas > 0 && dots > 0) {
    // Os dois: o último separador é o decimal, e só pode aparecer uma vez.
    const decSep = body.lastIndexOf(",") > body.lastIndexOf(".") ? "," : ".";
    const groupSep = decSep === "," ? "." : ",";
    if ((decSep === "," ? commas : dots) !== 1) return INVALID;
    const [intPart, frac] = body.split(decSep);
    const int = groupedDigits(intPart, groupSep);
    if (int == null || !fracOk(frac)) return INVALID;
    digits = `${int}.${frac}`;
  } else {
    const sep = commas > 0 ? "," : ".";
    if (commas + dots === 1) {
      const [intPart, frac] = body.split(sep);
      if (/^\d{3}$/.test(frac) && /^[1-9]\d{0,2}$/.test(intPart)) digits = `${intPart}${frac}`;
      else if (fracOk(frac) && /^\d*$/.test(intPart)) digits = `${intPart || "0"}.${frac}`;
      else return INVALID;
    } else {
      const int = groupedDigits(body, sep);
      if (int == null) return INVALID;
      digits = int;
    }
  }
  const n = Number(digits);
  return Number.isFinite(n) ? { status: "ok", value: sign * n } : INVALID;
}

const decimalsOf = (currency) => {
  const places = currencyInfo(currency).decimalPlaces;
  return Number.isInteger(places) && places >= 0 ? places : 2;
};

/**
 * Leitura de um campo de dinheiro na moeda `currency`. Moeda de vírgula decimal (ou
 * desconhecida) → `legacy`, o parser que o campo já usava, intocado (padrão:
 * `parseBRL`). Moeda de ponto decimal → `readDotDecimalMoney`; vazio ou inválido
 * → `null`.
 */
export function parseMoneyInputFor(text, currency, legacy = parseBRL) {
  if (!currencyUsesDotDecimal(currency)) return legacy(text);
  return readDotDecimalMoney(text, { decimals: decimalsOf(currency) }).value;
}

/**
 * Estado do campo para a tela: `"empty"`, `"invalid"` ou `"ok"`. Na convenção
 * brasileira o parser de hoje nunca recusa; aqui, texto sem nenhum dígito conta
 * como inválido (o parser antigo o leria como 0).
 */
export function moneyInputStatus(text, currency) {
  const raw = String(text ?? "").trim();
  if (raw === "") return "empty";
  if (!currencyUsesDotDecimal(currency)) return /\d/.test(raw) ? "ok" : "invalid";
  return readDotDecimalMoney(raw, { decimals: decimalsOf(currency) }).status;
}

/**
 * Texto do campo ao perder o foco: numa moeda de ponto decimal, o número LIDO volta
 * escrito como o app mostra dinheiro ("1,500" → "1.500,00"), para um engano de
 * leitura ficar à vista. Inválido, vazio ou moeda de vírgula decimal: o texto fica
 * como está.
 */
export function reformatMoneyInputOnBlur(text, currency) {
  if (!currencyUsesDotDecimal(currency)) return text;
  const decimals = decimalsOf(currency);
  const { status, value } = readDotDecimalMoney(text, { decimals });
  if (status !== "ok") return text;
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
