import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileSpreadsheet, FileText, FileType2 } from "lucide-react";

import { exportTransactions } from "../../../api/transactions";
import { Btn } from "../../components/primitives.jsx";
import { SideDrawer } from "../../components/SideDrawer.jsx";
import { currencyInfo } from "../../money/currencyRegistry.js";
import { formatMoneyNumber } from "../../money/formatMoney.js";
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
 * `formats` diz quais formatos o servidor gera (PDF, XLSX e CSV, nessa ordem); o PDF vem selecionado.
 * Modo celular (#527): abaixo de 700 px de largura (o limite do próprio painel, D4 da #520) o painel ocupa a tela
 * inteira, só com os três passos — a prévia lateral não cabe. O link "Ver prévia do arquivo" troca os passos pela
 * prévia, também em tela cheia; voltar (botão, seta do cabeçalho ou Esc) devolve os passos. Formato e conteúdo vivem
 * no estado do painel, que não desmonta na troca, então a escolha se mantém.
 *
 * Layout lateral (≥ 700 px), nas proporções da variante D aprovada: drawer de ~800 px (`EXPORT_DRAWER_WIDTH`), coluna
 * dos passos de 300 px com as ações (Cancelar + o primário) presas ao fundo DELA, e a coluna da prévia, cinza, na altura
 * toda. Dentro da prévia o arquivo é uma folha em pé (A4, `PAGE_RATIO`) que cabe na altura e não estica na largura;
 * o que não couber rola dentro da folha. Numa tela menor é a prévia que encolhe, não os passos.
 */

export const FORMAT_OPTIONS = {
  pdf: { label: "PDF", hint: "Para ler e enviar", Icon: FileText },
  xlsx: { label: "XLSX", hint: "Planilha do Excel, para editar e fazer contas", Icon: FileSpreadsheet },
  csv: { label: "CSV", hint: "Texto simples, para outros sistemas", Icon: FileType2 },
};

/** Os formatos que o exportador do servidor já gera, na ordem do protótipo. PDF (#523) entra aqui, na frente. */
export const AVAILABLE_EXPORT_FORMATS = ["pdf", "xlsx", "csv"];

/** O formato que abre selecionado: PDF; sem ele (tela que restrinja os formatos), o CSV. */
export const initialExportFormat = (formats) =>
  formats.includes("pdf") ? "pdf" : formats.includes("csv") ? "csv" : formats[0];

const PDF_CONTENT = [
  { key: "full", label: "Completo", hint: "Resumo, categorias e a lista de lançamentos" },
  { key: "summary", label: "Só o resumo", hint: "Uma página, sem a lista — bom para mostrar a alguém" },
];

const TEXTS = exportTexts("pt-BR");
/** Abaixo de 700 px (o limite do painel, D4 da #520) a prévia lateral sai. */
export const PREVIEW_MIN_WIDTH = 700;
/**
 * Largura do drawer lateral (protótipo D: 820 px): 56% da tela entre 760 e 860 px — ~806 px numa tela de 1440, 860 px
 * numa tela larga (mais que isso só sobraria cinza ao lado da folha em pé); abaixo de 760 px de tela, a tela toda.
 * Percentual do contêiner fixo, nunca `vw`.
 */
export const EXPORT_DRAWER_WIDTH = "min(100%, clamp(760px, 56%, 860px))";
/** Coluna dos passos: 300 px, como no protótipo. A prévia fica com o resto e encolhe primeiro. */
export const EXPORT_STEPS_COLUMN = "300px";
/** Proporção da folha da prévia: A4 em pé (altura = largura × 1,414). */
export const PAGE_RATIO = 1.414;
/** A folha cabe no palco da prévia: largura limitada pela largura do palco e pela altura ÷ 1,414 (container units). */
export const PAGE_WIDTH = `min(100cqw, calc(100cqh / ${PAGE_RATIO}))`;

function ExportStep({ n, title, children }) {
  return (
    <section aria-label={title} style={{ display: "flex", gap: 10 }}>
      <span
        aria-hidden="true"
        style={{
          ...G, flex: "0 0 22px", height: 22, borderRadius: 999, background: T.ink, color: T.surface,
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

function ScopeStep({ selection, count, countFailed, filtersText }) {
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
        {/* Sem a contagem (a tela não a tem e o resumo ainda não chegou): "contando…", nunca 0 (ausência ≠ zero). */}
        Sai o recorte inteiro: <b>{count != null ? TEXTS.entries(count) : countFailed ? "contagem indisponível" : "contando…"}</b>, não só o que está carregado na tela.
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

/**
 * "Incluir saldo" (fincla-api#541). Quem decide se a opção existe é o servidor (`balance_statement` do resumo do
 * mesmo recorte); o painel só mostra. Disponível: marcada por padrão. Indisponível: desativada, com o motivo em
 * texto (a frase do servidor). Sem a resposta (resumo carregando), a opção não aparece.
 */
function BalanceOption({ availability, checked, onChange }) {
  if (!availability) return null;
  const available = Boolean(availability.available);
  return (
    <label
      data-testid="export-balance-option"
      style={{
        ...G, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, padding: "7px 9px", borderRadius: 8,
        border: `1px solid ${available && checked ? T.blue : T.border}`,
        background: available && checked ? T.blueLight : T.surface,
        cursor: available ? "pointer" : "default", color: available ? T.ink : T.inkMid,
      }}
    >
      <input
        type="checkbox"
        checked={available && checked}
        disabled={!available}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby="export-balance-hint"
        style={{ marginTop: 2 }}
      />
      <span>
        <b>{TEXTS.balanceOption}</b>
        <span id="export-balance-hint" style={{ display: "block", fontSize: 11, color: available ? T.inkLight : T.inkMid }}>
          {available ? TEXTS.balanceHint : availability.message || "O saldo não está disponível para este recorte."}
        </span>
      </span>
    </label>
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
  const perCurrency = byCurrencyLine(totals, TEXTS);
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
export function buildCsvPreview({ title, filtersText, selection, totals, balance = null }) {
  const width = balance ? 9 : 7;
  const line = (description, value = "", currency = "") => {
    const cells = Array(width).fill("");
    cells[1] = description;
    cells[4] = value;
    cells[5] = currency;
    return cells;
  };
  const meta = [
    line(title),
    line("Sua organização · gerado agora"),
    ...(selection ? [line(TEXTS.selected(selection.count))] : (filtersText.length ? filtersText : [TEXTS.noFilters]).map((t) => line(t))),
  ];
  const note = conversionNote(totals);
  if (note) meta.push(line(note));
  if (balance) meta.push(line(TEXTS.balanceAccounts));
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
  if (balance) {
    // O extrato (#541): Saldo anterior no topo, Saldo e Observação em cada linha, Saldo final junto do Total.
    const balanceLine = (day, label) => {
      const cells = line(label, "", cur);
      cells[0] = day ?? "";
      cells[7] = `(${TEXTS.balancePending})`;
      return cells;
    };
    return [
      ...meta, null, ...block, null, [...header, TEXTS.balanceColumn, TEXTS.noteColumn],
      balanceLine(TEXTS.dayBefore(balance.from), TEXTS.balanceOpening),
      line(`… ${TEXTS.entries(totals?.count)} e o que mexeu na conta (fatura paga, transferência, ajuste), com o saldo depois de cada linha …`),
      null, resultLine, balanceLine(balance.to, TEXTS.balanceClosing),
    ]
      .map((cells) => (cells ? cells.map(csvCell).join(",") : ""))
      .join("\n");
  }
  return [...meta, null, ...block, null, header, ...rows, null, resultLine]
    .map((cells) => (cells ? cells.map(csvCell).join(",") : ""))
    .join("\n");
}

function CsvPreview({ fill = false, ...props }) {
  return (
    <pre
      style={{
        background: T.surface, border: fill ? 0 : `1px solid ${T.border}`, borderRadius: fill ? 0 : 6, padding: 14, fontSize: 11,
        lineHeight: 1.5, overflowX: fill ? "visible" : "auto", margin: 0, color: T.ink, whiteSpace: "pre",
        ...(fill ? { minHeight: "100%", boxSizing: "border-box", width: "max-content", minWidth: "100%" } : {}),
      }}
    >
      {buildCsvPreview(props)}
    </pre>
  );
}

const SHEET_COLUMNS = ["A", "B", "C", "D", "E", "F", "G"];
const STATEMENT_SHEET_COLUMNS = [...SHEET_COLUMNS, "H", "I"];
const TABLE_HEADER = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Moeda", "Situação"];

/** Um número como a planilha o mostra em pt-BR: casas da moeda pelo registro, sem símbolo (a moeda vai na coluna F). */
const sheetNumber = (value, currency) => formatMoneyNumber(value, currency) ?? UNAVAILABLE;

/**
 * A planilha que o servidor vai gerar (#522), linha a linha, com os mesmos dados do passo 3: topo, bloco de totais,
 * cabeçalho congelado, um marcador no lugar dos lançamentos, só o Resultado embaixo e o resumo por categoria.
 * Com uma moeda (e lançamentos) os totais são fórmulas; aqui elas aparecem como o Excel em pt-BR as mostra.
 */
export function buildXlsxPreview({ title, filtersText, selection, totals, balance = null }) {
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
  if (balance) top.push(row([TEXTS.balanceAccounts], "muted"));
  if (totals?.mixed) {
    const symbols = [...totals.byCurrency].sort((a, b) => a.currency.localeCompare(b.currency)).map((item) => currencyInfo(item.currency).symbol);
    top.push(row([TEXTS.fixedTotals(symbols)], "warning"));
  }
  const cur = totals?.currency ?? "";
  const count = totals?.count ?? 0;
  const formulas = Boolean(totals) && count > 0 && !totals.mixed && !totals.unavailable;
  const blockSize = 6 + (totals?.mixed ? totals.byCurrency.length : 0);
  const headerRow = top.length + 1 + blockSize + 1 + 1; // 1-based: topo, branco, bloco, branco, cabeçalho
  // No extrato a tabela começa no Saldo anterior e traz linhas que não são lançamentos: os totais somam por Tipo.
  const span = (col) => (balance ? `${col}${headerRow + 1}:${col}${headerRow + 1 + count}` : `${col}${headerRow + 1}:${col}${headerRow + count}`);
  const sumIfTerm = (label) => `SOMASE(${span("D")};"${label}";${span("E")})`;
  const sumIf = (label) => `=${sumIfTerm(label)}`;
  const fx = (formula) => (formulas ? formula : null);
  const pad = balance ? ["", ""] : [];
  const total = (label, value, formula, kind = "total") =>
    row([label, "", "", "", sheetNumber(value, cur), cur, "", ...pad], kind, fx(formula));
  const resultFormula = balance
    ? `=${["Receita", "Despesa", "Estorno"].map(sumIfTerm).join("+")}`
    : `=SOMA(${span("E")})`;
  const countFormula = balance
    ? `=${["Receita", "Despesa", "Estorno"].map((label) => `CONT.SE(${span("D")};"${label}")`).join("+")}`
    : `=CONT.VALORES(${span("D")})`;
  const block = totals
    ? [
        total("RESULTADO", totals.result, resultFormula, "result"),
        total("RECEITAS", totals.income, sumIf("Receita")),
        total("DESPESAS", totals.expenses == null ? null : -totals.expenses, sumIf("Despesa")),
        total("ESTORNOS", totals.refunds, sumIf("Estorno")),
        row([TEXTS.countLabel, "", "", "", TEXTS.number(count), "", ""], "total", fx(countFormula)),
        row([TEXTS.pendingLabel, "", "", "", TEXTS.number(totals.pending), "", ""], "total",
          fx(`=CONT.VALORES(${span("G")})-CONT.SE(${span("G")};"Paga")`)),
        ...(totals.mixed
          ? totals.byCurrency.map((item) =>
              row([`RESULTADO EM ${item.currency}`, "", "", "", sheetNumber(item.result, item.currency), item.currency, ""], "muted"))
          : []),
      ]
    : [];
  const blank = row([]);
  const balanceRow = (day, label) =>
    row([day ? TEXTS.day(day) : "", label, "", "", "", cur, "", `(${TEXTS.balancePending})`, ""], "total");
  const table = balance
    ? [
        row([...TABLE_HEADER, TEXTS.balanceColumn, TEXTS.noteColumn], "header"),
        balanceRow(TEXTS.dayBefore(balance.from), TEXTS.balanceOpening),
        row(["", `… ${TEXTS.entries(count)} e o que mexeu na conta, com o saldo depois de cada linha …`], "placeholder"),
        ...(totals ? [total("RESULTADO", totals.result, resultFormula, "result")] : []),
        balanceRow(balance.to, TEXTS.balanceClosing),
      ]
    : [
        row(TABLE_HEADER, "header"),
        row(["", `… ${TEXTS.entries(count)}, um por linha …`], "placeholder"),
        ...(totals ? [total("RESULTADO", totals.result, resultFormula, "result")] : []),
      ];
  return {
    formulas,
    headerRow,
    columns: balance ? STATEMENT_SHEET_COLUMNS : SHEET_COLUMNS,
    rows: [
      ...top,
      blank,
      ...block,
      blank,
      ...table,
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

function XlsxPreview({ fill = false, ...props }) {
  const { rows, headerRow, formulas, columns } = buildXlsxPreview(props);
  const resultFormula = rows.find((r) => r.formula)?.formula;
  const cellStyle = { border: `1px solid ${T.border}`, padding: "3px 6px", whiteSpace: "nowrap", fontSize: 11 };
  return (
    <div data-testid="export-preview-sheet" style={{ display: "flex", flexDirection: "column", gap: 6, ...(fill ? { padding: 12 } : {}) }}>
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
                {columns.map((col) => (
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
                  {columns.map((col, j) => (
                    <td key={col} title={j === 4 && r.formula ? r.formula : undefined} style={{ ...cellStyle, textAlign: j === 4 || j === 7 ? "right" : "left" }}>
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

/**
 * O PDF que o servidor vai gerar (#523, variante D), bloco a bloco, com os mesmos dados do passo 3: cabeçalho,
 * Resultado com as barras de receitas, estornos e despesas, o resultado por moeda e a nota de cotação, o resumo por
 * categoria (marcador: o painel não tem as linhas) e, conforme `content`, a lista com o rodapé de totais ou a nota de
 * "Só o resumo". Orienta; não é o arquivo final.
 */
export function buildPdfPreview({ title, filtersText, selection, totals, content = "full", balance = null }) {
  const t = totals;
  const currency = t?.currency ?? "";
  const flow = t
    ? [
        { label: "Receitas", value: t.income, tone: "green" },
        { label: "Estornos", value: t.refunds, tone: "green" },
        { label: "Despesas", value: t.expenses, tone: "red" },
      ]
    : [];
  const largest = Math.max(1, ...flow.map((item) => Math.abs(item.value ?? 0)));
  const boxes = t
    ? [
        { label: "Resultado", text: signedOrUnavailable(t.result, currency) },
        { label: "Receitas", text: moneyOrUnavailable(t.income, currency) },
        { label: "Despesas", text: moneyOrUnavailable(t.expenses, currency) },
        { label: "Estornos", text: moneyOrUnavailable(t.refunds, currency) },
      ]
    : [];
  return {
    title,
    scope: selection ? [TEXTS.selected(selection.count)] : filtersText.length ? filtersText : [TEXTS.noFilters],
    result: t ? signedOrUnavailable(t.result, currency) : null,
    resultValue: t?.result ?? null,
    countLine: t ? TEXTS.pdfCountLine(t.count, t.pending) : null,
    flow: flow.map((item) => ({
      ...item, text: moneyOrUnavailable(item.value, currency), share: item.value == null ? 0 : Math.abs(item.value) / largest,
    })),
    byCurrency: byCurrencyLine(t, TEXTS),
    note: conversionNote(t),
    noteWarning: Boolean(t?.unavailable),
    // O extrato (#541): Saldo anterior e Saldo final no resumo (também em "Só o resumo") e a coluna Saldo na lista.
    balance: balance
      ? {
          line: `${TEXTS.balanceOpening} (${TEXTS.day(TEXTS.dayBefore(balance.from))}) · ${TEXTS.balanceClosing} (${TEXTS.day(balance.to)}): ${TEXTS.balancePending}`,
          accounts: TEXTS.balanceAccounts,
        }
      : null,
    columns: balance
      ? ["Data", "Descrição", "Categoria", "Tipo", "Situação", "Valor", TEXTS.balanceColumn]
      : ["Data", "Descrição", "Categoria", "Tipo", "Situação", "Valor"],
    list: content === "full"
      ? {
          placeholder: balance
            ? `${TEXTS.balanceOpening} no topo; … ${TEXTS.entries(t?.count)} e o que mexeu na conta, com o saldo depois de cada linha; ${TEXTS.balanceClosing} junto do Total …`
            : `… ${TEXTS.entries(t?.count)}, um por linha …`,
          boxes,
        }
      : null,
    summaryNote: content === "summary" ? TEXTS.summaryOnlyNote(t?.count) : null,
  };
}

const PDF_TONE = { green: T.green, red: T.red };

function PdfPreview({ fill = false, ...props }) {
  const pdf = buildPdfPreview(props);
  const small = { ...G, fontSize: 11, color: T.inkMid };
  const label = { ...G, fontSize: 11, color: T.inkLight, textTransform: "uppercase", letterSpacing: ".05em" };
  return (
    <div
      data-testid="export-preview-pdf"
      style={{
        ...G, background: T.surface, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 4, padding: "18px 20px",
        display: "flex", flexDirection: "column", gap: 10, boxShadow: T.md,
        // Dentro da folha em pé: a folha já é o papel; o conteúdo ocupa a página e o rodapé desce ao fim dela.
        ...(fill ? { border: 0, borderRadius: 0, boxShadow: "none", minHeight: "100%", boxSizing: "border-box" } : {}),
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
        <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <div style={label}>Fincla · relatório de lançamentos</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{pdf.title}</div>
          <div style={small}>Sua organização · gerado agora</div>
        </div>
        <div style={{ ...small, textAlign: "right", marginLeft: "auto", minWidth: 0, overflowWrap: "anywhere" }}>
          {pdf.scope.map((text) => <div key={text}>{text}</div>)}
        </div>
      </div>
      {pdf.result !== null && (
        // Sem largura para os dois lados, as barras descem para baixo do Resultado (nada se sobrepõe).
        <div data-testid="export-preview-pdf-result" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <div style={{ flex: "1 1 150px", minWidth: 0 }}>
            <div style={label}>Resultado do recorte</div>
            <div style={{ ...NUM, fontSize: 22, fontWeight: 700, color: resultColor(pdf.resultValue), overflowWrap: "anywhere" }}>{pdf.result}</div>
            <div style={small}>{pdf.countLine}</div>
          </div>
          <div style={{ flex: "1 1 190px", minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            {pdf.flow.map((item) => (
              <div key={item.label} style={{ display: "grid", gridTemplateColumns: "max-content minmax(24px, 1fr) auto", gap: 6, alignItems: "center", fontSize: 11 }}>
                <span>{item.label}</span>
                <span style={{ height: 7, background: T.bg, borderRadius: 4 }}>
                  <span style={{ display: "block", width: `${item.share * 100}%`, height: "100%", background: PDF_TONE[item.tone], borderRadius: 4 }} />
                </span>
                <span style={{ ...NUM, fontWeight: 700, textAlign: "right" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {pdf.byCurrency && <div style={{ ...small, ...NUM }}>Por moeda: {pdf.byCurrency}</div>}
      {pdf.note && <div style={{ ...small, color: pdf.noteWarning ? T.amber : T.inkMid }}>{pdf.note}</div>}
      {pdf.balance && (
        <div data-testid="export-preview-pdf-balance" style={{ ...small, ...NUM }}>
          <div style={{ fontWeight: 700, color: T.ink }}>{pdf.balance.line}</div>
          <div>{pdf.balance.accounts}</div>
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700 }}>Por categoria</div>
      <div style={{ ...small, color: T.inkGhost, fontStyle: "italic" }}>… uma linha por categoria e moeda: barra, quantidade e total líquido …</div>
      {pdf.list && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Lançamentos</div>
          {/* O cabeçalho nunca encolhe abaixo do texto: sem largura, rola na horizontal dentro da prévia. */}
          <div data-testid="export-preview-pdf-table" style={{ overflowX: "auto", borderBottom: `1.5px solid ${T.ink}`, paddingBottom: 3 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {pdf.columns.map((name) => (
                <span key={name} style={{ ...label, flex: "1 0 auto", whiteSpace: "nowrap", textAlign: name === "Valor" || name === TEXTS.balanceColumn ? "right" : "left" }}>{name}</span>
              ))}
            </div>
          </div>
          <div style={{ ...small, color: T.inkGhost, fontStyle: "italic" }}>{pdf.list.placeholder} (o cabeçalho se repete em cada página)</div>
          <div style={{ borderTop: `1.5px solid ${T.ink}`, paddingTop: 6 }}>
            <div style={label}>Totais do recorte</div>
            <div data-testid="export-preview-pdf-boxes" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {pdf.list.boxes.map((box) => (
                <div key={box.label} style={{ flex: "1 1 104px", border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 6px", minWidth: 0 }}>
                  <div style={label}>{box.label}</div>
                  <div style={{ ...NUM, fontSize: 11, fontWeight: 700, overflowWrap: "anywhere" }}>{box.text}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {pdf.summaryNote && (
        <div style={{ ...small, color: T.inkLight, borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>{pdf.summaryNote}</div>
      )}
      <div style={{ ...small, color: T.inkLight, display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
        <span>Fincla · Sua organização</span>
        <span>Página 1 de N</span>
      </div>
    </div>
  );
}

/** Uma prévia por formato. */
const PREVIEWS = { pdf: PdfPreview, csv: CsvPreview, xlsx: XlsxPreview };

/**
 * A prévia. Ao lado dos passos (`asPage`): coluna cinza na altura toda, com o arquivo numa folha A4 em pé que cabe no
 * palco e rola por dentro. Na prévia em tela cheia do celular: o arquivo corre na largura, e o painel rola.
 */
function FilePreview({ format, data, asPage = true }) {
  const Preview = PREVIEWS[format];
  const caption = (
    <div style={{ ...G, flex: "none", fontSize: 11, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
      Prévia do arquivo ({FORMAT_OPTIONS[format].label})
    </div>
  );
  if (!asPage) {
    return (
      <div data-testid="export-preview" style={{ background: T.grayLight, borderRadius: 10, padding: 12, minWidth: 0 }}>
        {caption}
        <Preview {...data} />
      </div>
    );
  }
  return (
    <div
      data-testid="export-preview"
      style={{
        background: T.grayLight, borderRadius: 10, padding: 12, minWidth: 0, minHeight: 0, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      {caption}
      <div data-testid="export-preview-stage" style={{ flex: 1, minHeight: 0, containerType: "size" }}>
        <div
          data-testid="export-preview-page"
          className="fincla-scroll"
          style={{
            width: PAGE_WIDTH, aspectRatio: `1 / ${PAGE_RATIO}`, margin: "0 auto", boxSizing: "border-box",
            overflow: "auto", overscrollBehavior: "contain", background: T.surface, borderRadius: 4, boxShadow: T.md,
          }}
        >
          <Preview {...data} fill />
        </div>
      </div>
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
  onClose,
}) {
  const [format, setFormat] = useState(() => initialExportFormat(formats));
  const [content, setContent] = useState("full");
  // "Incluir saldo" (#541): marcada por padrão; só vale quando o servidor disse que o recorte tem saldo.
  const [balanceChosen, setBalanceChosen] = useState(true);
  const [status, setStatus] = useState({ busy: false, error: "" });
  const fullScreen = useIsNarrow(PREVIEW_MIN_WIDTH - 1);
  const showPreview = !fullScreen;
  // A prévia em tela cheia só existe no modo celular: se a tela alargar, os passos voltam com a prévia ao lado.
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewScreen = fullScreen && previewOpen;
  const previewLinkRef = useRef(null);
  const wasPreviewScreen = useRef(false);
  useEffect(() => {
    if (!fullScreen && previewOpen) setPreviewOpen(false);
  }, [fullScreen, previewOpen]);
  // Ao voltar da prévia, o foco volta ao link que a abriu (depois do foco que o drawer põe nele mesmo na troca).
  useEffect(() => {
    if (wasPreviewScreen.current && !previewScreen) previewLinkRef.current?.focus();
    wasPreviewScreen.current = previewScreen;
  }, [previewScreen]);
  const closePreview = () => setPreviewOpen(false);

  const totals = exportTotalsFromSummary(selection ? selection.summary : summary);
  const sliceCount = selection ? selection.count : (count ?? totals?.count ?? null);
  const selectionTooLarge = Boolean(selection) && sliceCount > SELECTION_MAX_IDS;
  const tooLarge = !selection && sliceCount != null && sliceCount > EXPORT_MAX_ROWS;
  const totalsError = selectionTooLarge ? "a seleção passou do limite." : selection ? selection.error : summaryError;
  const balanceAvailability = (selection ? selection.summary : summary)?.balance_statement ?? null;
  const includeBalance = Boolean(balanceAvailability?.available) && balanceChosen;
  const balance = includeBalance ? { from: filterParams?.date_start ?? null, to: filterParams?.date_end ?? null } : null;

  const runExport = async () => {
    setStatus({ busy: true, error: "" });
    try {
      const { blob, fileName } = await exportTransactions({
        // Na seleção o servidor ignora os filtros do recorte; mandá-los só ocuparia a URL (16 KiB, G3-2-07).
        ...(selection ? { organization_id: filterParams.organization_id, ids: selection.ids } : filterParams),
        format,
        ...(format === "pdf" ? { content } : {}),
        ...(includeBalance ? { include_balance: true } : {}),
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

  // As ações: no celular, no rodapé do drawer; ao lado da prévia, presas ao fundo da coluna dos passos (protótipo D).
  const actions = (
    <>
      {previewScreen
        ? <Btn variant="outGray" onClick={closePreview}>Voltar ao painel</Btn>
        : <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>}
      <Btn variant="dark" full disabled={status.busy || tooLarge || selectionTooLarge || !totals} onClick={runExport}>
        {status.busy ? "Gerando arquivo…" : `Exportar ${FORMAT_OPTIONS[format].label}`}
      </Btn>
    </>
  );

  return (
    <SideDrawer
      title={previewScreen ? "Prévia do arquivo" : selection ? "Exportar seleção" : "Exportar"}
      onClose={previewScreen ? closePreview : onClose}
      closeLabel={previewScreen ? "Voltar ao painel" : "Fechar"}
      closeIcon={previewScreen ? ArrowLeft : undefined}
      view={previewScreen ? "preview" : "steps"}
      width={EXPORT_DRAWER_WIDTH}
      fullScreen={fullScreen}
      footer={fullScreen ? actions : null}
      testId="export-panel"
    >
      {previewScreen ? (
        <FilePreview format={format} data={{ title, filtersText, selection, totals, content, balance }} asPage={false} />
      ) : (
      <div
        data-testid="export-panel-layout"
        style={
          showPreview
            ? {
                display: "grid", gridTemplateColumns: `${EXPORT_STEPS_COLUMN} minmax(0, 1fr)`, gap: 18,
                alignItems: "stretch", height: "100%", minHeight: 0,
              }
            : { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18, alignItems: "start" }
        }
      >
        <div
          data-testid="export-steps-column"
          style={showPreview ? { display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0 } : { minWidth: 0 }}
        >
        <div
          data-testid="export-steps"
          className={showPreview ? "fincla-scroll" : undefined}
          style={{
            display: "flex", flexDirection: "column", gap: 18, minWidth: 0,
            ...(showPreview ? { flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingRight: 4 } : {}),
          }}
        >
          <ExportStep n={1} title="Lançamentos exportados">
            <ScopeStep selection={selection} count={sliceCount} countFailed={Boolean(totalsError)} filtersText={filtersText} />
            {tooLarge && (
              <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>
                O recorte tem {TEXTS.number(sliceCount)} lançamentos e o limite por arquivo é {TEXTS.number(EXPORT_MAX_ROWS)}.
                Estreite os filtros e exporte de novo.
              </p>
            )}
            {selectionTooLarge && (
              <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>{selectionTooLargeMessage(sliceCount)}</p>
            )}
          </ExportStep>
          <ExportStep n={2} title="Formato do arquivo">
            <FormatStep formats={formats} format={format} onFormat={setFormat} content={content} onContent={setContent} />
            <BalanceOption availability={balanceAvailability} checked={balanceChosen} onChange={setBalanceChosen} />
          </ExportStep>
          <ExportStep n={3} title="Totais do relatório">
            <TotalsStep totals={totals} error={totalsError} />
          </ExportStep>
          {fullScreen && (
            <button
              ref={previewLinkRef}
              type="button"
              onClick={() => setPreviewOpen(true)}
              style={{
                ...G, alignSelf: "flex-start", background: "none", border: 0, color: T.blue, fontWeight: 700,
                fontSize: 13, padding: 0, minHeight: 44, cursor: "pointer",
              }}
            >
              Ver prévia do arquivo<span aria-hidden="true"> →</span>
            </button>
          )}
          {status.error && (
            <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>{status.error}</p>
          )}
        </div>
        {showPreview && (
          <div data-testid="export-actions" style={{ flex: "none", display: "flex", gap: 8 }}>{actions}</div>
        )}
        </div>
        {showPreview && PREVIEWS[format] && (
          <FilePreview format={format} data={{ title, filtersText, selection, totals, content, balance }} />
        )}
      </div>
      )}
      {previewScreen && status.error && (
        <p role="alert" style={{ ...G, margin: "12px 0 0", fontSize: 12, color: T.red }}>{status.error}</p>
      )}
    </SideDrawer>
  );
}
