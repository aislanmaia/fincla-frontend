import { T } from "../../tokens";
import { G } from "../../typography";
import { PageTitle } from "../../components/primitives";

/**
 * Empty state da página Ritmo quando o utilizador ainda não tem transações.
 * Mostra um chart fake desfocado, 3 passos de onboarding e CTA para registrar a 1ª.
 */
export function RitmoEmptyState({ onNewTx }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <PageTitle sans="Ritmo de" serif="Gastos"/>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
        <div style={{ ...G, fontSize:11, fontWeight:700, color:T.ink, marginBottom:10 }}>Projeção · Março 2026</div>
        <div style={{ background:T.bg, borderRadius:10, padding:"10px 10px 0", position:"relative", overflow:"hidden", height:90, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:70, filter:"blur(2px)", opacity:0.15, pointerEvents:"none" }}>
            {[32,54,41,72,46,63,37,85,53,67,44,78].map((h,i)=>(
              <div key={i} style={{ flex:1, borderRadius:"2px 2px 0 0", background:T.ink, height:`${h}%` }}/>
            ))}
          </div>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>🔐</span>
            <span style={{ ...G, fontSize:12, fontWeight:700, color:T.inkMid }}>Desbloqueado com a primeira transação</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:14 }}>
          {[
            { n:"1", text:<><strong>Registre um gasto</strong> — qualquer compra do dia a dia.</> },
            { n:"2", text:<><strong>O gráfico mostra</strong> sua curva real vs. projeção ideal do mês.</> },
            { n:"3", text:<><strong>Receba alertas</strong> quando o ritmo sair do ideal.</> },
          ].map((s,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:9 }}>
              <div style={{ width:20, height:20, borderRadius:"50%", background:T.ink, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{s.n}</div>
              <div style={{ ...G, fontSize:12, color:T.inkMid, lineHeight:1.6 }}>{s.text}</div>
            </div>
          ))}
        </div>
        <button onClick={onNewTx} style={{ ...G, width:"100%", background:T.redLight, color:T.red, border:"none", borderRadius:9, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          + Registrar primeira transação
        </button>
      </div>
    </div>
  );
}
