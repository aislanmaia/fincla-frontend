/**
 * O que o desfazer/refazer VAI FAZER, dito por extenso.
 *
 * O rótulo antigo descrevia só o destino — "Desfazer: voltar para 1 filtro" —
 * e isso não responde a pergunta que a pessoa tem na mão: *qual* mudança vai
 * embora. Com três filtros na tela, "voltar para 2 filtros" obriga a clicar
 * para descobrir qual dos três some, que é o oposto do que um desfazer serve.
 *
 * A descrição sai do DIFF entre o estado atual e o destino, e nomeia o que
 * mudou: a faceta e o valor.
 */

const RÓTULOS_PERIODO = {
  tudo: "Todo período",
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  "mes-ant": "Mês anterior",
  "3m": "Últimos 3m",
  ano: "Este ano",
  custom: "Período personalizado",
  rel: "Janela relativa",
};

const RÓTULOS_TIPO = { receita: "Receitas", despesa: "Despesas", estorno: "Estornos" };
const RÓTULOS_SITUACAO = { paga: "Pagas", "a-pagar": "A pagar" };
const RÓTULOS_REC = { sim: "Recorrentes", nao: "Não recorrentes" };

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => String(v ?? "").trim();

/** Os "chips" de um snapshot: faceta + o que ela diz. Ordem é a da tela. */
export function chipsDoSnapshot(snap, { categorias = {}, cartoes = {} } = {}) {
  if (!snap || typeof snap !== "object") return [];
  const out = [];
  const busca = texto(snap.searchInput ?? snap.debouncedSearch ?? snap.search);
  if (busca) out.push({ faceta: "busca", nome: "Busca", valor: `"${busca}"` });
  if (snap.period && snap.period !== "mes") {
    out.push({ faceta: "periodo", nome: "Período", valor: RÓTULOS_PERIODO[snap.period] || snap.period });
  }
  if (snap.type && snap.type !== "todos") {
    out.push({ faceta: "tipo", nome: "Tipo", valor: RÓTULOS_TIPO[snap.type] || snap.type });
  }
  for (const c of lista(snap.cats)) {
    out.push({ faceta: "categoria", nome: "Categoria", valor: categorias[c]?.label || c });
  }
  for (const t of lista(snap.tags)) out.push({ faceta: "tag", nome: "Tag", valor: t });
  for (const m of lista(snap.method)) out.push({ faceta: "forma", nome: "Forma de pagamento", valor: m });
  for (const k of lista(snap.cardSel)) {
    out.push({ faceta: "cartao", nome: "Cartão", valor: cartoes[k]?.label || k });
  }
  if (snap.rec && snap.rec !== "any") {
    out.push({ faceta: "recorrencia", nome: "Recorrência", valor: RÓTULOS_REC[snap.rec] || snap.rec });
  }
  if (snap.valueMin || snap.valueMax) {
    const de = texto(snap.valueMin);
    const ate = texto(snap.valueMax);
    out.push({
      faceta: "valor",
      nome: "Valor",
      valor: de && ate ? `${de} a ${ate}` : de ? `a partir de ${de}` : `até ${ate}`,
    });
  }
  if (snap.settlement && snap.settlement !== "todas") {
    out.push({ faceta: "situacao", nome: "Situação", valor: RÓTULOS_SITUACAO[snap.settlement] || snap.settlement });
  }
  return out;
}

const chave = (c) => `${c.faceta}|${c.valor}`;

/**
 * @param {object} atual     o estado em vigor
 * @param {object} destino   para onde o botão leva
 * @param {"Desfazer"|"Refazer"} verbo
 */
export function describeFilterChange(atual, destino, verbo = "Desfazer", maps = {}) {
  const a = chipsDoSnapshot(atual, maps);
  const b = chipsDoSnapshot(destino, maps);
  const saem = a.filter((x) => !b.some((y) => chave(y) === chave(x)));
  const entram = b.filter((x) => !a.some((y) => chave(y) === chave(x)));

  /* TROCA de valor na mesma faceta vem primeiro: é o caso mais comum de todos
     (mudar o período) e o que antes caía no genérico. Nomear a faceta e o
     destino é o que separa "voltar ao anterior" de saber o que o clique faz. */
  if (saem.length === 1 && entram.length === 1 && saem[0].faceta === entram[0].faceta) {
    return `${verbo}: ${entram[0].nome} volta para ${entram[0].valor}`;
  }
  if (saem.length === 1 && entram.length === 0) return `${verbo}: remover ${saem[0].valor}`;
  if (entram.length === 1 && saem.length === 0) return `${verbo}: trazer ${entram[0].valor} de volta`;
  if (a.length > 0 && b.length === 0) {
    return `${verbo}: limpar ${a.length === 1 ? "o filtro" : `os ${a.length} filtros`}`;
  }
  if (a.length === 0 && b.length > 0) {
    return `${verbo}: restaurar ${b.length === 1 ? "1 filtro" : `${b.length} filtros`}`;
  }
  /* Só aqui o genérico é honesto: várias facetas mudaram de uma vez, e listar
     todas num tooltip informaria menos que dizer quantas. */
  if (saem.length + entram.length > 0) {
    const n = saem.length + entram.length;
    return `${verbo}: ${n} mudanças de filtro`;
  }
  return `${verbo}: voltar ao filtro anterior`;
}
