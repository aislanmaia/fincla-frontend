/** Injeta stylesheet Google Fonts (Geist, Instrument Serif, Geist Mono) — idempotente */
export function injectAppFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById("fincla-fonts")) return;
  const l = document.createElement("link");
  l.id = "fincla-fonts";
  l.rel = "stylesheet";
  l.href =
    "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
}

injectAppFonts();
