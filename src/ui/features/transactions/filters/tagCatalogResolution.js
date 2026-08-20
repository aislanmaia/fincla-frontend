/**
 * Lógica pura de resolução da facet "Tags" — extraída de `TransacoesPage.jsx`
 * para ser testável sem montar a página inteira (fincla-frontend#96, revisão
 * adversarial da PR #96, achados 1/3/4).
 *
 * Contexto do bug original (#78): a facet guarda o RÓTULO exibido no chip
 * (string), não o UUID que o backend entende (`tag_id`). `buildTagOptions`
 * resolve essa ponte com uma regra que não pode voltar a colapsar tags
 * homônimas de categorias diferentes (achado 1), e `resolveTagFilterStatus`
 * garante que uma seleção que não resolve NUNCA vira "sem filtro" por baixo
 * do capô (achado 4) — o chamador usa o `kind` para decidir entre mostrar a
 * lista (resolved) ou travar a busca com um aviso visível (loading / error /
 * unresolved), nunca mostrar tudo silenciosamente.
 */

function normalizeForCompare(value) {
  return String(value ?? "").trim();
}

/**
 * Tags "detalhe"/"contexto"/"local"/"pessoa" (qualquer tag não-categoria) de
 * uma organização podem repetir o NOME sob categorias-pai diferentes — ex.:
 * "mensal" sob Casa e sob Trabalho são duas tags distintas (ids diferentes).
 * Antes desta correção, o mapa nome→id guardava só a primeira ocorrência: o
 * painel oferecia um chip só para "mensal" e o filtro, dependendo de qual id
 * ganhasse a corrida, descartava silenciosamente as linhas da outra
 * categoria — o usuário via metade dos resultados sem nenhum sinal.
 *
 * Aqui cada linha do catálogo vira uma opção com um `displayLabel` único: só
 * qualificamos com a categoria pai quando o nome colide (a maioria das tags
 * não precisa do sufixo). O `displayLabel` é 1:1 com o `id` — nunca colapsa.
 *
 * Revisão adversarial da PR #96, prioridade 4a: qualificar pela categoria pai
 * não bastava — duas tags com o MESMO nome e `parent_category_tag_id: null`
 * (ou cujo pai ainda não está em `categoryLabelById`, ex.: catálogo de
 * categorias ainda carregando) produziam o MESMO `"nome · sem categoria"`,
 * colidindo de novo: o `Map` final ficava com um id só, o React recebia key
 * duplicada, e os dois chips acendiam juntos. Por isso há uma segunda
 * passada: se o rótulo qualificado AINDA colidir dentro do grupo, appendamos
 * o id INTEIRO (estável, garantidamente único) como desempate final — feio,
 * mas o `displayLabel` nunca deixa de ser 1:1 com um id.
 *
 * Prioridade 4b: o nome da tag é `.trim()`ado ANTES de virar rótulo/chave de
 * agrupamento, para casar com o `trim()` que `resolveTagFilterStatus` aplica
 * ao rótulo selecionado — sem isso, uma tag chamada "casa " (espaço à direita)
 * nunca resolvia (a seleção comparava trimada contra uma chave crua) e
 * travava a página pra sempre (achado 4/5: filtro bloqueado sem saída).
 *
 * @param {Array<{id: string, name: string, parent_category_tag_id?: string|null}>} rows
 * @param {Map<string, string>} categoryLabelById - id de categoria → rótulo PT
 * @returns {Array<{id: string, name: string, displayLabel: string}>}
 */
export function buildTagOptions(rows, categoryLabelById = new Map()) {
  const byName = new Map();
  for (const raw of Array.isArray(rows) ? rows : []) {
    const name = String(raw?.name ?? "").trim();
    if (!raw?.id || !name) continue;
    const list = byName.get(name) ?? [];
    list.push(raw);
    byName.set(name, list);
  }

  const options = [];
  for (const [name, group] of byName) {
    if (group.length === 1) {
      options.push({ id: String(group[0].id), name, displayLabel: name });
      continue;
    }

    // Colisão de nome: primeira tentativa de desambiguação, pela categoria pai.
    const withParentLabel = group.map((t) => {
      const parentId = t.parent_category_tag_id ? String(t.parent_category_tag_id) : null;
      const parentLabel = parentId ? categoryLabelById.get(parentId) : null;
      return { t, candidate: `${name} · ${parentLabel || "sem categoria"}` };
    });

    const candidateCounts = new Map();
    for (const { candidate } of withParentLabel) {
      candidateCounts.set(candidate, (candidateCounts.get(candidate) ?? 0) + 1);
    }

    for (const { t, candidate } of withParentLabel) {
      // Ainda colide (achado 4a) — desempata pelo id INTEIRO, nunca truncado:
      // um prefixo curto (ex.: 8 chars) pode colidir de novo entre ids que
      // começam iguais, e aí voltaríamos pro mesmo bug com uma casca a mais.
      const displayLabel = candidateCounts.get(candidate) > 1 ? `${candidate} (${t.id})` : candidate;
      options.push({ id: String(t.id), name, displayLabel });
    }
  }

  return options.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel, "pt-BR"));
}

/** Mapa `displayLabel` → `id`, para resolver a seleção do painel num UUID. */
export function tagOptionsToDisplayMap(options) {
  const map = new Map();
  for (const opt of options ?? []) map.set(opt.displayLabel, opt.id);
  return map;
}

/**
 * Estado da resolução de UMA tag selecionada (a facet virou single-select —
 * achado 3: o painel prometia "todas as tags marcadas" e o chip dizia "2
 * tags", mas só `tags[0]` era enviada; se `tags[0]` não resolvesse e
 * `tags[1]` resolvesse, NENHUM filtro saía. Com uma seleção só, essa
 * ambiguidade deixa de existir por construção).
 *
 * `kind`:
 *  - "none": nenhuma tag selecionada — não é filtro, não bloqueia nada.
 *  - "loading": catálogo ainda carregando — não dá pra confirmar se resolve.
 *  - "error": catálogo falhou ao carregar — não dá pra confirmar.
 *  - "unresolved": catálogo carregado, mas o rótulo não existe nele (tag
 *    renomeada/apagada numa view salva, ou nome inválido).
 *  - "resolved": achou o id — pode filtrar de verdade.
 *
 * O chamador NUNCA deve tratar loading/error/unresolved como "sem filtro" —
 * é exatamente essa conversão silenciosa que causava o achado 4 (view salva
 * com tag apagada, catálogo carregando, falha de rede ou troca de
 * organização todos caíam em `filterCat: "todas"`, mostrando a lista inteira
 * como se estivesse filtrada).
 *
 * @param {{selectedLabel: string|null, loading: boolean, error: string, displayToId: Map<string,string>}} args
 */
export function resolveTagFilterStatus({ selectedLabel, loading, error, displayToId }) {
  const label = normalizeForCompare(selectedLabel);
  if (!label) return { kind: "none" };
  if (loading) return { kind: "loading", label };
  if (error) return { kind: "error", label };
  const id = displayToId?.get(label);
  if (id != null) return { kind: "resolved", id, label };
  return { kind: "unresolved", label };
}

/** A busca deve ficar em espera (fail-closed) em vez de rodar sem o filtro. */
export function isTagFilterBlocked(status) {
  return status.kind === "loading" || status.kind === "error" || status.kind === "unresolved";
}

/** Mensagem PT-BR para o aviso visível quando o filtro está bloqueado/pendente. */
export function tagFilterStatusMessage(status) {
  switch (status.kind) {
    case "loading":
      return "Carregando tags…";
    case "error":
      return "Não foi possível carregar suas tags agora. Tente novamente em instantes.";
    case "unresolved":
      return `A tag "${status.label}" não foi encontrada — pode ter sido renomeada ou removida. Selecione novamente.`;
    default:
      return "";
  }
}
