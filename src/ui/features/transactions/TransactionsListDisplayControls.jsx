import { DENSITIES } from "./listPrefs.js";
import { G } from "../../typography.js";
import { T } from "../../tokens.js";

export function TransactionsListDisplayControls({ density, grouped, canGroup, onDensityChange, onGroupChange }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "none" }}>
    <button type="button"
      onClick={() => {
        const order = Object.keys(DENSITIES);
        onDensityChange(order[(order.indexOf(density) + 1) % order.length]);
      }}
      title={`Densidade da lista: ${DENSITIES[density].label}`}
      aria-label={`Densidade da lista: ${DENSITIES[density].label}. Clique para alternar.`}
      style={{ ...G, flex: "none", width: 32, height: 32, borderRadius: 9, cursor: "pointer",
        border: `1px solid ${T.border}`, background: T.surface, color: T.inkMid,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
      ▤
    </button>
    <button type="button" disabled={!canGroup} onClick={onGroupChange}
      title={canGroup ? (grouped ? "Agrupado por data" : "Lista contínua") : "Agrupar por data só vale ordenando por data"}
      aria-pressed={grouped} aria-label="Agrupar por data"
      style={{ ...G, flex: "none", width: 32, height: 32, borderRadius: 9,
        cursor: canGroup ? "pointer" : "not-allowed", opacity: canGroup ? 1 : 0.4,
        border: `1px solid ${grouped ? "#BFD3FA" : T.border}`,
        background: grouped ? T.blueLight : T.surface, color: grouped ? T.blue : T.inkMid,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
      ▦
    </button>
  </div>;
}
