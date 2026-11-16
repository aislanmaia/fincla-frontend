/** Pedaços do pedido ao exportador que toda tela monta igual (fincla-api#520). */

/** O fuso IANA do navegador: dá o dia do nome do arquivo e a hora "gerado em" do cabeçalho. */
export const userTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Começo do nome do arquivo no formato que o servidor aceita (`^[a-z0-9][a-z0-9-]{0,99}$`): `base` mais o rótulo da
 * tela sem acento nem símbolo. Ex.: `filePrefixOf("cartao", "Azul •7112")` → `cartao-azul-7112`.
 */
export function filePrefixOf(base, label = "") {
  const slug = (text) =>
    String(text ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return [slug(base), slug(label)].filter(Boolean).join("-").slice(0, 100).replace(/-+$/, "") || "lancamentos";
}
