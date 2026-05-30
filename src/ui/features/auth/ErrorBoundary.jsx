import React from "react";

/* ─── ERROR BOUNDARY ───────────────────────────────────────── */
/* ─── ERROR BOUNDARY ───────────────────────────────────────── */
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("fincla render error:", e, info); }
  render() {
    if (this.state.error) return (
      <div style={{ padding:24, background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, margin:16 }}>
        <div style={{ fontWeight:700, color:"#DC2626", marginBottom:8 }}>Erro ao renderizar esta tela</div>
        <div style={{ fontFamily:"monospace", fontSize:12, color:"#374151" }}>{this.state.error.message}</div>
      </div>
    );
    return this.props.children;
  }
}
