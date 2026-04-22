import { isAuthRouteSegment } from "./appSegments.js";
import { isProfileSettingsTabSlug } from "./profileSettingsTabs.js";
import { isTransactionEditPathId } from "./transactionPathId.js";

const STORAGE_KEY = "fincla_post_login_return";
const MAX_FULL_LEN = 2048;

/**
 * Caminhos internos que um utilizador autenticado pode abrir na SPA.
 * Evita open-redirect (ex.: `//evil.com`) e grava só rotas conhecidas.
 */
export function isReturnableFinclaPathname(pathname) {
  if (typeof pathname !== "string" || pathname === "" || pathname === "/") {
    return false;
  }
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return false;
  const [a, b] = segs;
  if (a === "profile") {
    if (segs.length === 1) return true;
    if (segs.length === 2) return isProfileSettingsTabSlug(b);
    return false;
  }
  if (segs.length === 2 && a === "transactions") {
    return isTransactionEditPathId(b);
  }
  if (segs.length !== 1) return false;
  return isAuthRouteSegment(a) && a !== "profile";
}

function isSafePathname(pathname) {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return false;
  const parts = pathname.split("/").filter(Boolean);
  for (const p of parts) {
    if (p === "." || p === "..") return false;
    if (!/^[a-z0-9_-]+$/i.test(p)) return false;
  }
  return true;
}

function isSafeSearchStr(searchStr) {
  if (searchStr == null || searchStr === "") return true;
  if (typeof searchStr !== "string") return false;
  if (!searchStr.startsWith("?")) return false;
  if (searchStr.length > 1024) return false;
  if (/[<>"']/.test(searchStr)) return false;
  return true;
}

function buildRelativeHref(pathname, searchStr) {
  const q = searchStr == null || searchStr === "" ? "" : searchStr;
  return `${pathname}${q}`;
}

/**
 * @param {{ pathname: string; searchStr?: string }} location
 */
export function capturePostLoginRedirectFromLocation(location) {
  try {
    const pathname = location?.pathname;
    const searchStr = location?.searchStr ?? "";
    if (!isSafePathname(pathname) || !isSafeSearchStr(searchStr)) return;
    if (!isReturnableFinclaPathname(pathname)) return;
    const href = buildRelativeHref(pathname, searchStr);
    if (href.length > MAX_FULL_LEN) return;
    sessionStorage.setItem(STORAGE_KEY, href);
  } catch {
    /* sessionStorage indisponível */
  }
}

/**
 * Fallback quando o router ainda expõe o URL pedido (ex.: rota sem `beforeLoad` de sessão).
 */
export function capturePostLoginRedirectFromPathnameAndSearchStr(pathname, searchStr) {
  capturePostLoginRedirectFromLocation({ pathname, searchStr });
}

export function clearPostLoginRedirect() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Lê e remove o destino pós-login. Devolve argumentos para `navigate()` do TanStack Router.
 * @returns {{ href: string; replace: true } | null}
 */
export function consumePostLoginNavigateArgs() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!raw || typeof raw !== "string") return null;
    if (raw.length > MAX_FULL_LEN) return null;
    let url;
    try {
      url = new URL(raw, "http://fincla.local");
    } catch {
      return null;
    }
    const pathname = url.pathname;
    const searchStr = url.search || "";
    if (!isSafePathname(pathname) || !isSafeSearchStr(searchStr)) return null;
    if (!isReturnableFinclaPathname(pathname)) return null;
    const href = buildRelativeHref(pathname, searchStr);
    return { href, replace: true };
  } catch {
    return null;
  }
}
