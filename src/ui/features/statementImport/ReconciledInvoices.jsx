// "Faturas conciliadas" do cartão (fincla-api#556): a mesma coluna de "Extratos importados" da conta
// (`ImportedStatementsList`: rascunhos no topo, os outros por ano, rolando dentro da coluna), com a
// linha da fatura. Rascunho: "Continuar conciliação" (abre no passo em que parou) e "Descartar
// rascunho". Concluída: "Ver conciliação" e, só na mais recente do cartão, "Desfazer"; nas outras, o
// motivo de não poder. Diferença `null` = não registrada → "—", nunca zero.
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { plural } from "../../plural.js";
import { formatMoney, formatMoneySigned } from "../../money/formatMoney.js";
import { DiscardDraftControl, ImportedStatementsList, StatusPill, dayOf } from "./ImportedStatements.jsx";
import { touchHeight } from "./UndoPreviewScreen.jsx";
import { INVOICE_STEPS, invoiceMonthLabel } from "./invoiceSteps.js";

/** O mês da fatura ordena e agrupa ("2026-12-01"): é por ele que a pessoa procura. */
const invoiceDay = (item) => `${item.invoice.year}-${String(item.invoice.month).padStart(2, "0")}-01`;

/** As contagens da conciliação, no tempo verbal do estado dela. Zero não vira parte. */
export function invoiceCountsLabel(item) {
  const { summary, status } = item;
  const parts = [plural(summary.total, "lançamento", "lançamentos")];
  if (summary.to_pair) {
    if (status === "draft") parts.push(plural(summary.to_pair, "compra a ligar", "compras a ligar"));
    else if (status === "undone") parts.push(plural(summary.to_pair, "compra ligada e desfeita", "compras ligadas e desfeitas"));
    else parts.push(plural(summary.to_pair, "compra ligada", "compras ligadas"));
  }
  // Compras novas (fincla-api#557).
  if (summary.to_create) {
    if (status === "draft") parts.push(plural(summary.to_create, "compra nova a adicionar", "compras novas a adicionar"));
    else if (status === "undone") parts.push(plural(summary.to_create, "compra nova adicionada e desfeita", "compras novas adicionadas e desfeitas"));
    else parts.push(plural(summary.to_create, "compra nova adicionada", "compras novas adicionadas"));
  }
  if (summary.already_reconciled) parts.push(plural(summary.already_reconciled, "já conferido", "já conferidos"));
  if (summary.ignored) parts.push(plural(summary.ignored, "não registrado", "não registrados"));
  if (status === "draft" && summary.unanswered) parts.push(plural(summary.unanswered, "sem resposta", "sem resposta"));
  return parts.join(" · ");
}

function recordedDifference(money) {
  if (!money) return "—";
  return Math.abs(money.amount) < 0.005 ? formatMoney(0, money.currency) : formatMoneySigned(money.amount, money.currency) ?? "—";
}

function ReconciledInvoiceRow({ item, first, organizationId, touch, discard, onOpen, onUndo, onDiscarded }) {
  const step = INVOICE_STEPS.find((s) => s.key === item.current_step);
  return (
    <li data-testid="reconciled-invoice" data-status={item.status} style={{ ...G, display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderTop: first ? "none" : `1px solid ${T.grayLight}`, fontSize: 13 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ color: T.ink }}>Fatura de {invoiceMonthLabel(item.invoice)}</b>
        <StatusPill status={item.status} />
      </span>
      <span style={{ ...NUM, fontSize: 12, color: T.inkMid }}>{invoiceCountsLabel(item)}</span>
      {item.status === "draft" ? (
        <span style={{ fontSize: 12, color: T.inkLight }}>
          {step ? <>Você parou em <b style={{ color: T.ink }}>{step.title}</b>. </> : null}
          {item.expires_at ? <>Se ficar parada, é descartada em <span style={NUM}>{dayOf(item.expires_at)}</span>.</> : null}
        </span>
      ) : (
        <span data-testid="import-difference" style={{ fontSize: 12, color: T.inkLight }}>
          {item.status === "undone" && item.undone_at ? <>Desfeita em <span style={NUM}>{dayOf(item.undone_at)}</span> · </> : null}
          {item.status === "concluded" && item.concluded_at ? <>Concluída em <span style={NUM}>{dayOf(item.concluded_at)}</span> · </> : null}
          Diferença registrada: <b style={{ ...NUM, color: T.ink }}>{recordedDifference(item.final_difference)}</b>
        </span>
      )}
      <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
        <Btn variant="outGray" small={!touch} onClick={() => onOpen(item)} style={touchHeight(touch)}>
          {item.status === "draft" ? "Continuar conciliação" : "Ver conciliação"}
        </Btn>
        {item.status === "draft" ? (
          <DiscardDraftControl organizationId={organizationId} importId={item.id} discard={() => discard(item)} onDiscarded={onDiscarded} touch={touch} />
        ) : null}
        {/* Só a concluída mais recente do cartão pode ser desfeita (a tela do desfazer diz se a fatura já foi paga). */}
        {item.latest_concluded ? (
          <Btn variant="outRed" small={!touch} aria-label="Desfazer conciliação" onClick={() => onUndo(item)} style={touchHeight(touch)}>Desfazer</Btn>
        ) : null}
        {item.status === "concluded" && !item.latest_concluded ? (
          <span data-testid="undo-not-latest" style={{ fontSize: 11, color: T.inkLight }}>Só a conciliação mais recente do cartão pode ser desfeita.</span>
        ) : null}
      </span>
    </li>
  );
}

/**
 * @param discard (item) => Promise: descarta o rascunho pela rota do cartão.
 * @param onDiscarded recarrega a lista.
 */
export function ReconciledInvoicesList({ items, organizationId, isMobile = false, discard, onOpen, onUndo, onDiscarded }) {
  return (
    <ImportedStatementsList
      items={items}
      isMobile={isMobile}
      title="Faturas conciliadas"
      emptyText="Nenhuma fatura deste cartão conciliada ainda."
      orderDay={invoiceDay}
      onOpen={onOpen}
      onUndo={onUndo}
      renderRow={(item, first) => (
        <ReconciledInvoiceRow
          item={item}
          first={first}
          organizationId={organizationId}
          touch={isMobile}
          discard={discard}
          onOpen={onOpen}
          onUndo={onUndo}
          onDiscarded={onDiscarded}
        />
      )}
    />
  );
}
