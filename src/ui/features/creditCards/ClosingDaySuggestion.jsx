import { T } from "../../tokens";
import { G } from "../../typography";
import { suggestedClosingDay } from "./closingDay.js";

/**
 * "Não sabe o dia do fechamento?" — o dia é obrigatório, mas o usuário não fica travado:
 * com o vencimento informado, um toque preenche a sugestão (7 dias antes).
 */
export function ClosingDaySuggestion({ dueDay, closingDay, onUse }) {
  const suggestion = suggestedClosingDay(dueDay);
  if (suggestion == null || String(closingDay).trim() === String(suggestion)) return null;
  return (
    <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: -4, lineHeight: 1.5, minWidth: 0 }}>
      Não sabe o dia do fechamento?{" "}
      <button type="button" onClick={() => onUse(String(suggestion))}
        style={{ ...G, border: "none", background: "none", padding: 0, color: T.blue, fontWeight: 700, fontSize: 11, cursor: "pointer", textDecoration: "underline", textAlign: "left" }}>
        Usar dia {suggestion} (7 dias antes do vencimento)
      </button>
    </div>
  );
}
