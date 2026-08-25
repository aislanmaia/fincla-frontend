import { useEffect, useRef, useState } from "react";
import {
  buildTransactionsFacetsQuery,
  getTransactionsFacetsForUi,
} from "../../data/transactionsAdapter.js";

/**
 * Qual filtro ativo é o que mais restringe — e quanto volta sem ele.
 *
 * Serve ao vazio semântico: "Nenhuma transação neste filtro. O filtro
 * '#streaming' é o que mais restringe: sem ele volta 1 transação." com um botão
 * que remove exatamente aquele. Um vazio genérico ("ajuste os filtros") deixa a
 * pessoa tentando às cegas qual dos seis filtros ativos matou o resultado.
 *
 * Como mede: para cada filtro ativo, refaz a MESMA pergunta sem ele e lê o
 * total. Isso é preciso por construção — nada de inferir da soma das contagens
 * por opção, que conta em dobro uma transação com duas tags.
 *
 * Só roda quando a lista está vazia E há filtro ativo: é uma rajada de
 * requisições pequenas, e o estado que a justifica é raro e sem saída sem ela.
 */
export function useNarrowestFilter({
  organizationId,
  filtersByKey,
  enabled = false,
  labelsByKey = {},
}) {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastSignature = useRef(null);

  // Assinatura por conteúdo: `filtersByKey` é reconstruído a cada render, e
  // comparar por referência refaria a rajada inteira a cada quadro.
  const signature = enabled && organizationId ? JSON.stringify(filtersByKey) : null;

  useEffect(() => {
    if (!signature) {
      setResult(null);
      lastSignature.current = null;
      return undefined;
    }
    if (lastSignature.current === signature) return undefined;
    lastSignature.current = signature;

    const byKey = JSON.parse(signature);
    const keys = Object.keys(byKey);
    if (keys.length === 0) {
      setResult(null);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    Promise.all(
      keys.map((key) =>
        getTransactionsFacetsForUi(
          buildTransactionsFacetsQuery({ organizationId, ...byKey[key], facets: ["type"] }),
        ).then((data) => ({ key, total: data?.total ?? null })),
      ),
    ).then((rows) => {
      if (cancelled) return;
      setIsLoading(false);
      // O "mais restritivo" é o que MAIS devolve quando sai — remover um filtro
      // que devolveria zero não ajudaria ninguém, então esses ficam de fora.
      const uteis = rows.filter((r) => typeof r.total === "number" && r.total > 0);
      /* ESPECÍFICO ANTES DE GRANDE. Uma chave com ":" nomeia um VALOR
         ("tag:#combustível"); sem ":", a faceta inteira ("tag").

         Ordenar só por quantidade nunca nomearia um valor: tirar as duas tags
         devolve por definição pelo menos tanto quanto tirar uma delas, então a
         faceta ganharia sempre — e a frase dizia «o filtro "2 tags (E)"» quando
         quem matou o resultado foi #combustível sozinho. Pior, o botão ao lado
         removia as duas, mais do que a pessoa precisava perder.

         Entre valores, e entre facetas, aí sim vale a quantidade. */
      /* A preferência vale DENTRO de cada faceta, não sobre todas. Descartar
         todo candidato de faceta assim que QUALQUER valor específico aparece
         jogava fora facetas sem relação: com duas tags e um piso de valor, se
         tirar a tag devolve 3 e tirar a faixa devolve 500, a frase afirmava
         «o filtro "#a" é o que mais restringe: sem ele voltam 3» — falso — e o
         botão removia o filtro errado.

         Então: por faceta, o valor específico ganha do grupo (é a resposta mais
         precisa para a MESMA pergunta); entre facetas, ganha quem devolve mais. */
      const porFaceta = new Map();
      for (const r of uteis) {
        const sep = r.key.indexOf(":");
        const faceta = sep > 0 ? r.key.slice(0, sep) : r.key;
        const atual = porFaceta.get(faceta);
        if (!atual) { porFaceta.set(faceta, r); continue; }
        const rEspecifico = sep > 0;
        const atualEspecifico = atual.key.includes(":");
        if (rEspecifico !== atualEspecifico) {
          if (rEspecifico) porFaceta.set(faceta, r);
        } else if (r.total > atual.total) {
          porFaceta.set(faceta, r);
        }
      }
      const best = [...porFaceta.values()].sort((a, b) => b.total - a.total)[0];
      setResult(best ? { key: best.key, label: labelsByKey[best.key] || best.key, total: best.total } : null);
    });

    return () => {
      cancelled = true;
      setIsLoading(false);
    };
    // `labelsByKey` fica fora: ele muda de identidade a cada render e só
    // alimenta o texto, nunca a medição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, organizationId]);

  return { narrowest: result, isLoading };
}
