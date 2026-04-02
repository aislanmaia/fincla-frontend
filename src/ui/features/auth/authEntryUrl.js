/**
 * Parâmetros de URL suportados (alinhar links dos e-mails do backend):
 *
 * Convite:
 *   - ?invite_token=... ou ?invitation_token=...
 *   - ?action=accept_invite&token=...
 *   - Fragmento #...?invite_token=... (query após #)
 *
 * Redefinição de senha:
 *   - ?reset_token=...
 *   - ?action=reset_password&token=...
 *
 * Não usamos ?token= sozinho para evitar conflito entre fluxos.
 */

function parseHashToSearchParams(hash) {
  const raw = String(hash ?? "").replace(/^#/, "");
  if (!raw) return new URLSearchParams();
  const q = raw.indexOf("?");
  const segment =
    q >= 0 ? raw.slice(q + 1) : raw.includes("=") ? raw : "";
  if (!segment) return new URLSearchParams();
  return new URLSearchParams(segment);
}

function mergeUrlSearchParams(searchPart, hash) {
  const merged = new URLSearchParams(searchPart || "");
  const hashParams = parseHashToSearchParams(hash);
  for (const [k, v] of hashParams.entries()) {
    if (!merged.has(k)) merged.set(k, v);
  }
  return merged;
}

/**
 * @param {string} [search] — ex.: window.location.search ("?a=1")
 * @param {string} [hash] — ex.: window.location.hash
 * @returns {{ kind: 'invite' | 'reset' | null, token: string | null }}
 */
export function parseAuthEntryFromSearchAndHash(search, hash) {
  const searchPart =
    typeof search === "string"
      ? search.startsWith("?")
        ? search.slice(1)
        : search
      : "";
  const params = mergeUrlSearchParams(searchPart, hash ?? "");
  const get = (k) => params.get(k);

  const inviteTok =
    get("invite_token") ||
    get("invitation_token") ||
    (get("action") === "accept_invite" ? get("token") : null);
  if (inviteTok?.trim()) {
    return { kind: "invite", token: inviteTok.trim() };
  }

  const resetTok =
    get("reset_token") ||
    (get("action") === "reset_password" ? get("token") : null);
  if (resetTok?.trim()) {
    return { kind: "reset", token: resetTok.trim() };
  }

  return { kind: null, token: null };
}

export function parseAuthEntryUrl() {
  if (typeof window === "undefined") {
    return { kind: null, token: null };
  }
  return parseAuthEntryFromSearchAndHash(
    window.location.search,
    window.location.hash
  );
}

export function stripAuthEntryQueryAndHash() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname || "/";
  window.history.replaceState(null, "", path);
}
