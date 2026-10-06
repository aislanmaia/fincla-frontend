import { useNavigate, useParams } from "@tanstack/react-router";

import { T } from "../tokens";
import { G } from "../typography";
import { PageTitle } from "../components/primitives";
import { FC } from "../routing/searchContract.js";

/** Página provisória da rota de detalhe da fatura; o dashboard real a substitui. */
export function InvoiceDashboardPage() {
  const navigate = useNavigate();
  const { cardId, year, month } = useParams({ strict: false });
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <PageTitle sans="Dashboard da" serif="fatura" />
      <div style={{ ...G, fontSize: 13, color: T.inkMid }}>
        Fatura {String(month).padStart(2, "0")}/{year}: em construção.
      </div>
      <div>
        <button type="button" onClick={() => navigate({ to: "/cards", search: { [FC.VIEW]: "new", [FC.HUB_CARD]: Number(cardId) } })}
          style={{ ...G, fontSize: 12, fontWeight: 700, color: T.blue, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          ← Voltar para os cartões
        </button>
      </div>
    </div>
  );
}
