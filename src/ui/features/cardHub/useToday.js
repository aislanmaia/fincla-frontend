import { useEffect, useState } from "react";

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function msUntilNextMidnight(now) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

/** "Hoje" que acompanha a virada do dia e o retorno do foco à aba (aba aberta de um dia para o outro). */
export function useToday() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const refresh = () => {
      const now = new Date();
      setToday((prev) => (dayKey(prev) === dayKey(now) ? prev : now));
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilNextMidnight(now));
    };
    timer = setTimeout(refresh, msUntilNextMidnight(new Date()));
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
