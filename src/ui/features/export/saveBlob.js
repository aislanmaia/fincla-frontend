/**
 * Baixa um blob como arquivo pelo navegador.
 *
 * O link fica no DOM durante o clique e a URL vive por um tempo: revogar na hora faz alguns navegadores salvarem o
 * arquivo sem nome nem extensão. Uma única implementação para todas as exportações.
 */
const REVOKE_AFTER_MS = 30000;

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, REVOKE_AFTER_MS);
}
