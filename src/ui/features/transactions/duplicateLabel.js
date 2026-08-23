/**
 * Descrição da cópia ao duplicar um lançamento.
 *
 * `Uber` → `Uber (1)` → `Uber (2)`. O sufixo INCREMENTA em vez de empilhar
 * porque duplicar a duplicata é o caso comum — parcelar uma compra na mão,
 * repetir um lançamento semanal — e `Uber (1) (1)` não diz qual é a terceira.
 *
 * O número não conta quantas cópias existem: ele é lido da própria descrição
 * de origem. Contar exigiria varrer a lista inteira, e duas cópias feitas a
 * partir do mesmo original nasceriam com o mesmo nome de qualquer forma —
 * é um rótulo para a pessoa reconhecer, não um identificador.
 */
export function nextDuplicateLabel(desc) {
  const base = typeof desc === "string" ? desc.trim() : "";
  if (!base) return "";
  // O `\s*` antes do parêntese absorve o espaço, senão `Uber  (1)` viraria
  // `Uber  (2)` com o espaço duplo preservado.
  const m = /^(.*?)\s*\((\d+)\)$/.exec(base);
  if (m) {
    const prefixo = m[1].trim();
    const n = Number(m[2]);
    // `(0)` e `(007)` são texto de alguém, não sufixo nosso: só incrementa o
    // que este mesmo código produziria.
    if (prefixo && n >= 1 && String(n) === m[2]) return `${prefixo} (${n + 1})`;
  }
  return `${base} (1)`;
}
