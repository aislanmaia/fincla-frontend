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
