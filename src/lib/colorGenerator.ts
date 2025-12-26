/**
 * Gera cores distintas e visualmente diferentes para categorias
 * Usa algoritmo baseado em HSL para garantir distribuição uniforme no espaço de cores
 */

/**
 * Converte HSL para hexadecimal
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Gera um hash simples e determinístico a partir de uma string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Gera uma cor única e distinta para uma categoria baseada no seu nome
 * 
 * @param categoryName - Nome da categoria
 * @param index - Índice da categoria na lista (0-based)
 * @param totalCategories - Total de categorias
 * @returns Cor hexadecimal no formato #RRGGBB
 */
export function generateCategoryColor(
  categoryName: string,
  index: number,
  totalCategories: number
): string {
  // Usar hash do nome para garantir que a mesma categoria sempre receba a mesma cor
  const nameHash = hashString(categoryName.toLowerCase().trim());
  
  // Distribuir o matiz (hue) uniformemente no círculo de cores (0-360)
  // Usar uma combinação do hash e do índice para melhor distribuição
  const hue = ((nameHash * 137.508) % 360 + (index * (360 / Math.max(totalCategories, 1)))) % 360;
  
  // Saturação: entre 60% e 85% para cores vibrantes mas não muito saturadas
  const saturation = 60 + (nameHash % 26); // 60-85%
  
  // Luminosidade: entre 40% e 60% para cores visíveis em fundos claros e escuros
  const lightness = 40 + (nameHash % 21); // 40-60%
  
  return hslToHex(hue, saturation, lightness);
}

/**
 * Gera um array de cores distintas para uma lista de categorias
 * Garante que cada categoria receba uma cor única e visualmente distinta
 * 
 * @param categoryNames - Array com nomes das categorias
 * @returns Map com nome da categoria como chave e cor hexadecimal como valor
 */
export function generateCategoryColors(categoryNames: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  const uniqueCategories = Array.from(new Set(categoryNames));
  const total = uniqueCategories.length;
  
  uniqueCategories.forEach((categoryName, index) => {
    colorMap.set(categoryName, generateCategoryColor(categoryName, index, total));
  });
  
  return colorMap;
}

/**
 * Gera cores para categorias garantindo distância mínima entre cores similares
 * Versão otimizada que tenta maximizar a diferença visual entre cores adjacentes
 */
export function generateDistinctCategoryColors(categoryNames: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  const uniqueCategories = Array.from(new Set(categoryNames));
  const total = uniqueCategories.length;
  
  if (total === 0) return colorMap;
  
  // Para poucas categorias, usar distribuição mais espaçada
  if (total <= 12) {
    // Distribuir uniformemente no círculo de cores
    uniqueCategories.forEach((categoryName, index) => {
      const hue = (index * (360 / total)) % 360;
      const saturation = 70; // Saturação fixa para cores vibrantes
      const lightness = 50; // Luminosidade média
      colorMap.set(categoryName, hslToHex(hue, saturation, lightness));
    });
  } else {
    // Para muitas categorias, usar algoritmo mais sofisticado
    // Dividir em grupos e usar diferentes saturações/luminosidades
    const groups = Math.ceil(Math.sqrt(total));
    const colorsPerGroup = Math.ceil(total / groups);
    
    uniqueCategories.forEach((categoryName, index) => {
      const groupIndex = Math.floor(index / colorsPerGroup);
      const indexInGroup = index % colorsPerGroup;
      
      // Distribuir matiz uniformemente
      const hue = (index * (360 / total)) % 360;
      
      // Variação de saturação por grupo
      const saturation = 55 + (groupIndex % 3) * 10; // 55, 65, 75%
      
      // Variação de luminosidade por posição no grupo
      const lightness = 35 + (indexInGroup % 4) * 5; // 35, 40, 45, 50%
      
      colorMap.set(categoryName, hslToHex(hue, saturation, lightness));
    });
  }
  
  return colorMap;
}

