import React, { useState } from "react";
import { FileSpreadsheet, FileText, FileType2 } from "lucide-react";

import { exportTransactions } from "../../../api/transactions";
import { Btn } from "../../components/primitives.jsx";
import { SideDrawer } from "../../components/SideDrawer.jsx";
import { currencyInfo } from "../../money/currencyRegistry.js";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { todayLocalYmd } from "../../data/transactionsAdapter.js";
import { EXPORT_MAX_ROWS, SELECTION_MAX_IDS, exportFailureMessage, selectionTooLargeMessage } from "./exportFailure.js";
import { userTimezone } from "./exportRequest.js";
import { exportTexts } from "./exportTexts.js";
import { useIsNarrow } from "../../useIsNarrow.js";
import {
  UNAVAILABLE,
  byCurrencyLine,
  conversionNote,
  exportTotalsFromSummary,
  moneyOrUnavailable,
  signedOrUnavailable,
} from "./exportTotals.js";
import { saveBlob } from "./saveBlob.js";

/**
 * O painel de exportação compartilhado (fincla-api#520, variante D do protótipo): drawer à direita com três passos
 * numerados — "Lançamentos exportados", "Formato do arquivo", "Totais do relatório" — e a prévia do arquivo ao lado.
 *
 * A tela entrega tudo o que só ela sabe: o título de origem, o prefixo do nome do arquivo, os filtros ativos em texto,
 * os parâmetros de filtro da listagem (o MESMO objeto que pediu o resumo), a contagem do recorte e o resumo que ela
 * já tem. O painel não filtra e não soma: o arquivo sai do exportador do servidor, com os totais do mesmo resumo.
 *
 * `summaryError` é o motivo de o resumo do recorte não ter vindo (a tela que pede o resumo só ao abrir o painel).
 * `selection` ({ ids, count, summary, error }) é a "Exportar seleção" (#524): troca o recorte pelos marcados. `summary` é
 * o resumo pedido com os mesmos `ids` (totais só dos marcados); `error`, o motivo de ele não ter vindo.
 * `formats` diz quais formatos o servidor já gera; PDF, quando presente, vem selecionado (senão, o CSV).
 * `fullScreen` é o modo celular (#527): quem usa decide pelo limite de 700 px.
 * Abaixo de 700 px de largura a prévia lateral não aparece (não cabe ao lado dos passos); a tela cheia com
 * "Ver prévia do arquivo" é da #527.
 */

export const FORMAT_OPTIONS = {
  pdf: { label: "PDF", hint: "Para ler e enviar", Icon: FileText },
  xlsx: { label: "XLSX", hint: "Planilha do Excel, para editar e fazer contas", Icon: FileSpreadsheet },
  csv: { label: "CSV", hint: "Texto simples, para outros sistemas", Icon: FileType2 },
};

/** Os formatos que o exportador do servidor já gera, na ordem do protótipo. PDF (#523) entra aqui, na frente. */
export const AVAILABLE_EXPORT_FORMATS = ["xlsx", "csv"];

/** O formato que abre selecionado: PDF quando houver; até lá, o CSV de sempre. */
export const initialExportFormat = (formats) =>
  formats.includes("pdf") ? "pdf" : formats.includes("csv") ? "csv" : formats[0];

const PDF_CONTENT = [
  { key: "full", label: "Completo", hint: "Resumo, categorias e a lista de lançamentos" },
  { key: "summary", label: "Só o resumo", hint: "Uma página, sem a lista — bom para mostrar a alguém" },
];

const countText = (n) => Number(n ?? 0).toLocaleString("pt-BR");
const TEXTS = exportTexts("pt-BR");
/** Abaixo de 700 px (o limite do painel, D4 da #520) a prévia lateral sai. */
export const PREVIEW_MIN_WIDTH = 700;

function ExportStep({ n, title, children }) {
  return (
    <section aria-label={title} style={{ display: "flex", gap: 10 }}>
      <span
        aria-hidden="true"
        style={{
          ...G, flex: "0 0 22px", height: 22, borderRadius: 999, background: T.ink, color: "#fff",
          fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center",
        }}
      >
        {n}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ ...G, margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</h3>
        {children}
      </div>
    </section>
  );
}

function ScopeStep({ selection, count, filtersText }) {
  if (selection) {
    return (
      <p style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>
        <b>{TEXTS.selected(selection.count)}</b>. Saem só os que você marcou.
      </p>
    );
  }
  return (
    <>
      <p style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>
        Sai o recorte inteiro: <b>{TEXTS.entries(count)}</b>, não só o que está carregado na tela.
      </p>
      <ul aria-label="Filtros ativos" style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
        {(filtersText.length ? filtersText : [TEXTS.noFilters]).map((text) => (
          <li
            key={text}
            style={{
              ...G, fontSize: 11, color: T.inkMid, background: T.bg, border: `1px solid ${T.border}`,
              borderRadius: 999, padding: "3px 9px",
            }}
          >
            {text}
          </li>
        ))}
      </ul>
      <span style={{ ...G, fontSize: 11, color: T.inkLight }}>
        Para mudar o recorte, feche o painel e ajuste os filtros da tela.
      </span>
    </>
  );
}

function FormatStep({ formats, format, onFormat, content, onContent }) {
  return (
    <>
      <div role="group" aria-label="Formato do arquivo" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(formats.length, 3)}, 1fr)`, gap: 6 }}>
        {formats.map((key) => {
          const { label, Icon } = FORMAT_OPTIONS[key];
          const active = format === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onFormat(key)}
              style={{
                ...G, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px",
                border: `1.5px solid ${active ? T.blue : T.border}`, borderRadius: 10,
                background: active ? T.blueLight : T.surface, cursor: "pointer", fontWeight: 700, fontSize: 12,
                color: active ? T.blue : T.ink,
              }}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{FORMAT_OPTIONS[format].hint}.</span>
      {format === "pdf" && (
        <div role="radiogroup" aria-label="Conteúdo do PDF" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {PDF_CONTENT.map((option) => (
            <label
              key={option.key}
              style={{
                ...G, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, cursor: "pointer",
                padding: "7px 9px", borderRadius: 8, border: `1px solid ${content === option.key ? T.blue : T.border}`,
                background: content === option.key ? T.blueLight : T.surface,
              }}
            >
              <input
                type="radio"
                name="pdf-content"
                checked={content === option.key}
                onChange={() => onContent(option.key)}
                style={{ marginTop: 2 }}
              />
              <span>
                <b>{option.label}</b>
                <span style={{ display: "block", fontSize: 11, color: T.inkLight }}>{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </>
  );
}

const resultColor = (value) => (value == null ? T.amber : value < 0 ? T.red : T.green);

function TotalCell({ label, value, color }) {
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", minWidth: 0 }}>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function TotalsStep({ totals, error }) {
  if (error) {
    return <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>Não foi possível calcular os totais: {error}</p>;
  }
  if (!totals) {
    return <p style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>Os totais ainda estão carregando.</p>;
  }
  const note = conversionNote(totals);
  const perCurrency = byCurrencyLine(totals);
  return (
    <>
      <div data-testid="export-totals" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
        <TotalCell label="Resultado" value={signedOrUnavailable(totals.result, totals.currency)} color={resultColor(totals.result)} />
        <TotalCell label="Receitas" value={moneyOrUnavailable(totals.income, totals.currency)} color={T.green} />
        <TotalCell label="Despesas" value={moneyOrUnavailable(totals.expenses, totals.currency)} color={T.red} />
        <TotalCell label="Estornos" value={moneyOrUnavailable(totals.refunds, totals.currency)} color={T.green} />
      </div>
      <span style={{ ...G, ...NUM, fontSize: 11, color: T.inkMid }}>
        {TEXTS.entries(totals.count)} · {TEXTS.pendingIncluded(totals.pending)}
      </span>
      {perCurrency && <span style={{ ...G, ...NUM, fontSize: 11, color: T.inkMid }}>Por moeda: {perCurrency}</span>}
      {note && <p style={{ ...G, margin: 0, fontSize: 11, color: totals.unavailable ? T.amber : T.inkMid }}>{note}</p>}
    </>
  );
}

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

/** O número como o CSV o escreve: ponto decimal, casas da moeda pelo registro; ausência = "indisponível". */
const csvNumber = (value, currency) => (value == null ? UNAVAILABLE : Number(value).toFixed(currencyInfo(currency).decimalPlaces));

/** Prévia montada no cliente com os mesmos dados do passo 3. Orienta; não é o arquivo final. */
export function buildCsvPreview({ title, filtersText, selection, totals }) {
  const line = (description, value = "", currency = "") => ["", description, "", "", value, currency, ""];
  const meta = [
    line(title),
    line("Sua organização · gerado agora"),
    ...(selection ? [line(TEXTS.selected(selection.count))] : (filtersText.length ? filtersText : [TEXTS.noFilters]).map((t) => line(t))),
  ];
  const note = conversionNote(totals);
  if (note) meta.push(line(note));
  const cur = totals?.currency ?? "";
  const resultLine = line("RESULTADO", csvNumber(totals?.result, cur), cur);
  const block = totals
    ? [
        resultLine,
        line("RECEITAS", csvNumber(totals.income, cur), cur),
        line("DESPESAS", csvNumber(totals.expenses == null ? null : -totals.expenses, cur), cur),
        line("ESTORNOS", csvNumber(totals.refunds, cur), cur),
        line(TEXTS.fileCountLine(totals.count, totals.pending)),
        ...(totals.mixed
          ? totals.byCurrency.map((item) => line(`RESULTADO EM ${item.currency}`, csvNumber(item.result, item.currency), item.currency))
          : []),
      ]
    : [];
  const header = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Moeda", "Situação"];
  const rows = [line(`… ${TEXTS.entries(totals?.count)}, um por linha …`)];
  return [...meta, null, ...block, null, header, ...rows, null, resultLine]
    .map((cells) => (cells ? cells.map(csvCell).join(",") : ""))
    .join("\n");
}

function CsvPreview(props) {
  return (
    <pre
      style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 14, fontSize: 11,
        lineHeight: 1.5, overflowX: "auto", margin: 0, color: T.ink, whiteSpace: "pre",
      }}
    >
      {buildCsvPreview(props)}
    </pre>
  );
}

const SHEET_COLUMNS = ["A", "B", "C", "D", "E", "F", "G"];
const TABLE_HEADER = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Moeda", "Situação"];

/** Um número como a planilha o mostra em pt-BR: casas da moeda pelo registro, sem símbolo (a moeda vai na coluna F). */
const sheetNumber = (value, currency) => {
  if (value == null) return UNAVAILABLE;
  const places = currencyInfo(currency).decimalPlaces;
  return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: places, maximumFractionDigits: places });
};

/**
 * A planilha que o servidor vai gerar (#522), linha a linha, com os mesmos dados do passo 3: topo, bloco de totais,
 * cabeçalho congelado, um marcador no lugar dos lançamentos, só o Resultado embaixo e o resumo por categoria.
 * Com uma moeda (e lançamentos) os totais são fórmulas; aqui elas aparecem como o Excel em pt-BR as mostra.
 */
export function buildXlsxPreview({ title, filtersText, selection, totals }) {
  const row = (cells, kind = "plain", formula = null) => ({ cells, kind, formula });
  const top = [
    row([title]),
    row(["Sua organização · gerado agora"]),
    ...(selection ? [TEXTS.selected(selection.count)] : (filtersText.length ? filtersText : [TEXTS.noFilters])).map((t) =>
      row([t], "muted"),
    ),
  ];
  const note = conversionNote(totals);
  if (note) top.push(row([note], totals?.unavailable ? "warning" : "muted"));
  if (totals?.mixed) {
    const symbols = [...totals.byCurrency].sort((a, b) => a.currency.localeCompare(b.currency)).map((item) => currencyInfo(item.currency).symbol);
    top.push(row([TEXTS.fixedTotals(symbols)], "warning"));
  }
  const cur = totals?.currency ?? "";
  const count = totals?.count ?? 0;
  const formulas = Boolean(totals) && count > 0 && !totals.mixed && !totals.unavailable;
  const blockSize = 6 + (totals?.mixed ? totals.byCurrency.length : 0);
  const headerRow = top.length + 1 + blockSize + 1 + 1; // 1-based: topo, branco, bloco, branco, cabeçalho
  const span = (col) => `${col}${headerRow + 1}:${col}${headerRow + count}`;
  const sumIf = (label) => `=SOMASE(${span("D")};"${label}";${span("E")})`;
  const fx = (formula) => (formulas ? formula : null);
  const total = (label, value, formula, kind = "total") =>
    row([label, "", "", "", sheetNumber(value, cur), cur, ""], kind, fx(formula));
  const resultFormula = `=SOMA(${span("E")})`;
  const block = totals
    ? [
        total("RESULTADO", totals.result, resultFormula, "result"),
        total("RECEITAS", totals.income, sumIf("Receita")),
        total("DESPESAS", totals.expenses == null ? null : -totals.expenses, sumIf("Despesa")),
        total("ESTORNOS", totals.refunds, sumIf("Estorno")),
        row([TEXTS.countLabel, "", "", "", String(count), "", ""], "total", fx(`=CONT.VALORES(${span("D")})`)),
        row([TEXTS.pendingLabel, "", "", "", String(totals.pending), "", ""], "total",
          fx(`=CONT.VALORES(${span("G")})-CONT.SE(${span("G")};"Paga")`)),
        ...(totals.mixed
          ? totals.byCurrency.map((item) =>
              row([`RESULTADO EM ${item.currency}`, "", "", "", sheetNumber(item.result, item.currency), item.currency, ""], "muted"))
          : []),
      ]
    : [];
  const blank = row([]);
  return {
    formulas,
    headerRow,
    rows: [
      ...top,
      blank,
      ...block,
      blank,
      row(TABLE_HEADER, "header"),
      row(["", `… ${TEXTS.entries(count)}, um por linha …`], "placeholder"),
      ...(totals ? [total("RESULTADO", totals.result, resultFormula, "result")] : []),
      blank,
      row(["Categoria", "Lançamentos", "", "", "Total líquido", "Moeda", ""], "header"),
      row(["… uma linha por categoria e moeda …"], "placeholder"),
    ],
  };
}

const SHEET_ROW_STYLE = {
  plain: {}, muted: { color: T.inkLight }, warning: { color: T.amber }, placeholder: { color: T.inkGhost, fontStyle: "italic" },
  total: { fontWeight: 700 }, result: { fontWeight: 700, background: T.greenLight },
  header: { fontWeight: 700, background: T.grayLight },
};

function XlsxPreview(props) {
  const { rows, headerRow, formulas } = buildXlsxPreview(props);
  const resultFormula = rows.find((r) => r.formula)?.formula;
  const cellStyle = { border: `1px solid ${T.border}`, padding: "3px 6px", whiteSpace: "nowrap", fontSize: 11 };
  return (
    <div data-testid="export-preview-sheet" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ ...G, fontSize: 11, color: T.inkMid }}>
        ▲ Linhas 1–{headerRow} congeladas: título, filtros, totais e o cabeçalho da tabela ficam visíveis ao rolar.
        Abaixo dos lançamentos, só o Resultado.{" "}
        {formulas ? "Os totais são fórmulas: mudam se você corrigir ou apagar uma linha." : ""}
      </span>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ ...G, display: "flex", gap: 8, background: T.grayLight, borderBottom: `1px solid ${T.border}`, padding: "4px 8px", fontSize: 11, color: T.inkMid }}>
          <span style={{ fontFamily: "monospace" }}>fx</span>
          <span style={{ fontFamily: "monospace", color: resultFormula ? T.ink : T.inkGhost }}>{resultFormula ?? "valores fixos"}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ ...G, ...NUM, borderCollapse: "collapse", color: T.ink }}>
            <thead>
              <tr>
                <th aria-hidden="true" style={{ ...cellStyle, background: T.grayLight }} />
                {SHEET_COLUMNS.map((col) => (
                  <th key={col} scope="col" style={{ ...cellStyle, background: T.grayLight, fontWeight: 500, color: T.inkGhost }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, index) => (
                <tr
                  key={index}
                  data-frozen-end={index + 1 === headerRow ? "true" : undefined}
                  style={{ ...SHEET_ROW_STYLE[r.kind], borderBottom: index + 1 === headerRow ? `3px solid ${T.inkGhost}` : undefined }}
                >
                  <td style={{ ...cellStyle, background: T.grayLight, color: T.inkGhost, textAlign: "center" }}>{index + 1}</td>
                  {SHEET_COLUMNS.map((col, j) => (
                    <td key={col} title={j === 4 && r.formula ? r.formula : undefined} style={{ ...cellStyle, textAlign: j === 4 ? "right" : "left" }}>
                      {r.cells[j] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Uma prévia por formato; PDF (#523) acrescenta a sua aqui. */
const PREVIEWS = { csv: CsvPreview, xlsx: XlsxPreview };

function FilePreview({ format, data }) {
  const Preview = PREVIEWS[format];
  return (
    <div
      data-testid="export-preview"
      style={{ background: T.grayLight, borderRadius: 10, padding: 12, minWidth: 0, minHeight: 0, overflow: "auto" }}
    >
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Prévia do arquivo ({FORMAT_OPTIONS[format].label})
      </div>
      <Preview {...data} />
    </div>
  );
}

export function ExportPanel({
  title,
  filePrefix,
  filtersText = [],
  filterParams,
  count,
  summary,
  summaryError = null,
  selection = null,
  formats = AVAILABLE_EXPORT_FORMATS,
  fullScreen = false,
  onClose,
}) {
  const [format, setFormat] = useState(() => initialExportFormat(formats));
  const [content, setContent] = useState("full");
  const [status, setStatus] = useState({ busy: false, error: "" });
  const narrow = useIsNarrow(PREVIEW_MIN_WIDTH - 1);
  const showPreview = !fullScreen && !narrow;

  const totals = exportTotalsFromSummary(selection ? selection.summary : summary);
  const sliceCount = selection ? selection.count : (count ?? totals?.count ?? 0);
  const selectionTooLarge = Boolean(selection) && sliceCount > SELECTION_MAX_IDS;
  const tooLarge = !selection && sliceCount > EXPORT_MAX_ROWS;

  const runExport = async () => {
    setStatus({ busy: true, error: "" });
    try {
      const { blob, fileName } = await exportTransactions({
        ...filterParams,
        ...(selection ? { ids: selection.ids } : {}),
        format,
        ...(format === "pdf" ? { content } : {}),
        title,
        filters_text: selection ? [] : filtersText,
        file_prefix: filePrefix,
        timezone: userTimezone(),
        locale: "pt-BR",
      });
      saveBlob(blob, fileName || `${filePrefix}-${todayLocalYmd()}.${format}`);
      setStatus({ busy: false, error: "" });
      onClose();
    } catch (error) {
      setStatus({ busy: false, error: exportFailureMessage(error) });
    }
  };

  const footer = (
    <>
      <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
      <Btn variant="dark" full disabled={status.busy || tooLarge || selectionTooLarge} onClick={runExport}>
        {status.busy ? "Gerando arquivo…" : `Exportar ${FORMAT_OPTIONS[format].label}`}
      </Btn>
    </>
  );

  return (
    <SideDrawer
      title={selection ? "Exportar seleção" : "Exportar"}
      onClose={onClose}
      width={820}
      fullScreen={fullScreen}
      footer={footer}
      testId="export-panel"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showPreview ? "minmax(240px, 300px) minmax(0, 1fr)" : "minmax(0, 1fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <ExportStep n={1} title="Lançamentos exportados">
            <ScopeStep selection={selection} count={sliceCount} filtersText={filtersText} />
            {tooLarge && (
              <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>
                O recorte tem {countText(sliceCount)} lançamentos e o limite por arquivo é {countText(EXPORT_MAX_ROWS)}.
                Estreite os filtros e exporte de novo.
              </p>
            )}
            {selectionTooLarge && (
              <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>{selectionTooLargeMessage(sliceCount)}</p>
            )}
          </ExportStep>
          <ExportStep n={2} title="Formato do arquivo">
            <FormatStep formats={formats} format={format} onFormat={setFormat} content={content} onContent={setContent} />
          </ExportStep>
          <ExportStep n={3} title="Totais do relatório">
            <TotalsStep totals={totals} error={selectionTooLarge ? "a seleção passou do limite." : selection ? selection.error : summaryError} />
          </ExportStep>
          {status.error && (
            <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>{status.error}</p>
          )}
        </div>
        {showPreview && PREVIEWS[format] && (
          <FilePreview format={format} data={{ title, filtersText, selection, totals }} />
        )}
      </div>
    </SideDrawer>
  );
}
