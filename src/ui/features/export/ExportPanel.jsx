import React, { useState } from "react";
import { FileSpreadsheet, FileText, FileType2 } from "lucide-react";

import { exportTransactions } from "../../../api/transactions";
import { Btn } from "../../components/primitives.jsx";
import { SideDrawer } from "../../components/SideDrawer.jsx";
import { currencyInfo } from "../../money/currencyRegistry.js";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { todayLocalYmd } from "../../data/transactionsAdapter.js";
import { EXPORT_MAX_ROWS, exportFailureMessage } from "../cardTransactions/ledgerExport.js";
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
 * `selection` ({ ids, count, summary }) é a "Exportar seleção" (#524): troca o recorte pelos marcados.
 * `formats` diz quais formatos o servidor já gera; PDF, quando presente, vem selecionado.
 * `fullScreen` é o modo celular (#527): quem usa decide pelo limite de 700 px.
 */

export const FORMAT_OPTIONS = {
  pdf: { label: "PDF", hint: "Para ler e enviar", Icon: FileText },
  xlsx: { label: "XLSX", hint: "Excel, com totais formatados", Icon: FileSpreadsheet },
  csv: { label: "CSV", hint: "Texto simples, para outros sistemas", Icon: FileType2 },
};

/** Os formatos que o exportador do servidor já gera. XLSX (#522) e PDF (#523) entram aqui. */
export const AVAILABLE_EXPORT_FORMATS = ["csv"];

const PDF_CONTENT = [
  { key: "full", label: "Completo", hint: "Resumo, categorias e a lista de lançamentos" },
  { key: "summary", label: "Só o resumo", hint: "Uma página, sem a lista — bom para mostrar a alguém" },
];

const userTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

const countText = (n) => Number(n ?? 0).toLocaleString("pt-BR");

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
        <b>{countText(selection.count)} lançamentos selecionados</b>. Saem só os que você marcou.
      </p>
    );
  }
  return (
    <>
      <p style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>
        Sai o recorte inteiro: <b>{countText(count)} lançamentos</b>, não só o que está carregado na tela.
      </p>
      <ul aria-label="Filtros ativos" style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
        {(filtersText.length ? filtersText : ["Sem filtros: todos os lançamentos"]).map((text) => (
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

function TotalsStep({ totals }) {
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
        {countText(totals.count)} lançamentos · {countText(totals.pending)} pendentes (incluídos nos totais)
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
    ...(selection ? [line(`${countText(selection.count)} lançamentos selecionados`)] : (filtersText.length ? filtersText : ["Sem filtros: todos os lançamentos"]).map((t) => line(t))),
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
        line(`LANÇAMENTOS: ${totals.count} (${totals.pending} pendentes, incluídos nos totais)`),
        ...(totals.mixed
          ? totals.byCurrency.map((item) => line(`RESULTADO EM ${item.currency}`, csvNumber(item.result, item.currency), item.currency))
          : []),
      ]
    : [];
  const header = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Moeda", "Situação"];
  const rows = [line(`… ${countText(totals?.count)} lançamentos, um por linha …`)];
  return [...meta, null, ...block, null, header, ...rows, null, resultLine]
    .map((cells) => (cells ? cells.map(csvCell).join(",") : ""))
    .join("\n");
}

/** Uma prévia por formato; XLSX (#522) e PDF (#523) acrescentam a sua aqui. */
const PREVIEW_BUILDERS = { csv: buildCsvPreview };

function FilePreview({ format, preview }) {
  return (
    <div
      data-testid="export-preview"
      style={{ background: T.grayLight, borderRadius: 10, padding: 12, minWidth: 0, minHeight: 0, overflow: "auto" }}
    >
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Prévia do arquivo ({FORMAT_OPTIONS[format].label})
      </div>
      <pre
        style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 14, fontSize: 11,
          lineHeight: 1.5, overflowX: "auto", margin: 0, color: T.ink, whiteSpace: "pre",
        }}
      >
        {preview}
      </pre>
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
  selection = null,
  formats = AVAILABLE_EXPORT_FORMATS,
  fullScreen = false,
  onClose,
}) {
  const [format, setFormat] = useState(formats.includes("pdf") ? "pdf" : formats[0]);
  const [content, setContent] = useState("full");
  const [status, setStatus] = useState({ busy: false, error: "" });

  const totals = exportTotalsFromSummary(selection ? selection.summary : summary);
  const sliceCount = selection ? selection.count : (count ?? totals?.count ?? 0);
  const tooLarge = sliceCount > EXPORT_MAX_ROWS;

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
      <Btn variant="dark" full disabled={status.busy || tooLarge} onClick={runExport}>
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
          gridTemplateColumns: fullScreen ? "minmax(0, 1fr)" : "minmax(240px, 300px) minmax(0, 1fr)",
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
          </ExportStep>
          <ExportStep n={2} title="Formato do arquivo">
            <FormatStep formats={formats} format={format} onFormat={setFormat} content={content} onContent={setContent} />
          </ExportStep>
          <ExportStep n={3} title="Totais do relatório">
            <TotalsStep totals={totals} />
          </ExportStep>
          {status.error && (
            <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>{status.error}</p>
          )}
        </div>
        {!fullScreen && PREVIEW_BUILDERS[format] && (
          <FilePreview format={format} preview={PREVIEW_BUILDERS[format]({ title, filtersText, selection, totals })} />
        )}
      </div>
    </SideDrawer>
  );
}
