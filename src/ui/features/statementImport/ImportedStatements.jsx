// Rascunho e histórico do Conciliar extrato (fincla-api#518).
//
// - `DraftInProgressCard`: a conciliação em andamento da conta, com "Continuar conciliação" e
//   "Descartar rascunho". Tudo fica no servidor; voltar abre exatamente onde parou.
// - `DiscardDraftControl`: descartar pede confirmação NA PÁGINA (nunca `window.confirm`).
// - `ImportedStatementsList`: "Extratos importados" da conta, com estado, contagens e a diferença
//   registrada ao concluir (`null` vira "—", nunca zero), e o caminho para o desfazer.
import { useState } from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn, Card } from "../../components/primitives";
import { plural } from "../../plural.js";
import { formatMoneySigned } from "../../money/formatMoney.js";
import { handleApiError } from "../../../api/client";
import { discardStatementImport } from "../../../api/statementImports";
import { bankDateLabel } from "./StatementEntryCard.jsx";
import { LINK } from "./StatementImportNotes.jsx";

const STATUS = {
  draft: { label: "Rascunho", color: T.blue, bg: T.blueLight },
  concluded: { label: "Concluída", color: T.green, bg: T.greenLight },
  undone: { label: "Desfeita", color: T.inkMid, bg: T.grayLight },
};


/** "2026-11-14T10:20:00" → "14/11/2026". */
function dayOf(timestamp) {
  return timestamp ? bankDateLabel(String(timestamp).slice(0, 10)) : "";
}

/** O período do extrato, ou `null` quando o arquivo não informou. */
export function periodLabel(period) {
  if (!period?.start || !period?.end) return null;
  return `${bankDateLabel(period.start)} a ${bankDateLabel(period.end)}`;
}

/** As contagens de uma importação, no tempo verbal do estado dela. */
export function countsLabel(item) {
  const { summary, status } = item;
  const parts = [plural(summary.total, "lançamento", "lançamentos")];
  if (status === "draft") parts.push(`${summary.to_create} a adicionar`);
  else if (status === "undone") parts.push(`${plural(summary.to_create, "adicionado", "adicionados")} e apagados ao desfazer`);
  else parts.push(plural(summary.to_create, "adicionado", "adicionados"));
  if (summary.grouped) parts.push(`${plural(summary.grouped, "somado", "somados")} em ${plural(summary.groups, "lançamento", "lançamentos")}`);
  if (summary.ignored) parts.push(plural(summary.ignored, "não registrado", "não registrados"));
  if (status === "draft" && summary.unanswered) parts.push(plural(summary.unanswered, "sem resposta", "sem resposta"));
  return parts.join(" · ");
}

function StatusPill({ status }) {
  const tone = STATUS[status] ?? STATUS.undone;
  return (
    <span data-testid="import-status" style={{ ...G, fontSize: 11, fontWeight: 700, color: tone.color, background: tone.bg, borderRadius: 9999, padding: "2px 9px", whiteSpace: "nowrap" }}>
      {tone.label}
    </span>
  );
}

export function DiscardDraftControl({ organizationId, accountId, importId, onDiscarded }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const discard = async () => {
    setBusy(true);
    setError("");
    try {
      await discardStatementImport(accountId, organizationId, importId);
      onDiscarded?.(importId);
    } catch (err) {
      setError(handleApiError(err));
      setBusy(false);
    }
  };

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} style={{ ...LINK, color: T.red }}>
        Descartar rascunho
      </button>
    );
  }
  return (
    <div role="group" aria-label="Confirmar descarte do rascunho" style={{ ...G, background: T.redLight, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 13, color: T.ink, margin: 0 }}>
        <b>Descartar esta conciliação?</b> As respostas que você deu serão apagadas e não dá para recuperar.
        Nada muda nas suas transações.
      </p>
      {error ? <p role="alert" style={{ fontSize: 13, color: T.red, margin: 0 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="outRed" small onClick={discard} disabled={busy}>{busy ? "Descartando…" : "Sim, descartar"}</Btn>
        <Btn variant="outGray" small onClick={() => { setAsking(false); setError(""); }} disabled={busy}>Manter rascunho</Btn>
      </div>
    </div>
  );
}

export function DraftInProgressCard({ organizationId, draft, onContinue, onDiscarded }) {
  const period = periodLabel(draft.period);
  return (
    <Card data-testid="draft-in-progress" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, borderColor: T.blue }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, margin: 0 }}>Conciliação em andamento</h2>
        <StatusPill status="draft" />
      </div>
      <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
        {period ? <>Extrato de <b style={NUM}>{period}</b> · </> : null}
        <span style={NUM}>{countsLabel(draft)}</span>
      </p>
      <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: 0 }}>
        Suas respostas estão salvas. Última alteração em <span style={NUM}>{dayOf(draft.last_activity_at)}</span>
        {draft.expires_at ? <>; se ficar parada, a conciliação é descartada em <span style={NUM}>{dayOf(draft.expires_at)}</span></> : null}.
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Btn variant="dark" onClick={() => onContinue(draft)}>Continuar conciliação</Btn>
        <DiscardDraftControl organizationId={organizationId} accountId={draft.account_id} importId={draft.id} onDiscarded={onDiscarded} />
      </div>
    </Card>
  );
}

function ImportedStatementRow({ item, first, onOpen, onUndo }) {
  const period = periodLabel(item.period);
  const dates = [`Importado em ${dayOf(item.created_at)}`];
  if (item.concluded_at) dates.push(`concluída em ${dayOf(item.concluded_at)}`);
  if (item.undone_at) dates.push(`desfeita em ${dayOf(item.undone_at)}`);
  // `null` = não registrada (antes da conferência de saldo, fincla-api#514): travessão, nunca zero.
  const difference = (item.final_difference == null ? null : formatMoneySigned(item.final_difference, item.final_difference_currency)) ?? "—";
  return (
    <li data-testid="imported-statement" style={{ ...G, display: "flex", flexDirection: "column", gap: 4, padding: "12px 16px", borderTop: first ? "none" : `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ ...NUM, fontSize: 14, color: T.ink }}>{period ?? "Período não informado"}</b>
        <StatusPill status={item.status} />
      </div>
      <span style={{ ...NUM, fontSize: 12, color: T.inkMid }}>{countsLabel(item)}</span>
      <span style={{ ...NUM, fontSize: 12, color: T.inkLight }}>{dates.join(" · ")}</span>
      {item.status !== "draft" ? (
        <span data-testid="import-difference" style={{ fontSize: 12, color: T.inkLight }}>
          Diferença de saldo registrada: <b style={{ ...NUM, color: T.ink }}>{difference}</b>
        </span>
      ) : null}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 2 }}>
        <button type="button" onClick={() => onOpen(item)} style={{ ...LINK, color: T.blue }}>
          {item.status === "draft" ? "Continuar conciliação" : "Ver conciliação"}
        </button>
        {item.latest_concluded ? (
          <button type="button" onClick={() => onUndo(item)} style={{ ...LINK, color: T.red }}>
            Desfazer importação
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function ImportedStatementsList({ items, onOpen, onUndo }) {
  return (
    <section aria-labelledby="imported-statements-title" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 id="imported-statements-title" style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, margin: 0 }}>Extratos importados</h2>
      {items.length ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((item, index) => (
              <ImportedStatementRow key={item.id} item={item} first={index === 0} onOpen={onOpen} onUndo={onUndo} />
            ))}
          </ul>
        </Card>
      ) : (
        <p style={{ ...G, fontSize: 13, color: T.inkLight, margin: 0 }}>Nenhum extrato importado nesta conta ainda.</p>
      )}
    </section>
  );
}
