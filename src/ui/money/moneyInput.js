import { parseBRL } from "../features/accounts/accountMeta.js";

/**
 * Campo de dinheiro → número, ciente da moeda do campo (fincla-frontend#284).
 *
 * Regra do Owner: a leitura "vírgula = milhar, ponto = decimal" só vale quando a
 * MOEDA do campo é escrita assim ("1,234.56": USD, GBP, JPY…). Moeda de convenção
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

const dotDecimalCache = new Map();

/**
 * A moeda se escreve com ponto decimal? Derivado do `Intl`: a região do código ISO
 * 4217 (as duas primeiras letras: USD → US) → a localidade típica dela → o separador
 * decimal que essa localidade usa. EUR (região "EU") e códigos X* (sem país) ficam
 * na convenção brasileira — a de hoje.
 */
export function currencyUsesDotDecimal(currency) {
  const code = String(currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return false;
  if (dotDecimalCache.has(code)) return dotDecimalCache.get(code);
  let dot = false;
  const region = code.slice(0, 2);
  if (code !== "EUR" && !region.startsWith("X")) {
    try {
      const locale = new Intl.Locale("und", { region }).maximize().toString();
      const decimal = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value;
      dot = decimal === ".";
    } catch (_err) {
      dot = false;
    }
  }
  dotDecimalCache.set(code, dot);
  return dot;
}

const GROUPED_RE = /^\d{1,3}(?:S\d{3})+$/;

function groupedDigits(intPart, sep) {
  const re = new RegExp(GROUPED_RE.source.replace("S", sep === "." ? "\\." : ","));
  return re.test(intPart) ? intPart.split(sep).join("") : null;
}

/** Leitura "o inequívoco primeiro". `{ status: "empty" | "invalid" | "ok", value }`. */
export function readDotDecimalMoney(text) {
  const raw = String(text ?? "").replace(/\s/g, "");
  if (raw === "") return { status: "empty", value: null };
  const m = /^(-)?([\d.,]+)$/.exec(raw);
  if (!m || !/\d/.test(m[2])) return { status: "invalid", value: null };
  const sign = m[1] ? -1 : 1;
  const body = m[2];
  const commas = (body.match(/,/g) || []).length;
  const dots = (body.match(/\./g) || []).length;
  let digits = null;
  if (commas === 0 && dots === 0) {
    digits = body;
  } else if (commas > 0 && dots > 0) {
    // Os dois: o último separador é o decimal, e só pode aparecer uma vez.
    const decSep = body.lastIndexOf(",") > body.lastIndexOf(".") ? "," : ".";
    const groupSep = decSep === "," ? "." : ",";
    if ((decSep === "," ? commas : dots) !== 1) return { status: "invalid", value: null };
    const [intPart, frac] = body.split(decSep);
    const int = groupedDigits(intPart, groupSep);
    if (int == null || !/^\d{1,2}$/.test(frac)) return { status: "invalid", value: null };
    digits = `${int}.${frac}`;
  } else {
    const sep = commas > 0 ? "," : ".";
    const count = commas + dots;
    const parts = body.split(sep);
    if (count === 1) {
      const [intPart, frac] = parts;
      if (/^\d{1,2}$/.test(frac) && /^\d*$/.test(intPart)) digits = `${intPart || "0"}.${frac}`;
      else if (/^\d{3}$/.test(frac) && /^\d{1,3}$/.test(intPart)) digits = `${intPart}${frac}`;
      else return { status: "invalid", value: null };
    } else {
      const int = groupedDigits(body, sep);
      if (int == null) return { status: "invalid", value: null };
      digits = int;
    }
  }
  const n = Number(digits);
  return Number.isFinite(n) ? { status: "ok", value: sign * n } : { status: "invalid", value: null };
}

/**
 * Leitura de um campo de dinheiro na moeda `currency`. Moeda de vírgula decimal (ou
 * desconhecida) → `legacy`, o parser que o campo já usava, intocado (padrão:
 * `parseBRL`). Moeda de ponto decimal → `readDotDecimalMoney`; vazio ou inválido
 * → `null`.
 */
export function parseMoneyInputFor(text, currency, legacy = parseBRL) {
  if (!currencyUsesDotDecimal(currency)) return legacy(text);
  return readDotDecimalMoney(text).value;
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
  return readDotDecimalMoney(raw).status;
}

/**
 * Texto do campo ao perder o foco: numa moeda de ponto decimal, o número LIDO volta
 * escrito como o app mostra dinheiro ("1,500" → "1.500,00"), para um engano de
 * leitura ficar à vista. Inválido, vazio ou moeda de vírgula decimal: o texto fica
 * como está.
 */
export function reformatMoneyInputOnBlur(text, currency) {
  if (!currencyUsesDotDecimal(currency)) return text;
  const { status, value } = readDotDecimalMoney(text);
  if (status !== "ok") return text;
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
