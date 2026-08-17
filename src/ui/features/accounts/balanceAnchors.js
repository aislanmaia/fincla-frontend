/**
 * Âncoras de saldo — o modelo que a UI precisa para explicar o que o backend faz.
 *
 * Um ajuste de saldo é uma **afirmação**: "esta conta tinha X neste dia". O backend
 * acumula o saldo para frente a partir da âncora mais recente, então **nenhum
 * lançamento em data coberta por ela mexe no saldo** — ele já está contemplado no
 * valor que o usuário afirmou.
 *
 * Sem a UI dizer isso, o usuário lança algo retroativo, vê o saldo não se mexer, e
 * não tem como saber por quê. Este módulo existe para que essa explicação seja
 * calculada num lugar só, e testável sem renderizar tela.
 *
 * **A âncora cobre o dia inteiro em que está** — mesma regra do backend, porque
 * reconciliação se faz contra extrato bancário, que é dia-granular.
 */

/** "2026-08-13T12:00:00" | "2026-08-13" | Date -> "2026-08-13" (ou "" se não der). */
export function toYmd(value) {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // "13/08/2026" (formato de exibição da lista)
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}

/**
 * Âncora vigente por conta: a mais recente de cada uma.
 *
 * Empate de data é resolvido por `created_at` e, por fim, por `id` — a MESMA ordem
 * do `DISTINCT ON` do backend. Se divergisse, a UI diria que um lançamento está
 * coberto por uma âncora que o backend não usou.
 *
 * @param {Array} adjustments feed de `GET /v1/balance-adjustments`
 * @returns {Record<string, {ymd: string, assertedBalance: number, reason: string}>}
 */
export function latestAnchorByAccount(adjustments) {
  const byAccount = {};
  for (const adj of adjustments ?? []) {
    const accountId = adj?.account_id;
    if (!accountId) continue;
    const ymd = toYmd(adj.date);
    if (!ymd) continue;
    const current = byAccount[accountId];
    const key = [ymd, String(adj.created_at ?? ""), String(adj.id ?? "")];
    if (current && !(key > current._key)) continue;
    byAccount[accountId] = {
      _key: key,
      ymd,
      assertedBalance: Number(adj.asserted_balance ?? 0),
      reason: String(adj.reason ?? ""),
    };
  }
  // `_key` é detalhe de ordenação; não vaza para quem consome.
  const out = {};
  for (const [accountId, value] of Object.entries(byAccount)) {
    const { _key, ...rest } = value;
    out[accountId] = rest;
  }
  return out;
}

/**
 * O lançamento está em data já coberta pela âncora da sua conta?
 *
 * Comparação por DIA (`<=`), não por instante: a âncora cobre o dia inteiro.
 * Sem conta conhecida ou sem âncora, devolve `null` — "não dá para afirmar" é
 * diferente de "não está coberto", e a UI não deve avisar no escuro.
 *
 * @returns {{ymd: string, assertedBalance: number} | null}
 */
export function anchorCovering(entry, anchorsByAccount) {
  const accountId = entry?.accountId ?? entry?.account_id;
  if (!accountId) return null;
  const anchor = anchorsByAccount?.[accountId];
  if (!anchor) return null;
  // Caixa: quando pago, vale `paidAt`; senão a competência — igual ao backend.
  const cash = toYmd(entry.paidAt ?? entry.paid_at ?? entry.dateIsoForEdit ?? entry.date);
  if (!cash) return null;
  return cash <= anchor.ymd ? anchor : null;
}

/**
 * Quantos lançamentos uma âncora nesta data passaria a cobrir, e quanto somam.
 *
 * Alimenta o aviso do modal: aplicar um acerto em data retroativa silencia tudo que
 * veio antes, e o usuário merece ver o tamanho disso ANTES de confirmar.
 */
export function entriesCoveredBy(entries, { accountId, ymd }) {
  if (!accountId || !ymd) return { count: 0, total: 0 };
  let count = 0;
  let total = 0;
  for (const entry of entries ?? []) {
    const entryAccount = entry?.accountId ?? entry?.account_id;
    if (entryAccount !== accountId) continue;
    const cash = toYmd(entry.paidAt ?? entry.paid_at ?? entry.dateIsoForEdit ?? entry.date);
    if (!cash || cash > ymd) continue;
    count += 1;
    total += Math.abs(Number(entry.val ?? entry.value ?? 0));
  }
  return { count, total };
}
