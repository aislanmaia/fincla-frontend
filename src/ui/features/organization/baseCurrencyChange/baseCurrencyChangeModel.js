import { currencyInfo } from "../../../money/currencyRegistry.js";
import { moneyInputStatus, parseMoneyInputFor } from "../../../money/moneyInput.js";
import { quoteDirection } from "../../../money/quoteDirection.js";
import { formatRatePtBr } from "../../novaTransacao/accountConversion.js";
import { formatDay } from "../../accounts/accountMeta.js";

/**
 * Regras da tela de troca da moeda base (fincla-api#465), sem React.
 *
 * O servidor calcula os números: `kept` ("Manter os números") e `converted`
 * ("Converter pela cotação") chegam prontos em cada item, e a tela só ESCOLHE
 * entre eles — nunca refaz a conta. O único número que nasce aqui é o que a
 * pessoa digita, e ele vai para o servidor como ela digitou (no máximo 2 casas,
 * nunca arredondado).
 *
 * Precedência das escolhas, igual à do servidor: item > grupo > global. Item
 * travado (meta com aportes) fica sempre como está.
 */

export const GROUP_LABELS = {
  income: "Renda declarada",
  budgets: "Orçamentos",
  goals: "Metas",
  monthly_plans: "Plano do mês",
  consultant_income: "Renda estimada pelo consultor",
};

export function groupLabel(group) {
  return GROUP_LABELS[group] ?? group;
}

export function lockedReasonLabel(reason, fromCurrency) {
  const symbol = currencyInfo(fromCurrency).symbol;
  if (reason === "has_contributions") return `Meta com aportes: fica em ${symbol}`;
  return `Fica em ${symbol}`;
}

const WARNING_LABELS = {
  contributions_currency: (to) => `Os próximos aportes precisam sair de uma conta em ${currencyInfo(to).symbol}.`,
};

/**
 * Aviso do item (ex.: meta cujos aportes futuros vêm de conta na moeda nova). Código
 * conhecido → frase PT-BR; texto pronto do servidor → como veio; código desconhecido
 * → nada (nunca um identificador cru na tela).
 */
export function itemWarningLabel(warning, toCurrency) {
  const w = String(warning ?? "").trim();
  if (!w) return null;
  if (WARNING_LABELS[w]) return WARNING_LABELS[w](toCurrency);
  return /\s/.test(w) ? w : null;
}

/** Estado inicial: NENHUMA escolha global — nada é mantido nem convertido sem a pessoa dizer. */
export function initialChoices() {
  return { mode: null, groups: {}, items: {} };
}

/**
 * `1 / rate` em `places` casas, HALF_UP, em inteiros. Só para EXIBIR a mesma cotação
 * na direção "1 <estrangeira> = <base>"; a conta é a do servidor, pela taxa dele.
 * `null` para taxa inválida ou zero.
 */
export function invertRate(rate, places = 10) {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(String(rate ?? "").trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  const digits = BigInt(`${m[1]}${frac}`);
  if (digits === 0n) return null;
  // 1 / (digits / 10^scale) = 10^scale / digits; com `places` casas:
  const numerator = 10n ** BigInt(frac.length + places);
  let q = numerator / digits;
  if ((numerator % digits) * 2n >= digits) q += 1n;
  const s = q.toString().padStart(places + 1, "0");
  return places > 0 ? `${s.slice(0, -places)}.${s.slice(-places)}` : s;
}

/**
 * A cotação da prévia como o app sempre a escreve — "US$ 1 = R$ 5,4525" — e a data
 * dela ("05/11"). A API manda `from → to` (R$ 1 = US$ 0,1834); a regra do Owner é
 * "1 <estrangeira> = <base>" a partir da base que a pessoa conhece (a atual), então
 * o par mostrado vem de `quoteDirection` e a taxa só é invertida para exibição.
 * `null` sem cotação.
 */
export function quoteDisplay(preview) {
  const q = preview?.quote;
  if (!q?.rate) return null;
  const direction = quoteDirection({ from: preview.from_currency, to: preview.to_currency, base: preview.from_currency });
  const sameWay = String(q.base).toUpperCase() === direction.base && String(q.quote).toUpperCase() === direction.quote;
  const rate = sameWay ? String(q.rate) : invertRate(q.rate);
  if (rate == null) return null;
  return {
    pair: `${currencyInfo(direction.base).symbol} 1 = ${currencyInfo(direction.quote).symbol} ${formatRatePtBr(rate)}`,
    date: formatDay(q.quoted_on),
  };
}

function itemOverride(choices, key) {
  return choices?.items?.[key] ?? null;
}

/** O modo que vale para o item: travado → `skip`; senão item > grupo > global (`null` = ainda sem escolha). */
export function effectiveMode(item, group, choices) {
  if (item.locked_reason) return "skip";
  return itemOverride(choices, item.key)?.mode ?? choices?.groups?.[group] ?? choices?.mode ?? null;
}

/**
 * Lê o valor digitado na moeda NOVA (#284: "1,500" em US$ é 1500). `{ amount, error }`:
 * `amount` é a string decimal que vai para o servidor ("1500.00").
 */
export function readTypedValue(text, currency) {
  const status = moneyInputStatus(text, currency);
  if (status === "empty") return { amount: null, error: "Informe o valor" };
  if (status === "invalid") return { amount: null, error: "Valor inválido" };
  const n = parseMoneyInputFor(text, currency);
  if (n == null || !Number.isFinite(n)) return { amount: null, error: "Valor inválido" };
  if (n < 0) return { amount: null, error: "O valor não pode ser negativo" };
  if (n >= 1e12) return { amount: null, error: "Valor grande demais" };
  const cents = n * 100;
  // Mais de duas casas seria arredondar o que a pessoa digitou: recusa, não chuta.
  if (Math.abs(cents - Math.round(cents)) > 1e-6) return { amount: null, error: "No máximo duas casas decimais" };
  return { amount: (Math.round(cents) / 100).toFixed(2), error: null };
}

/**
 * O que acontece com o item: `{ mode, after, error }`. `after` é o dinheiro que fica
 * gravado (do servidor, ou o digitado), `null` quando ainda não dá para saber —
 * nunca zero no lugar.
 */
export function itemOutcome(item, group, choices, toCurrency) {
  const mode = effectiveMode(item, group, choices);
  if (mode == null) return { mode, after: null, error: null };
  if (mode === "skip") return { mode, after: item.current, error: null };
  if (mode === "keep") return { mode, after: item.kept, error: null };
  if (mode === "convert") {
    return item.converted
      ? { mode, after: item.converted, error: null }
      : { mode, after: null, error: "Sem cotação para converter" };
  }
  const { amount, error } = readTypedValue(itemOverride(choices, item.key)?.text ?? "", toCurrency);
  return { mode, after: amount == null ? null : { amount, currency: toCurrency }, error };
}

/** Itens do mesmo registro (mesmo grupo + `entity_id`) — eles mudam de moeda juntos. */
function siblingsOf(preview, group, item) {
  const g = (preview?.groups ?? []).find((x) => x.group === group);
  return (g?.items ?? []).filter((i) => i.key !== item.key && i.entity_id === item.entity_id);
}

/**
 * Escolha por item. Um registro não fica metade numa moeda e metade em outra (uma
 * meta com o valor-alvo em R$ e o aporte mensal em US$), então "Deixar como está"
 * leva os irmãos junto, e tirar um item do "como está" tira os irmãos também.
 * `mode = null` volta a seguir o grupo / a escolha geral.
 */
export function setItemMode(choices, preview, group, item, mode) {
  const items = { ...choices.items };
  const current = items[item.key] ?? {};
  if (mode == null) delete items[item.key];
  else items[item.key] = { ...current, mode };
  const next = { ...choices, items };
  for (const sib of siblingsOf(preview, group, item)) {
    if (sib.locked_reason) continue;
    const sibMode = effectiveMode(sib, group, next);
    const thisMode = effectiveMode(item, group, next);
    if (thisMode === "skip" && sibMode !== "skip") items[sib.key] = { ...(items[sib.key] ?? {}), mode: "skip" };
    else if (thisMode !== "skip" && sibMode === "skip") {
      delete items[sib.key];
      // "Digitar valor" é por campo: o irmão não ganha um campo vazio que a pessoa não pediu.
      const sibFallback = thisMode === "value" ? (next.mode ?? "keep") : (thisMode ?? next.mode ?? "keep");
      if (effectiveMode(sib, group, { ...next, items }) === "skip") items[sib.key] = { mode: sibFallback };
    }
  }
  return { ...next, items };
}

export function setItemText(choices, key, text) {
  return { ...choices, items: { ...choices.items, [key]: { ...(choices.items[key] ?? {}), mode: "value", text } } };
}

/** Escolha por grupo (`null` = seguir a escolha geral). Ela vale sobre as escolhas por item já feitas? Não: item vence. */
export function setGroupMode(choices, group, mode) {
  const groups = { ...choices.groups };
  if (mode == null) delete groups[group];
  else groups[group] = mode;
  return { ...choices, groups };
}

/** "Deixar como está" no grupo só quando todo item dele pode ficar na moeda antiga. */
export function groupCanSkip(group) {
  return (group.items ?? []).length > 0 && group.items.every((i) => i.can_skip);
}

/** O modo dos itens não exibidos (perfil de outro consultor): grupo > global, como no servidor. */
function undisclosedMode(group, choices) {
  return choices?.groups?.[group.group] ?? choices?.mode ?? null;
}

/**
 * O resumo do que a confirmação vai fazer, e se ela pode ir:
 * `{ counts: {keep, convert, skip, value}, errors: [{key,label,message}], needsQuote, canApply, reason }`.
 */
export function summarize(preview, choices) {
  const counts = { keep: 0, convert: 0, skip: 0, value: 0 };
  const errors = [];
  let pending = 0;
  const to = preview?.to_currency;
  for (const g of preview?.groups ?? []) {
    for (const item of g.items) {
      const out = itemOutcome(item, g.group, choices, to);
      if (out.mode == null) pending += 1;
      else counts[out.mode] += 1;
      if (out.error) errors.push({ key: item.key, label: item.label, message: out.error });
    }
    const hidden = g.undisclosed_count ?? 0;
    if (hidden > 0) {
      const mode = undisclosedMode(g, choices);
      if (mode == null) pending += hidden;
      else {
        counts[mode] += hidden;
        if (mode === "convert" && !preview.quote) {
          errors.push({ key: `${g.group}:undisclosed`, label: groupLabel(g.group), message: "Sem cotação para converter" });
        }
      }
    }
  }
  for (const err of splitRecordErrors(preview, choices)) errors.push(err);
  const needsQuote = counts.convert > 0;
  let reason = null;
  if (choices?.mode == null && (preview?.groups ?? []).length > 0) reason = "Escolha manter os números ou converter pela cotação.";
  else if (pending > 0) reason = "Escolha o que fazer com todos os itens.";
  else if (errors.length > 0) reason = "Corrija os itens marcados.";
  else if (needsQuote && !preview?.quote) reason = "Sem cotação: mantenha os números ou digite os valores.";
  return { counts, errors, needsQuote, canApply: reason == null, reason };
}

/** Registro com uma parte "como está" e outra mudando (o servidor recusaria). */
function splitRecordErrors(preview, choices) {
  const out = [];
  for (const g of preview?.groups ?? []) {
    const byEntity = new Map();
    for (const item of g.items) {
      const skip = effectiveMode(item, g.group, choices) === "skip";
      const entry = byEntity.get(item.entity_id) ?? { skip: new Set(), item };
      entry.skip.add(skip);
      byEntity.set(item.entity_id, entry);
    }
    for (const { skip, item } of byEntity.values()) {
      if (skip.size > 1) out.push({ key: `${item.key}:split`, label: item.label, message: "Os valores do mesmo registro mudam de moeda juntos" });
    }
  }
  return out;
}

/**
 * O corpo da confirmação. Leva a cotação EXIBIDA quando algo será convertido; leva
 * só as escolhas de grupo/item que a pessoa fez, e só para itens desta prévia.
 *
 * Item travado nunca leva escolha própria (o servidor recusa escolha por item num
 * travado); ele fica como está mesmo sob uma escolha de grupo.
 */
export function buildApplyRequest(preview, choices) {
  const { needsQuote } = summarize(preview, choices);
  const body = {
    to: preview.to_currency,
    fingerprint: preview.fingerprint,
    mode: choices.mode ?? "keep",
    quote: needsQuote && preview.quote ? { rate: preview.quote.rate, quoted_on: preview.quote.quoted_on } : null,
    groups: {},
    items: {},
  };
  for (const g of preview.groups ?? []) {
    const groupMode = choices.groups?.[g.group];
    if (groupMode && groupMode !== "value") body.groups[g.group] = { mode: groupMode };
    for (const item of g.items) {
      if (item.locked_reason) continue;
      const ov = choices.items?.[item.key];
      if (!ov?.mode) continue;
      if (ov.mode === "value") {
        const { amount } = readTypedValue(ov.text ?? "", preview.to_currency);
        if (amount != null) body.items[item.key] = { mode: "value", value: amount };
      } else {
        body.items[item.key] = { mode: ov.mode };
      }
    }
  }
  return body;
}

/** "3 convertidos · 2 mantidos · 1 com valor digitado · 1 fica em R$". */
export function summaryLine(summary, fromCurrency) {
  const { keep, convert, value, skip } = summary.counts;
  const symbol = currencyInfo(fromCurrency).symbol;
  const parts = [];
  if (convert) parts.push(`${convert} convertido${convert === 1 ? "" : "s"} pela cotação`);
  if (keep) parts.push(`${keep} mantido${keep === 1 ? "" : "s"} com o mesmo número`);
  if (value) parts.push(`${value} com valor digitado`);
  if (skip) parts.push(`${skip} fica${skip === 1 ? "" : "m"} em ${symbol}`);
  return parts.join(" · ");
}
