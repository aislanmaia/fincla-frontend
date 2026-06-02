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
  /* DragScrollTabs — hide native scrollbar everywhere */
  .dstabs-scroll { -webkit-overflow-scrolling: touch; }
  .dstabs-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .dstabs-scroll { scrollbar-width: none; -ms-overflow-style: none; }
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
