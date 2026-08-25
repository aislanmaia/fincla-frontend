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
 * @returns {Array<{id: string, name: string, rawName?: string, displayLabel: string}>}
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
      options.push({ id: String(group[0].id), name, rawName: group[0].rawName, displayLabel: name });
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
      options.push({ id: String(t.id), name, rawName: t.rawName, displayLabel });
    }
  }

  return options.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel, "pt-BR"));
}

/** Mapa `displayLabel` → `id`, para resolver a seleção do painel num UUID. */
export function tagOptionsToDisplayMap(options) {
  const map = new Map();
  for (const opt of options ?? []) map.set(opt.displayLabel, opt.id);

  /* APELIDOS — o `displayLabel` é a chave canônica, e estes são as outras
     grafias pelas quais a MESMA tag pode chegar aqui. Cada um resolve um caso
     em que a seleção era legítima e a tela travava mesmo assim:

     1. NOME CRU, sem tradução. Uma visualização salva antes de o catálogo
        passar a traduzir guardou "doctor" no localStorage. Sem apelido, abrir
        essa view trava a lista com "a tag foi renomeada ou removida" — sobre
        uma tag que está lá, intacta, só com outro rótulo. E não há migração
        possível sem reescrever o armazenamento de todo mundo.

     2. RÓTULO BASE, sem o sufixo de desambiguação. A linha desambigua por
        transação ("mercado"), o catálogo desambigua pela página inteira
        ("mercado · Alimentação"): quando um nome de seed traduzido colide com
        uma tag do usuário, os dois lados produzem grafias diferentes para a
        mesma tag e o clique na linha para de resolver.

     Um apelido só entra se for ÚNICO — ambíguo, ele escolheria uma tag por
     sorte, que é pior que travar. E nunca sobrescreve uma chave canônica: se
     "mercado" é o `displayLabel` de alguém, é dessa pessoa que ele é. */
  const candidatos = new Map();
  for (const opt of options ?? []) {
    const base = String(opt.displayLabel).split(" · ")[0].trim();
    /* As formas que a LINHA produz. Os dois lados desambiguam de jeitos
       diferentes — o catálogo pela categoria pai ("mercado · Alimentação"), a
       linha pelo nome cru ou por um prefixo do id ("mercado (grocery)",
       "mercado (a1b2c3d4)") — e é a grafia da LINHA que chega aqui quando
       alguém clica no chip dela. Sem estes apelidos, clicar num chip de tag
       colidida travava a lista inteira alegando que a tag foi removida, sobre
       uma tag visível uma linha acima.

       O apelido "base" sozinho nunca resolve isso: um `displayLabel` só ganha
       o sufixo " · " quando há colisão, então a base é ambígua por construção e
       cai na regra de unicidade abaixo. Ela fica porque é barata e cobre
       grafias vindas de fora (views salvas antigas). */
    const comoALinhaEscreve = [];
    if (opt.rawName && opt.rawName.toLowerCase() !== String(opt.name).toLowerCase()) {
      comoALinhaEscreve.push(`${opt.name} (${opt.rawName})`);
    }
    comoALinhaEscreve.push(`${opt.name} (${String(opt.id).slice(0, 8)})`);

    for (const alias of [opt.rawName, opt.name, base, ...comoALinhaEscreve]) {
      const chave = String(alias ?? "").trim();
      if (!chave || map.has(chave)) continue;
      const visto = candidatos.get(chave);
      // `null` marca "ambíguo": visto com mais de um id, não serve de apelido.
      candidatos.set(chave, visto === undefined ? opt.id : (visto === opt.id ? visto : null));
    }
  }
  for (const [chave, id] of candidatos) if (id) map.set(chave, id);
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

/**
 * Mesma resolução, para a seleção INTEIRA — a facet voltou a ser multi agora
 * que `tag_id` é repetível no backend.
 *
 * Regra de agregação, e o motivo dela: se QUALQUER rótulo selecionado não
 * resolve, o conjunto todo bloqueia. Mandar só o subconjunto que resolveu
 * traria um SUPERCONJUNTO do que a tela promete (os params repetidos casam com
 * qualquer uma das tags), com todos os chips acesos — exatamente o falso
 * "filtrado" que o achado 4 corrigiu, só que mais difícil de perceber, porque
 * a lista pareceria plausível.
 *
 * A precedência loading > error > unresolved mantém a mensagem mais
 * informativa: "ainda carregando" é temporário e não deve ser reportado como
 * "tag não encontrada".
 *
 * @returns {{kind: string, ids?: string[], label?: string}}
 */
export function resolveTagFilterStatuses({ selectedLabels, loading, error, displayToId }) {
  const labels = (Array.isArray(selectedLabels) ? selectedLabels : [])
    .map(normalizeForCompare)
    .filter(Boolean);
  if (labels.length === 0) return { kind: "none", ids: [] };

  const statuses = labels.map((label) =>
    resolveTagFilterStatus({ selectedLabel: label, loading, error, displayToId }),
  );
  for (const kind of ["loading", "error", "unresolved"]) {
    const hit = statuses.find((st) => st.kind === kind);
    if (hit) return hit;
  }
  return { kind: "resolved", ids: statuses.map((st) => st.id) };
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
