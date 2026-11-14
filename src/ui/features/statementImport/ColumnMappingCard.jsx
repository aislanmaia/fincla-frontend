// "Indique as colunas" (fincla-api#515): a planilha que o Fincla não reconheceu.
//
// O backend devolve as primeiras linhas do arquivo (`SheetPreview`); a pessoa diz qual coluna é a
// data, a descrição e o valor, e a tela reenvia o mesmo arquivo com essas colunas. O Fincla lembra
// a escolha na conta: o próximo arquivo desse formato entra direto.
import { useState } from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn, Card, Select } from "../../components/primitives";

export const MAPPING_FIELDS = [
  { key: "date", label: "Data", aria: "Coluna da data" },
  { key: "description", label: "Descrição", aria: "Coluna da descrição" },
  { key: "amount", label: "Valor", aria: "Coluna do valor" },
];

/** "A", "B", …, "Z", "AA": como a planilha chama as colunas. */
export function columnLetter(index) {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Por que ainda não dá para ler com as colunas escolhidas; `""` quando dá. */
export function mappingProblem(mapping) {
  const chosen = MAPPING_FIELDS.map((f) => mapping[f.key]);
  if (chosen.some((c) => c === "" || c == null)) return "Escolha uma coluna para a data, a descrição e o valor.";
  if (new Set(chosen).size !== chosen.length) return "Cada informação precisa de uma coluna diferente.";
  return "";
}

function initialMapping(preview) {
  const s = preview.suggested_mapping;
  const fits = (i) => (Number.isInteger(i) && i < preview.column_count ? i : "");
  return s ? { date: fits(s.date), description: fits(s.description), amount: fits(s.amount) } : { date: "", description: "", amount: "" };
}

function roleOf(mapping, column) {
  return MAPPING_FIELDS.find((f) => mapping[f.key] === column)?.label ?? "";
}

export function ColumnMappingCard({ preview, fileName, sending, error, onSubmit, onCancel }) {
  const [mapping, setMapping] = useState(() => initialMapping(preview));
  const columns = Array.from({ length: preview.column_count }, (_, i) => i);
  const problem = mappingProblem(mapping);

  const choose = (key, value) => setMapping((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }));

  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }} data-testid="column-mapping">
      <div>
        <h2 style={{ ...G, fontSize: 16, fontWeight: 800, color: T.ink, margin: 0 }}>Indique as colunas</h2>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "6px 0 0" }}>
          O Fincla não reconheceu as colunas de <b>{fileName}</b>. Diga onde estão a data, a descrição e o valor
          de cada lançamento. Linhas sem data ou sem valor (títulos, totais) ficam de fora, e as linhas de saldo
          do banco (como “Saldo anterior” e “Saldo do dia”) nunca viram lançamento.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {MAPPING_FIELDS.map((field) => (
          <label key={field.key} style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid, display: "flex", flexDirection: "column", gap: 4, minWidth: 140, flex: "1 1 140px" }}>
            {field.label}
            <Select
              aria-label={field.aria}
              value={mapping[field.key] === "" ? "" : String(mapping[field.key])}
              onChange={(e) => choose(field.key, e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Escolha a coluna</option>
              {columns.map((c) => (
                <option key={c} value={String(c)}>Coluna {columnLetter(c)}</option>
              ))}
            </Select>
          </label>
        ))}
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <table style={{ ...G, fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
          <caption style={{ ...G, fontSize: 11, color: T.inkLight, textAlign: "left", padding: "8px 10px" }}>
            Primeiras linhas do arquivo
          </caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const role = roleOf(mapping, c);
                return (
                  <th key={c} scope="col" style={{ textAlign: "left", padding: "6px 10px", background: role ? T.blueLight : T.grayLight, color: role ? T.blue : T.inkMid, fontWeight: 700, whiteSpace: "nowrap", borderBottom: `1px solid ${T.border}` }}>
                    {columnLetter(c)}{role ? ` · ${role}` : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, r) => (
              <tr key={r}>
                {columns.map((c) => (
                  <td key={c} style={{ ...(roleOf(mapping, c) === "Valor" ? NUM : {}), padding: "6px 10px", color: T.ink, whiteSpace: "nowrap", borderBottom: `1px solid ${T.border}`, background: roleOf(mapping, c) ? T.blueLight : "transparent" }}>
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: 0 }}>
        O valor precisa ter sinal: negativo é saída. O Fincla lembra estas colunas nesta conta para o próximo arquivo deste formato.
      </p>
      {problem ? <p style={{ ...G, fontSize: 12, color: T.amber, margin: 0 }}>{problem}</p> : null}
      {error ? (
        <div role="alert" style={{ ...G, fontSize: 13, color: T.red, background: T.redLight, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 12px" }}>
          {error}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="dark" onClick={() => onSubmit(mapping)} disabled={Boolean(problem) || sending}>
          {sending ? "Lendo…" : "Ler o extrato com estas colunas"}
        </Btn>
        <Btn variant="outGray" onClick={onCancel} disabled={sending}>Escolher outro arquivo</Btn>
      </div>
    </Card>
  );
}
