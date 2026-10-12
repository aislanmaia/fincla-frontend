import { Card } from "../../components/primitives.jsx";
import { formatMoney } from "../../money/formatMoney.js";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";

const COLORS = [T.blue, T.green, T.amber, T.purple, T.red, T.inkMid];
const validAmount = (row) => row.amount != null && Number.isFinite(Number(row.amount)) && row.amount_currency;
const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Donut({ rows, total }) {
  let offset = 0;
  return <svg role="img" aria-label="Distribuição das saídas por categoria" viewBox="0 0 100 100" width="112" height="112" style={{ flex: "none" }}>
    <circle cx="50" cy="50" r={RADIUS} fill="none" stroke={T.grayLight} strokeWidth="14" />
    {total > 0 && rows.map((row, index) => {
      const share = Math.abs(Number(row.amount)) / total;
      const length = share * CIRCUMFERENCE;
      const segment = <circle key={`${row.category}-${index}`} cx="50" cy="50" r={RADIUS} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="14" strokeDasharray={`${length} ${CIRCUMFERENCE - length}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)" />;
      offset += length;
      return segment;
    })}
  </svg>;
}

/**
 * Resumo do recorte filtrado: total, donut e legenda de categorias. Os valores vêm do
 * backend sobre TODO o resultado filtrado, não da página carregada. A legenda é
 * clicável: marcar uma categoria isola a tela inteira nela (mesmo filtro da faceta).
 */
export function CardTransactionsSummary({ summary, loading, error, isCategorySelected, onToggleCategory }) {
  const categories = (summary?.breakdown?.by_category ?? []).filter(validAmount);
  const currencies = [...new Set(categories.map((row) => row.amount_currency))];
  const totals = (summary?.by_currency ?? []).filter((row) => row?.currency && row.amount != null && row.amount !== "" && Number.isFinite(Number(row.amount)));
  return <Card as="section" aria-label="Resumo dos lançamentos filtrados" style={{ padding: 18, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
    <div><h2 style={{ ...G, fontSize: 15, margin: "0 0 4px" }}>Resumo do recorte</h2><p style={{ ...G, fontSize: 11, color: T.inkMid, margin: 0 }}>Todos os lançamentos que correspondem aos filtros · dados da API</p></div>
    {loading && <p role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>Carregando resumo…</p>}
    {error && <p role="alert" style={{ ...G, fontSize: 12, color: T.inkMid }}>Não foi possível carregar o resumo.</p>}
    {summary && <strong style={{ ...G, ...NUM, fontSize: 22 }}>{summary.total_transactions} lançamento{summary.total_transactions === 1 ? "" : "s"}</strong>}
    {summary && <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={{ ...G, fontSize: 11, color: T.inkMid }}>Total movimentado no recorte</span>{totals.length === 0 ? <strong style={{ ...G, ...NUM, fontSize: 16 }}>—</strong> : totals.map((row) => <strong key={row.currency} style={{ ...G, ...NUM, fontSize: 16 }}>{formatMoney(row.amount, row.currency) ?? "—"}</strong>)}</div>}
    {summary && currencies.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Sem gastos por categoria neste recorte.</p>}
    {currencies.map((currency) => {
      const rows = categories.filter((row) => row.amount_currency === currency);
      const sum = rows.reduce((acc, row) => acc + Math.abs(Number(row.amount)), 0);
      return <div key={currency} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {currencies.length > 1 && <h3 style={{ ...G, margin: 0, fontSize: 11, color: T.inkMid }}>{currency}</h3>}
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <Donut rows={rows} total={sum} />
          <ul aria-label={`Categorias em ${currency}`} style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map((row, index) => {
              // `null` = a categoria não existe no catálogo: sem id não há filtro possível.
              const state = isCategorySelected ? isCategorySelected(row.category) : false;
              const selected = state === true;
              const clickable = Boolean(onToggleCategory) && state !== null;
              const percent = sum > 0 ? Math.round(Math.abs(Number(row.amount)) / sum * 100) : 0;
              const content = <>
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 99, flex: "none", background: COLORS[index % COLORS.length] }} />
                <span style={{ ...G, flex: 1, minWidth: 0, fontSize: 11, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: selected ? 700 : 400 }} title={row.category}>{row.category}</span>
                <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{percent}%</span>
                <strong style={{ ...G, ...NUM, fontSize: 11, whiteSpace: "nowrap" }}>{formatMoney(row.amount, currency) ?? "—"}</strong>
              </>;
              const rowStyle = { display: "flex", alignItems: "center", gap: 7, width: "100%", minHeight: 26, padding: "2px 6px", borderRadius: 7, border: 0, background: selected ? T.blueLight : "none" };
              return <li key={`${row.category}-${index}`}>
                {clickable
                  ? <button type="button" aria-pressed={selected} aria-label={`Filtrar por ${row.category}`} onClick={() => onToggleCategory(row.category)} style={{ ...rowStyle, cursor: "pointer" }}>{content}</button>
                  : <div style={rowStyle}>{content}</div>}
              </li>;
            })}
          </ul>
        </div>
      </div>;
    })}
  </Card>;
}
