// Etiquetas de uma transação nova da conciliação (fincla-api#513): só as da categoria escolhida.
import { Check } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";

const HELP = { ...G, fontSize: 11, color: T.inkLight };

/** As etiquetas ativas que pertencem à categoria. */
export function detailsOfCategory(details, categoryId) {
  if (!categoryId) return [];
  return details.filter((d) => d.parent_category_tag_id === categoryId && d.is_active !== false);
}

/**
 * Botões de liga/desliga com as etiquetas da categoria. Sem categoria, não há etiqueta: trocar a
 * categoria no backend tira as que não são dela, e a tela mostra o que voltou.
 */
export function DetailTagPicker({ categoryId, categoryLabel, details, selected, onChange }) {
  const own = detailsOfCategory(details, categoryId);
  if (!categoryId) return <span style={HELP}>Escolha uma categoria para ver as etiquetas dela.</span>;
  if (!own.length) return <span style={HELP}>Esta categoria não tem etiquetas.</span>;
  const chosen = new Set(selected ?? []);
  const toggle = (id) => {
    const next = chosen.has(id) ? [...chosen].filter((x) => x !== id) : [...chosen, id];
    onChange(next);
  };
  return (
    <div role="group" aria-label={`Etiquetas de ${categoryLabel}`} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {own.map((d) => {
        const on = chosen.has(d.id);
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(d.id)}
            style={{
              ...G, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 9999,
              border: `1px solid ${on ? T.blue : T.border}`, background: on ? T.blueLight : T.surface, color: on ? T.blue : T.inkMid,
            }}
          >
            {on ? <Check size={11} aria-hidden="true" /> : null}
            {d.label || d.name}
          </button>
        );
      })}
    </div>
  );
}
