import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";
import { LocaleDateRangePicker } from "../../../../../components/LocaleDateRangePicker.jsx";
import { resolvePeriodDisplayBounds } from "../../../periodDateBounds.js";

/* NÃO existe chip "Personalizado".
   Ele chegou a ser proposto e caiu no protótipo fechado, pelo motivo que o
   Owner mesmo apontou: com TODO preset preenchendo os campos e o calendário,
   "nenhum chip aceso" já diz que o intervalo é próprio, e os campos logo abaixo
   dizem qual é. Um chip que só acende, sem fazer nada ao ser clicado, é um
   controle a mais para explicar e nenhum a mais para usar.

   No lugar dele, o primeiro da fileira é a JANELA RELATIVA — o antigo
   "Últimos 3m" com o número destravado e a unidade escolhível. Era o mesmo
   recorte com um número fixo decidido por nós. */
const PRESETS = [
  { v: "mes", l: "Este mês" },
  { v: "hoje", l: "Hoje" },
  { v: "semana", l: "Esta semana" },
  { v: "mes-ant", l: "Mês anterior" },
  { v: "ano", l: "Este ano" },
  { v: "tudo", l: "Todo período" },
];

/* Unidades da janela relativa. O teto é POR unidade porque "últimos 999 anos"
   é ruído: o limite tem de fazer sentido no que se está contando. */
const UNIDADES = {
  d: { um: "dia", varios: "dias", max: 999 },
  s: { um: "semana", varios: "semanas", max: 520 },
  m: { um: "mês", varios: "meses", max: 120 },
  a: { um: "ano", varios: "anos", max: 20 },
};

/** O intervalo de uma janela relativa, inclusivo nas duas pontas. */
export function faixaRelativa(n, u, hoje = new Date()) {
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicio = new Date(fim);
  if (u === "d") inicio.setDate(inicio.getDate() - (n - 1));
  else if (u === "s") inicio.setDate(inicio.getDate() - (n * 7 - 1));
  else {
    /* `setMonth` transborda: 31/03 menos 1 mês viraria 03/03, porque fevereiro
       não tem 31. Calcula-se o mês alvo e prende-se o dia ao último dele. */
    const meses = u === "m" ? n : n * 12;
    const alvo = new Date(fim.getFullYear(), fim.getMonth() - meses, 1);
    const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
    inicio.setFullYear(alvo.getFullYear(), alvo.getMonth(), Math.min(fim.getDate(), ultimo));
    inicio.setDate(inicio.getDate() + 1);
  }
  return [inicio, fim];
}

/* Qual janela relativa descreve o intervalo em vigor — DERIVADO, não guardado.
   Se o intervalo não for uma janela redonda, cai no padrão de 3 meses. */
function janelaDoIntervalo(period, from, to) {
  const padrao = { n: 3, u: "m" };
  if (period !== "rel" || !from || !to) return padrao;
  const di = new Date(`${from}T00:00:00`);
  const df = new Date(`${to}T00:00:00`);
  if (Number.isNaN(di) || Number.isNaN(df)) return padrao;
  const dias = Math.round((df - di) / 86400000) + 1;
  /* Só os candidatos POSSÍVEIS, em vez de varrer as ~1660 combinações a cada
     render: o número de dias já elimina quase tudo. */
  const candidatos = [];
  if (dias >= 1 && dias <= UNIDADES.d.max) candidatos.push([dias, "d"]);
  if (dias % 7 === 0 && dias / 7 <= UNIDADES.s.max) candidatos.push([dias / 7, "s"]);
  const meses = Math.round(dias / 30.44);
  for (const m of [meses - 1, meses, meses + 1]) {
    if (m >= 1 && m <= UNIDADES.m.max) candidatos.push([m, "m"]);
    if (m % 12 === 0 && m / 12 >= 1 && m / 12 <= UNIDADES.a.max) candidatos.push([m / 12, "a"]);
  }
  /* Meses e anos primeiro: "últimos 3 meses" descreve melhor que "últimos 92
     dias", e as duas descrevem o mesmo intervalo. */
  candidatos.sort((a, b) => "asmd".indexOf(a[1]) - "asmd".indexOf(b[1]));
  for (const [n, u] of candidatos) {
    const [i, f] = faixaRelativa(n, u);
    if (ymdLocal(i) === from && ymdLocal(f) === to) return { n, u };
  }
  return padrao;
}

function rotuloUnidade(n, u) {
  const uni = UNIDADES[u] || UNIDADES.m;
  return Number(n) === 1 ? uni.um : uni.varios;
}

const ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function PeriodPanel({
  period,
  setPeriod,
  customFrom = "",
  customTo = "",
  setCustomFrom = () => {},
  setCustomTo = () => {},
  onClose,
  onApply,
  compact = false,
  locale = "pt-BR",
}) {
  /* O número e a unidade são DERIVADOS do intervalo em vigor quando ele já é
     uma janela relativa. Guardá-los só localmente fazia o chip reabrir dizendo
     "Últimos 3 meses" sobre um recorte de 45 dias — e o primeiro clique, ou só
     um blur no campo, reescrevia a janela da pessoa em silêncio. */
  const [relN, setRelN] = useState(() => janelaDoIntervalo(period, customFrom, customTo).n);
  const [relU, setRelU] = useState(() => janelaDoIntervalo(period, customFrom, customTo).u);

  useEffect(() => {
    if (period !== "rel") return;
    const { n, u } = janelaDoIntervalo(period, customFrom, customTo);
    setRelN(n);
    setRelU(u);
  }, [period, customFrom, customTo]);

  /* Uma tecla no número não pode virar uma ida ao backend: digitar "120" são
     três recortes sem sentido (1, 12, 120) e três refetches. O valor digitado
     fica local e só vira filtro depois que a digitação para. É a mesma regra do
     arrasto do calendário, que ficou local até soltar. */
  const debounceRef = useRef(null);
  useEffect(() => () => clearTimeout(debounceRef.current), []);
  const aplicarComEspera = (n, u) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => aplicarRelativo(n, u), 320);
  };

  const chipBase = (active) => ({
    ...G,
    padding: "8px 14px",
    borderRadius: 99,
    border: `1.5px solid ${active ? T.ink : T.border}`,
    background: active ? T.ink : T.surface,
    color: active ? "#fff" : T.inkMid,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  });

  const applyPreset = (value) => {
    if (value === "custom") {
      /* Trocar para "Personalizado" com um preset ativo SEMEIA os campos com os
         limites dele. Sem a semente, `resolvePeriodDisplayBounds` devolve
         intervalo vazio para custom e a lista saltava de "Este mês" para toda a
         história — alargando o filtro justamente no chip que existe para
         estreitá-lo. */
      if (!customFrom && !customTo) {
        const bounds = resolvePeriodDisplayBounds(period, customFrom, customTo);
        if (bounds.from) setCustomFrom(bounds.from);
        if (bounds.to) setCustomTo(bounds.to);
      }
      setPeriod("custom");
      /* E NÃO fecha o painel. `onApply` é o `dismissPanel` do popover: o único
         chip cujo propósito é "agora deixe eu escolher as datas aqui embaixo"
         sumia com o calendário antes de qualquer data ser escolhida. */
      return;
    }
    setPeriod(value);
    {
      setCustomFrom("");
      setCustomTo("");
    }
    /* No compacto o painel NÃO fecha ao escolher um preset. O calendário e a
       contagem de dias logo abaixo acabaram de mudar — fechar esconde
       exatamente o feedback da ação, e quem está experimentando as opções
       precisa reabrir tudo a cada toque. No desktop o painel é um popover
       sobre a lista, e fechar é o que devolve a lista à vista. */
    if (!compact && typeof onApply === "function") onApply();
  };

  const switchToCustomPeriod = () => {
    if (period !== "custom") setPeriod("custom");
  };

  /* Aplicar a janela relativa. Serve os TRÊS gatilhos — clicar no chip, mudar o
     número, mudar a unidade — porque os três significam a mesma coisa.
     Exigir o clique no chip não funcionava: o centro dele é o próprio campo de
     número, e o campo precisa parar a propagação para o clique não ativar o chip
     enquanto se posiciona o cursor. O resultado era um chip cujo meio não fazia
     nada. Mexer no número JÁ é escolher a janela.
     Não fecha o painel: quem acabou de acendê-lo quase sempre ajusta o número em
     seguida, e fechar obrigaria a reabrir a cada ajuste. */
  const aplicarRelativo = (n = relN, u = relU) => {
    const q = Math.max(1, Math.min(UNIDADES[u].max, Number(n) || 1));
    const [ini, fim] = faixaRelativa(q, u);
    setPeriod("rel");
    setCustomFrom(ymdLocal(ini));
    setCustomTo(ymdLocal(fim));
  };

  return (
    <div>
      {/* O subtítulo sai no compacto. O sheet já tem cabeçalho "Filtros" e o card
          tocado já diz PERÍODO; repetir custa ~20 px numa tela que não os tem —
          e o painel inteiro já fica 47 px abaixo da dobra. */}
      <PanelHeader
        title="Período"
        hint={compact ? undefined : "Escolha um intervalo rápido ou personalize as datas"}
        onClose={onClose}
        compact={compact}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {/* A JANELA RELATIVA é o primeiro chip. Ela substitui o antigo
            "Últimos 3m", que era este mesmo recorte com um número que nós
            escolhemos pela pessoa. Aqui o número é editável e a unidade também:
            "últimos 45 dias" e "últimos 2 anos" deixam de precisar do caminho
            de digitar duas datas. */}
        {/* Um `role="button"` embrulhando um input e um select é ARIA inválido:
            o `aria-label` do embrulho substitui a subárvore inteira no cálculo
            do nome, e os dois controles de dentro deixam de ser anunciados.
            Aqui o chip é um contêiner comum e quem tem papel de botão é só a
            palavra da frente — os três controles ficam independentes. */}
        <span style={{ ...chipBase(period === "rel"), gap: 6, cursor: "default" }}>
          <span style={{ width: 11, flex: "none", display: "inline-flex" }}>
            {period === "rel" && <Icon name="check" size={11} color="#fff" />}
          </span>
          {/* "Último 1 mês" e "Últimos 3 meses": a palavra da frente concorda
              com o número, senão a fileira lê como texto quebrado. */}
          <button
            type="button"
            aria-pressed={period === "rel"}
            aria-label={`Últimos ${relN} ${rotuloUnidade(relN, relU)}`}
            onClick={() => aplicarRelativo()}
            style={{
              ...G, border: "none", background: "none", padding: 0, cursor: "pointer",
              color: "inherit", fontSize: 12.5, fontWeight: 600,
            }}
          >
            {relN === 1 ? "Último" : "Últimos"}
          </button>
          <input
            aria-label="Quantidade da janela relativa"
            inputMode="numeric"
            value={relN}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const bruto = e.target.value.replace(/\D/g, "").slice(0, 3);
              const n = bruto === "" ? "" : Math.min(UNIDADES[relU].max, Number(bruto));
              setRelN(n);
              if (n !== "" && n >= 1) aplicarComEspera(n, relU);
            }}
            onBlur={() => {
              clearTimeout(debounceRef.current);
              if (relN === "" || Number(relN) < 1) { setRelN(1); aplicarRelativo(1, relU); }
              else aplicarRelativo(relN, relU);
            }}
            style={{
              ...G, width: 34, height: 20, textAlign: "center", borderRadius: 5,
              border: `1px solid ${period === "rel" ? "rgba(255,255,255,.35)" : T.border}`,
              background: period === "rel" ? "rgba(255,255,255,.12)" : T.surface,
              color: period === "rel" ? "#fff" : T.ink,
              fontSize: 12, fontWeight: 700, padding: 0, outlineOffset: 1,
            }}
          />
          <select
            aria-label="Unidade da janela relativa"
            value={relU}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const u = e.target.value;
              /* O teto muda com a unidade: 999 dias faz sentido, 999 anos não.
                 Prender aqui evita que trocar de unidade herde um número
                 impossível. */
              const n = Math.min(UNIDADES[u].max, Math.max(1, Number(relN) || 1));
              setRelU(u);
              setRelN(n);
              aplicarRelativo(n, u);
            }}
            style={{
              ...G, height: 20, borderRadius: 5,
              border: `1px solid ${period === "rel" ? "rgba(255,255,255,.35)" : T.border}`,
              background: period === "rel" ? "rgba(255,255,255,.12)" : T.surface,
              color: period === "rel" ? "#fff" : T.ink,
              fontSize: 12, fontWeight: 600, padding: "0 2px 0 4px", cursor: "pointer",
            }}
          >
            {Object.keys(UNIDADES).map((k) => (
              <option key={k} value={k} style={{ color: T.ink }}>
                {rotuloUnidade(relN, k)}
              </option>
            ))}
          </select>
        </span>

        {PRESETS.map((o) => {
          const active = period === o.v;
          return (
            <button
              type="button"
              key={o.v}
              onClick={() => applyPreset(o.v)}
              aria-pressed={active}
              aria-label={`Preset: ${o.l}`}
              style={chipBase(active)}
            >
              {/* Espaço do check RESERVADO em todo chip: ativar um insere o
                  ícone + o gap (~16 px) e desativa o anterior, e os pontos de
                  quebra da fileira mudariam entre o 1º e o 2º clique de um duplo
                  clique — empurrando o calendário sob o cursor. */}
              <span style={{ width: 11, flex: "none", display: "inline-flex" }}>
                {active && <Icon name="check" size={11} color="#fff" />}
              </span>
              {o.l}
            </button>
          );
        })}
      </div>

      <div
        style={{
          borderTop: `1px solid ${T.border}`,
          paddingTop: 14,
        }}
      >
        <LocaleDateRangePicker
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          setCustomFrom={setCustomFrom}
          setCustomTo={setCustomTo}
          onCustomPeriod={switchToCustomPeriod}
          onClearRange={() => {
            setCustomFrom("");
            setCustomTo("");
            setPeriod("tudo");
          }}
          compact={compact}
        />
      </div>
    </div>
  );
}
