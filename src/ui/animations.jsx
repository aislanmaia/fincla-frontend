/** CSS global de keyframes e utilitários — injetado uma vez (espelho do protótipo de referência em docs/) */
export const ANIM_CSS = `
  @keyframes fadeSlideUp {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0);   }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes fadeInDown {
    from { opacity:0; transform:translateY(-6px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes slideInRight {
    from { opacity:0; transform:translateX(18px); }
    to   { opacity:1; transform:translateX(0);    }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  @keyframes countUp {
    from { opacity:0; transform:translateY(4px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)   scale(1);    }
  }
  @keyframes progressFill {
    from { width: 0% !important; }
  }
  @keyframes pulseOnce {
    0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.25); }
    70%  { box-shadow: 0 0 0 8px rgba(37,99,235,0);  }
    100% { box-shadow: 0 0 0 0 rgba(37,99,235,0);    }
  }
  .fincla-row { transition: background 0.11s; }
  .fincla-row:hover { background: #F0EFEB !important; }
  /* Ações rápidas: aparecem no hover e ocupam o lugar da pill de categoria, de
     modo que data, descrição, valor e situação nunca ficam encobertos. No toque
     não há hover, então elas ficam sempre visíveis — a alternativa seria um alvo
     de 24 px dentro de uma linha de 56, onde o erro abre a transação vizinha. */
  .fincla-quick { display: none; align-items: center; gap: 4px; }
  .fincla-row:hover .fincla-quick,
  .fincla-row:focus-within .fincla-quick { display: flex; }
  .fincla-row:hover .fincla-quick-hides,
  .fincla-row:focus-within .fincla-quick-hides { display: none; }
  @media (hover: none) {
    .fincla-quick { display: flex; }
    .fincla-quick-hides { display: none; }
  }
  .fincla-card-lift { transition: box-shadow 0.18s ease, transform 0.18s ease; }
  .fincla-card-lift:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; transform: translateY(-1px); }
  .fincla-btn { transition: opacity 0.13s, transform 0.13s; }
  .fincla-btn:active { transform: scale(0.97) !important; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes popIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes sheetUp {
    from { transform: translateY(100%); opacity: 0;   }
    to   { transform: translateY(0);    opacity: 1;   }
  }
  @keyframes sheetDown {
    from { transform: translateY(0);    opacity: 1;   }
    to   { transform: translateY(100%); opacity: 0;   }
  }
  @keyframes backdropIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes backdropOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  /* Drawer lateral (AiDrawer da referência cons-copiloto.jsx).
     slideInRight desloca só 18px — suficiente para um card, não para um
     painel de 440px, que precisa entrar da borda da viewport. */
  @keyframes slideInPanel {
    from { transform: translateX(100%); }
    to   { transform: translateX(0);    }
  }
  /* ── Movimento da lista de Transações ────────────────────────────────
     Sair da lista é um COLAPSO DE ALTURA, não só um fade: sem ele as linhas
     de baixo pulam de uma vez para o lugar da que saiu, e o olho perde onde
     estava. O max-height grande o bastante para qualquer densidade (a linha
     mais alta é 64 px, mais a sanfona aberta) faz a interpolação acontecer;
     height:0 não anima a partir de auto. */
  @keyframes txRowLeave {
    0%   { opacity: 1; transform: translateX(0);     max-height: 240px; }
    35%  { opacity: 0; transform: translateX(-14px); max-height: 240px; }
    100% { opacity: 0; transform: translateX(-14px); max-height: 0;
           padding-top: 0; padding-bottom: 0; border-width: 0; }
  }
  /* Confirmação de pagamento: um pulso verde que atravessa a linha. Curto de
     propósito — é um recibo, não um evento. */
  @keyframes txRowSettled {
    0%   { background: rgba(5,150,105,0); }
    30%  { background: rgba(5,150,105,0.16); }
    100% { background: rgba(5,150,105,0); }
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  .fincla-tx-leave {
    animation: txRowLeave 260ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
    overflow: hidden;
    pointer-events: none;
  }
  .fincla-tx-settled { animation: txRowSettled 900ms ease-out; }
  .fincla-toast { animation: toastIn 180ms cubic-bezier(0.2, 0, 0, 1); }
  /* Quem pediu menos movimento recebe o resultado, não a viagem: a linha some
     na hora em vez de deslizar, e o pulso não pisca. */
  @media (prefers-reduced-motion: reduce) {
    .fincla-tx-leave { animation-duration: 1ms; }
    .fincla-tx-settled { animation: none; }
    .fincla-toast { animation: none; }
  }
  .ai-spin { animation: spin 0.7s linear infinite; }
  .ai-shimmer {
    background: linear-gradient(90deg, #F3F4F6, #E9EBEF, #F3F4F6);
    background-size: 200% 100%;
    animation: shimmer 1.2s linear infinite;
  }
  /* DragScrollTabs — mantém o arrasto por toque; a barra já é oculta pelo
     padrão global de app-shell.css. */
  .dstabs-scroll { -webkit-overflow-scrolling: touch; }
  /* .fincla-scroll-y foi absorvida por .fincla-scroll (app-shell.css):
     uma convenção só para região rolável em todo o app. */
`;

export function AnimStyles() {
  const id = "fincla-anim-styles";
  if (typeof document !== "undefined" && !document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = ANIM_CSS;
    document.head.appendChild(s);
  }
  return null;
}
