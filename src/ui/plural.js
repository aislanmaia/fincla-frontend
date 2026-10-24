/** "1 item" / "3 itens" / "1.234 itens": a contagem e a palavra concordam e o número sai em pt-BR. */
export function plural(n, one, many) {
  const count = Number(n);
  const shown = typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("pt-BR") : n;
  return `${shown} ${count === 1 ? one : many}`;
}
