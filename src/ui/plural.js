/** "1 item" / "3 itens": a contagem e a palavra concordam (pt-BR). */
export function plural(n, one, many) {
  return `${n} ${Number(n) === 1 ? one : many}`;
}
