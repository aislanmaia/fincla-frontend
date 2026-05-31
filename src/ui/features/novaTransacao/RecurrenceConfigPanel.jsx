import { T } from "../../tokens";
import { G } from "../../typography";
import { LocaleDatePicker } from "../../components/LocaleDatePicker.jsx";
import { APP_UI_LOCALE } from "../../appLocale.js";
import {
  DOW_LABELS_FULL,
  DOW_LABELS_SHORT,
  ENC_LABELS,
  FREQ_OPTIONS,
  MONTH_NAMES,
} from "./novaTransacaoConstants.js";

const CUSTOM_UNIT_OPTS = [
  { id: "day", label: "dias" },
  { id: "week", label: "semanas" },
  { id: "month", label: "meses" },
];

const ENC_OPTIONS = [
  { id: "sem-fim", label: "Sem data fim", sub: "Até cancelar manualmente" },
  { id: "repeticoes", label: "Após N repetições", sub: "Informe a quantidade" },
  { id: "data", label: "Data específica", sub: "Escolher término" },
];

/**
 * Bloco completo do painel "Recorrência" — frequência + condicionais (DoW/DoM/anual/custom)
 * + âncora (primeira ocorrência) + encerramento + resumo.
 *
 * `compact=true` adapta espaçamentos para o sheet mobile; `false` para o desktop.
 */
export function RecurrenceConfigPanel({
  compact = false,
  // Frequência
  recurrenceFrequency,
  setRecurrenceFrequency,
  // Personalizado
  customRecurrenceInterval,
  setCustomRecurrenceInterval,
  customRecurrenceUnit,
  setCustomRecurrenceUnit,
  // Semana/Mês
  effectiveDayOfWeek,
  effectiveDayOfMonth,
  onSelectDayOfWeek,
  onSelectDayOfMonth,
  // Âncora
  firstOccurrenceDate,
  setFirstOccurrenceYmd,
  firstOccurrenceAutoAdjustNote,
  setFirstOccurrenceAutoAdjustNote,
  // Encerramento
  recurrenceEndKind,
  setRecurrenceEndKind,
  recurrenceRepetitions,
  setRecurrenceRepetitions,
  recurrenceEndDateYmd,
  setRecurrenceEndDateYmd,
  // Derivados
  recurrenceRuleSummary,
  recurrenceNextOccurrence,
  recurrenceComputedEndDate,
  // Helpers
  fmtDateBr,
}) {
  const f = {
    sectionGap: compact ? 18 : 14,
    labelSize: compact ? 12 : 10,
    labelMargin: compact ? 10 : 8,
    fieldGap: compact ? 8 : 6,
    pillPadding: compact ? "12px 10px" : "8px 10px",
    pillFontSize: compact ? 13 : 12,
    dowSize: compact ? 36 : 28,
    inputPadding: compact ? "10px 12px" : "8px 10px",
    smallText: compact ? 12 : 11,
    hintText: compact ? 11 : 10,
  };
  const Label = ({ children }) => (
    <div style={{ ...G, fontSize: f.labelSize, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: f.labelMargin }}>{children}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: f.sectionGap }}>
      {/* ─── FREQUÊNCIA ─── */}
      <div>
        <Label>Frequência</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: f.fieldGap }}>
          {FREQ_OPTIONS.map((label) => {
            const fid = label.toLowerCase();
            const active = recurrenceFrequency === fid;
            return (
              <button key={label} type="button" onClick={() => setRecurrenceFrequency(fid)}
                style={{ ...G, padding: f.pillPadding, borderRadius: 10, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? T.ink : T.surface, color: active ? "#fff" : T.inkMid, fontSize: f.pillFontSize, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── CAMPOS CONDICIONAIS ─── */}
      {(recurrenceFrequency === "semanal" || recurrenceFrequency === "quinzenal") && (
        <div>
          <Label>{recurrenceFrequency === "quinzenal" ? "Dia da semana (a cada 2)" : "Dia da semana"}</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {DOW_LABELS_SHORT.map((lbl, idx) => {
              const active = effectiveDayOfWeek === idx;
              return (
                <button key={idx} type="button" onClick={() => onSelectDayOfWeek(idx)}
                  aria-label={DOW_LABELS_FULL[idx]}
                  title={DOW_LABELS_FULL[idx]}
                  style={{ ...G, height: f.dowSize, padding: 0, borderRadius: 8, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? T.ink : T.surface, color: active ? "#fff" : T.inkMid, fontSize: compact ? 12 : 10, fontWeight: 700, cursor: "pointer", textTransform: "lowercase" }}>
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {recurrenceFrequency === "mensal" && (
        <div>
          <Label>Dia do mês</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...G, fontSize: f.smallText, color: T.inkMid }}>Todo dia</span>
            <input type="number" min={1} max={31} value={effectiveDayOfMonth ?? ""}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                const clamped = Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : null;
                onSelectDayOfMonth(clamped);
              }}
              style={{ ...G, width: 64, padding: f.inputPadding, borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: f.pillFontSize, fontWeight: 700, color: T.ink, textAlign: "center" }} />
            <span style={{ ...G, fontSize: f.smallText, color: T.inkMid }}>de cada mês</span>
          </div>
          {effectiveDayOfMonth != null && effectiveDayOfMonth > 28 && (
            <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 6, lineHeight: 1.4 }}>
              Em meses sem o dia {effectiveDayOfMonth}, a transação cai no último dia do mês.
            </div>
          )}
        </div>
      )}

      {recurrenceFrequency === "anual" && (
        <div>
          <Label>Dia e mês</Label>
          <LocaleDatePicker
            locale={APP_UI_LOCALE}
            value={firstOccurrenceDate}
            onChange={(ymd) => setFirstOccurrenceYmd(ymd || null)}
            style={{ width: "100%" }}
          />
          <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 6 }}>
            Repete todo {firstOccurrenceDate ? (() => { const d = new Date(`${firstOccurrenceDate}T12:00:00`); return Number.isNaN(d.getTime()) ? "—" : `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`; })() : "—"}.
          </div>
        </div>
      )}

      {recurrenceFrequency === "personalizado" && (
        <div>
          <Label>A cada</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={1} value={customRecurrenceInterval}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                setCustomRecurrenceInterval(Number.isFinite(n) && n >= 1 ? n : 1);
              }}
              style={{ ...G, width: 64, padding: f.inputPadding, borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: f.pillFontSize, fontWeight: 700, color: T.ink, textAlign: "center" }} />
            <select value={customRecurrenceUnit} onChange={(e) => setCustomRecurrenceUnit(e.target.value)}
              style={{ ...G, flex: 1, padding: f.inputPadding, borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: f.pillFontSize, fontWeight: 600, color: T.ink, background: T.surface }}>
              {CUSTOM_UNIT_OPTS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ─── PRIMEIRA OCORRÊNCIA (âncora) ─── */}
      <div>
        <Label>Primeira ocorrência</Label>
        <LocaleDatePicker
          locale={APP_UI_LOCALE}
          value={firstOccurrenceDate}
          onChange={(ymd) => { setFirstOccurrenceYmd(ymd || null); setFirstOccurrenceAutoAdjustNote(null); }}
          style={{ width: "100%" }}
        />
        {firstOccurrenceAutoAdjustNote ? (
          <div role="status" aria-live="polite"
            style={{ ...G, fontSize: f.hintText, color: T.ink, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", marginTop: 6, lineHeight: 1.4 }}>
            ↻ {firstOccurrenceAutoAdjustNote}
          </div>
        ) : (
          <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 6 }}>
            Pode ser diferente da data da transação.
          </div>
        )}
      </div>

      {/* ─── ENCERRAMENTO ─── */}
      <div>
        <Label>Encerramento</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: f.fieldGap }}>
          {ENC_OPTIONS.map((opt) => {
            const active = recurrenceEndKind === opt.id;
            return (
              <div key={opt.id} onClick={() => setRecurrenceEndKind(opt.id)}
                style={{ display: "flex", flexDirection: "column", gap: 8, padding: compact ? "12px 14px" : "10px 12px", borderRadius: 10, border: `1.5px solid ${active ? T.ink : T.border}`, cursor: "pointer", background: active ? T.bg : T.surface }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: compact ? 16 : 14, height: compact ? 16 : 14, borderRadius: 9999, border: `2px solid ${active ? T.ink : T.border}`, background: active ? T.ink : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    {active && <div style={{ width: compact ? 6 : 5, height: compact ? 6 : 5, borderRadius: 9999, background: "#fff" }} />}
                  </div>
                  <div>
                    <div style={{ ...G, fontSize: f.pillFontSize, fontWeight: 600, color: T.ink }}>{opt.label}</div>
                    <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 1 }}>{opt.sub}</div>
                  </div>
                </div>
                {active && opt.id === "repeticoes" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: compact ? 26 : 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...G, fontSize: f.smallText, color: T.inkMid }}>Após</span>
                      <input type="number" min={1} value={recurrenceRepetitions}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setRecurrenceRepetitions(Number.isFinite(n) && n >= 1 ? n : 1);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ ...G, width: 64, padding: f.inputPadding, borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: f.pillFontSize, fontWeight: 700, color: T.ink, textAlign: "center" }} />
                      <span style={{ ...G, fontSize: f.smallText, color: T.inkMid }}>
                        {recurrenceFrequency === "semanal" ? (Number(recurrenceRepetitions) === 1 ? "semana" : "semanas") :
                          recurrenceFrequency === "quinzenal" ? (Number(recurrenceRepetitions) === 1 ? "quinzena" : "quinzenas") :
                          recurrenceFrequency === "mensal" ? (Number(recurrenceRepetitions) === 1 ? "mês" : "meses") :
                          recurrenceFrequency === "anual" ? (Number(recurrenceRepetitions) === 1 ? "ano" : "anos") :
                          (Number(recurrenceRepetitions) === 1 ? "ocorrência" : "ocorrências")}
                      </span>
                    </div>
                    {recurrenceComputedEndDate && (
                      <div style={{ ...G, fontSize: f.hintText, color: T.inkLight }}>
                        Termina em <strong style={{ color: T.ink }}>{fmtDateBr(recurrenceComputedEndDate)}</strong>.
                      </div>
                    )}
                  </div>
                )}
                {active && opt.id === "data" && (
                  <div onClick={(e) => e.stopPropagation()} style={{ paddingLeft: compact ? 26 : 24 }}>
                    <LocaleDatePicker
                      locale={APP_UI_LOCALE}
                      value={recurrenceEndDateYmd}
                      onChange={(ymd) => setRecurrenceEndDateYmd(ymd || null)}
                      style={{ width: "100%" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── RESUMO ─── */}
      <div style={{ padding: compact ? "12px 14px" : "10px 12px", background: T.bg, borderRadius: 10, border: `1px solid ${T.border}` }}>
        <div style={{ ...G, fontSize: f.hintText, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Resumo</div>
        <div style={{ ...G, fontSize: compact ? 14 : 13, fontWeight: 700, color: T.ink }}>{recurrenceRuleSummary || "—"}</div>
        <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 2 }}>
          Próxima: {fmtDateBr(recurrenceNextOccurrence)} · {ENC_LABELS[recurrenceEndKind]?.toLowerCase()}
          {recurrenceEndKind === "repeticoes" && recurrenceComputedEndDate && (
            <> · termina em {fmtDateBr(recurrenceComputedEndDate)}</>
          )}
          {recurrenceEndKind === "data" && recurrenceEndDateYmd && (
            <> · termina em {fmtDateBr(recurrenceEndDateYmd)}</>
          )}
        </div>
      </div>
    </div>
  );
}
