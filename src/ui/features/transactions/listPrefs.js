/**
 * Preferências de exibição da lista de transações: densidade e agrupamento.
 *
 * Guardadas por usuário (localStorage), não por organização: é preferência de
 * leitura, não recorte de dados. Quem escolhe "Compacto" no desktop encontra
 * "Compacto" no celular sem escolher de novo.
 */

const STORAGE_KEY = "fincla:transactions:list-prefs";

/**
 * Alturas por densidade.
 *
 * O piso no mobile é 48 e não 36: abaixo disso o alvo de toque deixa de ser
 * confortável, e economizar 12 px por linha não vale um toque errado numa tela
 * onde o erro abre a transação vizinha.
 */
export const DENSITIES = {
  confortavel: { label: "Confortável", desktop: 56, mobile: 64 },
  padrao: { label: "Padrão", desktop: 48, mobile: 56 },
  compacto: { label: "Compacto", desktop: 36, mobile: 48 },
};

export const DEFAULT_DENSITY = "padrao";

/** Altura do cabeçalho de dia no modo agrupado — 24, contra os 48 de antes
 *  (28 de cabeçalho + 20 de respiro). */
export const DAY_HEADER_HEIGHT = 24;

export function densityRowHeight(density, isMobile) {
  const d = DENSITIES[density] || DENSITIES[DEFAULT_DENSITY];
  return isMobile ? d.mobile : d.desktop;
}

/** Custo real por transação, que é o que dimensiona a página. */
export function rowCost(density, isMobile, grouped) {
  return densityRowHeight(density, isMobile) + (grouped ? DAY_HEADER_HEIGHT : 0);
}

export function readListPrefs() {
  if (typeof localStorage === "undefined") return { density: DEFAULT_DENSITY, grouped: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { density: DEFAULT_DENSITY, grouped: false };
    const parsed = JSON.parse(raw);
    return {
      density: DENSITIES[parsed?.density] ? parsed.density : DEFAULT_DENSITY,
      grouped: Boolean(parsed?.grouped),
    };
  } catch {
    // localStorage pode lançar (janela privativa, site data bloqueado). Uma
    // preferência de leitura nunca pode derrubar a tela.
    return { density: DEFAULT_DENSITY, grouped: false };
  }
}

export function writeListPrefs(prefs) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* idem: sem preferência guardada a tela segue funcionando */
  }
}

/**
 * Agrupar por data só faz sentido ordenando por data. Ordenado por valor ou
 * categoria, cada "grupo" vira um item só — o pior dos dois mundos.
 */
export function groupingAllowed(sortField) {
  return !sortField || sortField === "date";
}
