import { ChevronDown, Repeat, Search, X } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { M_MONO } from "../moodV4";
import { DateGroup } from "./CardFaturaList.jsx";
import { CategoryBars, LimitBar } from "./cartoesPanels.jsx";

/**
 * Conteúdo da aba "Fatura" (lista + sidebar). Único componente atende
 * tanto mobile (`variant="mobile"`) quanto desktop (`variant="desktop"`),
 * com diferenças pequenas mas estáveis: grid de 1 coluna vs 2 colunas,
 * tamanho dos labels do KPI mini-grid, e o card extra de Análise de
 * gastos (`<CategoryBars/>`) que só aparece no mobile.
 */
export function InvoiceTab({
  variant,
  // data
  card,
  invoice,
  previousInvoice,
  filtered,
  displayItems,
  grouped,
  pagedGroups,
  categoryTotals,
  recurringTotal,
  averageValue,
  diffPercent,
  totalItems,
  visibleItems,
  hasMoreGroups,
  pastItemsLoading,
  isCurrent,
  shouldUseRealData,
  totalInstallments,
  // style
  usagePercent,
  usageColor,
  pageGroupsLimit,
  // helpers
  formatBRL,
  categoryColor,
  // filters / search
  search,
  setSearch,
  invoiceFilterChips,
  filterCategory,
  setFilterCategory,
  // listing
  expandedDate,
  setExpandedDate,
  visibleGroups,
  setVisibleGroups,
  // refund entry point
  onLaunchRefund,
  onOpenTransaction,
  onDeleteTransaction,
}) {
  const isMobile = variant === "mobile";
  const gridCols = isMobile ? "1fr" : "minmax(0,1fr) 300px";
  const kpiLabelSize = isMobile ? 8 : 10;
  const averageLabelColor = isMobile ? T.inkMid : T.inkLight;

  return (
    <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 12px" }}>
            <Search size={13} color={T.inkLight} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lançamentos..."
              style={{ ...G, flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: T.ink }} />
            {search && (
              <button onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                <X size={13} color={T.inkLight} />
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {invoiceFilterChips.map(([c, color]) => (
              <button key={c} onClick={() => setFilterCategory(filterCategory === c ? null : c)} title={c}
                style={{ width: 20, height: 20, borderRadius: 6, background: color, border: `2.5px solid ${filterCategory === c ? T.ink : "transparent"}`, cursor: "pointer", opacity: filterCategory && filterCategory !== c ? 0.25 : 1, transition: "all 0.15s" }} />
            ))}
            {filterCategory && (
              <button onClick={() => setFilterCategory(null)}
                style={{ ...G, fontSize: 10, color: T.inkMid, background: T.grayLight, border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink }}>
              {displayItems.length > 0
                ? `${filtered.length} de ${displayItems.length} lançamentos`
                : `Fatura ${invoice?.mes} · ${invoice?.pago ? "Paga" : "Pendente"}`}
            </span>
            {filtered.length > 0 && (
              <button onClick={() => setExpandedDate(expandedDate === null ? grouped[0]?.[0] : null)}
                style={{ ...G, fontSize: 11, color: T.blue, background: "none", border: "none", cursor: "pointer" }}>
                {expandedDate === null ? "Recolher tudo" : "Expandir tudo"}
              </button>
            )}
          </div>
          {pastItemsLoading && !isCurrent ? (
            <div style={{ textAlign: "center", padding: "36px 20px" }}>
              <div style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando lançamentos…</div>
            </div>
          ) : grouped.length > 0 ? (
            pagedGroups.map(([date, items]) => (
              <DateGroup key={date} date={date} items={items} card={card} invoice={invoice}
                expandedDate={expandedDate} setExpandedDate={setExpandedDate}
                categoryColor={categoryColor} formatBRL={formatBRL} onLaunchRefund={onLaunchRefund}
                onOpenTransaction={onOpenTransaction} onDeleteTransaction={onDeleteTransaction} />
            ))
          ) : displayItems.length > 0 && filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 20px" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🔍</div>
              <div style={{ ...G, fontSize: 13, color: T.inkMid }}>Nenhum resultado</div>
            </div>
          ) : shouldUseRealData ? (
            <div style={{ textAlign: "center", padding: "36px 20px" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📭</div>
              <div style={{ ...G, fontSize: 13, color: T.inkMid }}>Nenhum lançamento encontrado</div>
              <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 4 }}>
                Fatura {invoice?.mes} · {formatBRL((invoice?.val || 0))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "36px 20px" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🔍</div>
              <div style={{ ...G, fontSize: 13, color: T.inkMid }}>Nenhum resultado</div>
            </div>
          )}
          {filtered.length > 0 && hasMoreGroups && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderTop: `1px solid ${T.border}` }}>
              <span style={{ ...G, fontSize: 12, color: T.inkMid }}>
                {visibleItems} de {totalItems} lançamentos
              </span>
              <span style={{ ...M_MONO, ...NUM, fontSize: 16, fontWeight: 800, color: T.ink }}>
                {formatBRL(filtered.reduce((s, i) => s + i.val, 0))}
              </span>
            </div>
          )}
          {filtered.length > 0 && (
            hasMoreGroups ? (
              <button type="button" onClick={() => setVisibleGroups((v) => v + pageGroupsLimit)}
                style={{ ...G, width: "100%", padding: "13px 20px", background: T.bg, border: "none", borderTop: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700, color: T.inkMid, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.grayLight; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = T.bg; }}>
                <ChevronDown size={14} color={T.inkMid} /> Mostrar mais {Math.min(pageGroupsLimit, grouped.length - visibleGroups)} grupos · {grouped.slice(visibleGroups, visibleGroups + pageGroupsLimit).reduce((s, [, items]) => s + items.length, 0)} lançamentos
              </button>
            ) : (
              <div style={{ ...G, display: "flex", alignItems: "center", justifyContent: "center", padding: "13px 20px", borderTop: `1px solid ${T.border}`, background: T.bg, fontSize: 12, fontWeight: 700, color: T.inkMid, gap: 7 }}>
                {grouped.length} {grouped.length === 1 ? "grupo" : "grupos"} · {totalItems} {totalItems === 1 ? "lançamento" : "lançamentos"}
              </div>
            )
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <LimitBar card={card} usagePercent={usagePercent} usageColor={usageColor} formatBRL={formatBRL} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            {[
              { label: "Disponível", val: formatBRL(card.disponivel), c: usageColor },
              { label: "Utilizado", val: formatBRL(card.limite - card.disponivel), c: T.ink },
              { label: "Limite", val: formatBRL(card.limite), c: T.inkMid },
              { label: "Parcelas", val: formatBRL(totalInstallments), c: T.blue },
            ].map((k, i) => (
              <div key={i} style={{ background: T.bg, borderRadius: 9, padding: "9px 10px" }}>
                <div style={{ ...G, fontSize: kpiLabelSize, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{k.label}</div>
                <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: k.c }}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>
        {isMobile && isCurrent && categoryTotals.length > 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Análise de gastos</div>
            <div style={{ ...G, fontSize: 10, color: T.inkLight, marginBottom: 14 }}>Clique para filtrar</div>
            <CategoryBars categoryTotals={categoryTotals} filterCategory={filterCategory} setFilterCategory={setFilterCategory} formatBRL={formatBRL} />
            {recurringTotal > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 9, padding: "8px 12px", marginTop: 14 }}>
                <Repeat size={12} color={T.purple} />
                <span style={{ ...G, fontSize: 11, color: T.inkMid }}>Assinaturas: <strong style={{ color: T.purple }}>{formatBRL(recurringTotal)}</strong></span>
              </div>
            )}
          </div>
        )}
        {previousInvoice && (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: averageLabelColor, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>Média mensal</div>
            <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, color: T.ink }}>{formatBRL(averageValue)}</div>
            <div style={{ ...G, fontSize: 11, fontWeight: 600, marginTop: 4, color: diffPercent > 0 ? T.red : T.green }}>
              {diffPercent > 0 ? "↑" : "↓"} {Math.abs(diffPercent)}% vs {previousInvoice.mes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
