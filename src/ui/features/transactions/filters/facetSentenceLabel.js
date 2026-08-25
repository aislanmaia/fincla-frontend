/**
 * O rótulo de uma faceta DENTRO DE UMA FRASE.
 *
 * O chip da barra e a frase do vazio querem coisas diferentes. O chip mostra só
 * o valor e precisa fazer sentido sozinho, então alguns valores já se
 * apresentam: "3 tags (E)", "3 categorias". A frase quer nomear a faceta — e
 * prefixar um valor que já se nomeia produzia «O filtro "Tags: 3 tags (E)"»,
 * com a palavra duas vezes. É a mesma redundância que o desfazer tinha, quando
 * dizia "Desfazer: voltar para Desfazer: remover Alimentação".
 *
 * A comparação é pela RAIZ — primeira palavra do rótulo, sem acento e sem o
 * plural. É o que faz "Tags"/"3 tags" e "Categoria"/"3 categorias" casarem sem
 * fazer "Recorrência" casar com "Apenas rec.".
 */
export function semAcento(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function facetSentenceLabel(label, value) {
  const valor = String(value ?? "");
  const raiz = semAcento(label).split(" ")[0].replace(/s$/, "");
  /* Raiz curta demais não serve de evidência: uma palavra de duas letras casa
     com qualquer coisa por acidente. */
  const jaSeNomeia = raiz.length > 2 && semAcento(valor).includes(raiz);
  return jaSeNomeia ? valor : `${label}: ${valor}`;
}
