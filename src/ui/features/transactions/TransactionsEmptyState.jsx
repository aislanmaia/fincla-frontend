import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { PageTitle } from "../../components/primitives";

/**
 * Empty state da página Transações.
 * - Se `extraTx` (transações semeadas pelo onboarding) tem itens, mostra a lista preview.
 * - Caso contrário, mostra placeholder com CTA.
 */
export function TransactionsEmptyState({ extraTx = [], onNewTx }) {
  if (extraTx.length > 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <PageTitle sans="Transações" serif=""/>
          <button onClick={onNewTx} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"9px 18px", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Nova transação</button>
        </div>
        <div style={{ ...G, fontSize:12, color:T.inkLight }}>Transações registradas no onboarding</div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
          {extraTx.map((tx, i) => (
            <div key={tx.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px",
              borderBottom: i < extraTx.length-1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ width:36, height:36, borderRadius:10, background:T.grayLight,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{tx.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink }}>{tx.desc}</div>
                <div style={{ ...G, fontSize:11, color:T.inkLight }}>{tx.cat} · {tx.method} · {tx.date}
                  {tx.rec && <span style={{ ...G, fontSize:10, color:T.blue, background:T.blueLight, borderRadius:99, padding:"1px 7px", marginLeft:6, fontWeight:600 }}>recorrente</span>}
                  {tx.valorTipo==="estimado" && <span style={{ ...G, fontSize:10, color:T.amber, background:T.amberLight, borderRadius:99, padding:"1px 7px", marginLeft:4, fontWeight:600 }}>≈ estimado</span>}
                </div>
              </div>
              <div style={{ ...G, ...NUM, fontSize:14, fontWeight:700, flexShrink:0,
                color: tx.val > 0 ? T.green : T.ink }}>
                {tx.val > 0 ? "+" : "−"}R$ {Math.abs(tx.val).toLocaleString("pt-BR",{minimumFractionDigits:2})}
              </div>
            </div>
          ))}
        </div>
        <div style={{ ...G, fontSize:12, color:T.inkLight, textAlign:"center" }}>
          Registre despesas e mais receitas para acompanhar seu fluxo completo.
        </div>
      </div>
    );
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <PageTitle sans="Transações" serif=""/>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"48px 24px", gap:12, textAlign:"center" }}>
        <div style={{ fontSize:28 }}>📭</div>
        <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Nenhuma transação ainda</div>
        <div style={{ ...G, fontSize:13, color:T.inkMid, lineHeight:1.7, maxWidth:360 }}>Suas transações aparecerão aqui conforme forem registradas. Registre receitas, despesas e transferências para acompanhar seu fluxo.</div>
        <button onClick={onNewTx} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"11px 24px", fontSize:13, fontWeight:700, cursor:"pointer", marginTop:4 }}>+ Nova transação</button>
      </div>
    </div>
  );
}
