import { useFinclaPages } from "./finclaPageContext.jsx";

export function AuthenticatedPageOutlet({ segment }) {
  const ctx = useFinclaPages();
  if (!ctx?.pages) return null;
  return ctx.pages[segment] ?? null;
}
