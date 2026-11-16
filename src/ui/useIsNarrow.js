import { useEffect, useState } from "react";

/** `true` quando a viewport é mais estreita ou igual a `max` px (mobile-first: colunas empilham). */
export function useIsNarrow(max = 900) {
  const query = `(max-width: ${max}px)`;
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setNarrow(e.matches);
    setNarrow(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return narrow;
}
