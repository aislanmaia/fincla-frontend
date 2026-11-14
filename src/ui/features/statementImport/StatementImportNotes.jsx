// Peças comuns da conciliação e do desfazer (fincla-api#507/#509).
import { Check } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { Btn, Card } from "../../components/primitives";

/** Botão com cara de link (ações secundárias da conciliação). */
export const LINK = { ...G, fontSize: 13, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" };

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div role="alert" style={{ ...G, fontSize: 13, color: T.red, background: T.redLight, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 12px" }}>
      {children}
    </div>
  );
}

/** "Importação desfeita": o que aconteceu (`children`) e para onde ir. */
export function ImportUndoneCard({ children, onOpenTransactions = null, onBack }) {
  return (
    <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.green, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Check size={18} aria-hidden="true" /> Importação desfeita
      </h2>
      <p style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>{children}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onOpenTransactions ? <Btn variant="dark" onClick={onOpenTransactions}>Ver transações da conta</Btn> : null}
        <Btn variant="outGray" onClick={onBack}>Voltar para Contas</Btn>
      </div>
    </Card>
  );
}
