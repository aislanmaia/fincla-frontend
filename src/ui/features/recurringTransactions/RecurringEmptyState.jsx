import { T } from "../../tokens";
import { G } from "../../typography";
import { PageTitle } from "../../components/primitives";

/**
 * Empty state de Recorrências & Compromissos. Mostra 2 cards de tipo (receita/despesa)
 * e uma régua de exemplos comuns para inspirar.
 *
 * `onNew(tipo)` é chamado com `"receita"` ou `"despesa"` para abrir o drawer de nova recorrência
 * já pré-configurado.
 */
export function RecurringEmptyState({ isMobile = false, onNew }) {
  const cards = [
    { ic:"💰", title:"Receitas fixas",  sub:"Salário, pró-labore, aluguel recebido.", color:T.green, colorL:T.greenLight, action:"+ Receita", tipo:"receita" },
    { ic:"📋", title:"Despesas fixas", sub:"Boletos, assinaturas, débito automático.", color:T.red,   colorL:T.redLight,   action:"+ Despesa", tipo:"despesa" },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <PageTitle sans="Recorrências &" serif="Compromissos"/>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.7 }}>
          Tudo começa com uma recorrência. Salário, aluguel, Spotify — cada item fixo aqui vira uma previsão automática no dashboard.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
          {cards.map((c,i)=>(
            <div key={i} style={{ background:T.surface, border:`1.5px dashed ${T.border}`, borderRadius:13, padding:"18px 16px", textAlign:"center", display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ fontSize:28 }}>{c.ic}</div>
              <div style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>{c.title}</div>
              <div style={{ ...G, fontSize:12, color:T.inkLight, lineHeight:1.55 }}>{c.sub}</div>
              <button onClick={() => onNew(c.tipo)} style={{ ...G, background:c.colorL, color:c.color, border:"none", borderRadius:9, padding:"9px", fontSize:12, fontWeight:700, cursor:"pointer" }}>{c.action}</button>
            </div>
          ))}
        </div>
        <div>
          <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Comuns para começar</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["🏠 Aluguel","⚡ Conta de luz","📱 Plano celular","🎵 Spotify","🏋️ Academia","📺 Netflix"].map(p=>(
              <span key={p} style={{ ...G, fontSize:11, fontWeight:600, background:T.grayLight, color:T.inkMid, borderRadius:99, padding:"4px 12px" }}>{p}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
