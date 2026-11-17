/**
 * O resumo como o exportador o calcula (fincla-api#520, decisão D1): com `slice_currency`, um recorte todo numa
 * moeda tem os totais nela — é a regra do arquivo. Toda tela que abre o painel de exportação pede o SEU resumo por
 * aqui, senão o card da tela e o arquivo podem sair em moedas diferentes. A Visão Geral e os demais consumidores
 * não usam: eles escrevem os totais com o símbolo da moeda base.
 */
export const withSliceCurrency = (summaryQuery) => (summaryQuery ? { ...summaryQuery, slice_currency: true } : summaryQuery);
