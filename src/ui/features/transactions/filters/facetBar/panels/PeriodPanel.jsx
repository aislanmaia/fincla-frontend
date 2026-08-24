import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";
import { LocaleDateRangePicker } from "../../../../../components/LocaleDateRangePicker.jsx";
import { formatCustomPeriodLabel } from "../../customPeriodLabel.js";
import { resolvePeriodDisplayBounds } from "../../../periodDateBounds.js";

/* "Personalizado" é o PRIMEIRO da fileira, e não o último.
   Ele é o único chip que precisa ser encontrado quando nenhum dos outros serve
   — os demais se explicam pelo nome e a pessoa varre a fileira até achar o que
   quer. Pôr no fim significa que quem já sabe que quer uma data específica
   precisa ler tudo antes de chegar nele. Ele também é o único que não some ao
   ser escolhido: os outros viram estado do chip, este vira o próprio intervalo
   no rótulo. */
const PRESETS = [
  { v: "custom", l: "Personalizado" },
  { v: "tudo", l: "Todo período" },
  { v: "hoje", l: "Hoje" },
  { v: "semana", l: "Esta semana" },
  { v: "mes", l: "Este mês" },
  { v: "mes-ant", l: "Mês anterior" },
  { v: "3m", l: "Últimos 3m" },
  { v: "ano", l: "Este ano" },
];

/* "1–31 ago" em vez da palavra "Personalizado" quando há intervalo: o chip
   selecionado deve dizer O QUE está selecionado, e a palavra só repete o nome
   do botão que a pessoa acabou de tocar. */
function rotuloCustom(from, to, locale) {
  if (!from && !to) return "Personalizado";
  const rotulo = formatCustomPeriodLabel(from, to, locale);
  return rotulo || "Personalizado";
}

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
        {PRESETS.map((o) => {
          const active = period === o.v;
          return (
            <button
              type="button"
              key={o.v}
              onClick={() => applyPreset(o.v)}
              aria-pressed={active}
              /* O nome acessível precisa CONTER o rótulo visível: no chip de
                 personalizado o visível é o intervalo ("1–15 out"), e um
                 `aria-label` fixo em "Personalizado" deixava os dois sem
                 relação — quem usa comando de voz não consegue nomear o botão
                 que está vendo. */
              aria-label={
                o.v === "custom" && (customFrom || customTo)
                  ? `Preset: Personalizado — ${rotuloCustom(customFrom, customTo, locale)}`
                  : `Preset: ${o.l}`
              }
              /* Tracejado enquanto vazio, sólido quando tem intervalo: é a
                 mesma gramática do "＋ Filtros" na barra de comando. */
              data-custom={o.v === "custom" ? "1" : undefined}
              style={{
                ...G,
                padding: "8px 14px",
                borderRadius: 99,
                border: `1.5px ${o.v === "custom" && !active ? "dashed" : "solid"} ${active ? T.ink : T.border}`,
                background: active ? T.ink : T.surface,
                color: active ? "#fff" : T.inkMid,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {/* Espaço do check RESERVADO em todo chip. Só a largura fixa do
                  rótulo não bastava: ativar um chip insere o ícone + o gap
                  (~16 px) e desativa o anterior, então os pontos de quebra da
                  fileira ainda podiam mudar entre o 1º e o 2º clique de um
                  duplo clique — que é o defeito que a largura fixa foi corrigir. */}
              <span style={{ width: 11, flex: "none", display: "inline-flex" }}>
                {active && <Icon name="check" size={11} color="#fff" />}
              </span>
              {o.v === "custom" ? (
                /* Largura FIXA. O rótulo troca de "Personalizado" para o
                   intervalo ("A partir de 12 ago"), e um chip que muda de
                   tamanho faz a fileira quebrar numa linha a mais — empurrando o
                   calendário 41 px para baixo no meio de um duplo clique, que
                   então cai uma fileira acima do dia apontado. Medido. */
                <span
                  style={{
                    display: "inline-block",
                    width: 96,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                  }}
                  title={rotuloCustom(customFrom, customTo, locale)}
                >
                  {rotuloCustom(customFrom, customTo, locale)}
                </span>
              ) : (
                o.l
              )}
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
