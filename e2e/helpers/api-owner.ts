/**
 * Chamadas REST autenticadas como o owner E2E (mesmo usuário do login na UI).
 */

function apiBase(): string {
  return (process.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
}

export async function loginOwnerBearer(): Promise<string> {
  const email = process.env.E2E_TEST_OWNER_EMAIL;
  const password = process.env.E2E_TEST_OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_OWNER_EMAIL / E2E_TEST_OWNER_PASSWORD ausentes");
  }
  const res = await fetch(`${apiBase()}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`login: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { token?: string; access_token?: string };
  const token = data.token || data.access_token;
  if (!token) throw new Error("login: token ausente na resposta");
  return token;
}

export async function fetchFirstCategoriaTagId(
  bearer: string,
  organizationId: string,
): Promise<string> {
  const res = await fetch(
    `${apiBase()}/v1/tags?organization_id=${encodeURIComponent(organizationId)}&tag_type=categoria`,
    { headers: { Authorization: `Bearer ${bearer}` } },
  );
  if (!res.ok) throw new Error(`tags: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { tags?: { id: string }[] };
  const id = data.tags?.[0]?.id;
  if (!id) throw new Error("Nenhuma tag categoria na org");
  return id;
}

/** Orgs do owner, na mesma ordem que a SPA recebe (a sessão abre a primeira). */
export async function listMyOrganizations(
  bearer: string,
): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${apiBase()}/v1/memberships/my-organizations`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!res.ok) throw new Error(`my-organizations: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    organizations?: { organization: { id: string; name: string } }[];
  };
  return (data.organizations ?? []).map((item) => item.organization);
}

/** Tags de categoria da org, inteiras (o rótulo PT depende de icon_key/is_default). */
export async function listCategoriaTags(
  bearer: string,
  organizationId: string,
): Promise<Record<string, any>[]> {
  const res = await fetch(
    `${apiBase()}/v1/tags?organization_id=${encodeURIComponent(organizationId)}&tag_type=categoria`,
    { headers: { Authorization: `Bearer ${bearer}` } },
  );
  if (!res.ok) throw new Error(`tags: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { tags?: Record<string, any>[] };
  return data.tags ?? [];
}

export async function postRecurringSeries(
  bearer: string,
  organizationId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(
    `${apiBase()}/v1/recurring-series?organization_id=${encodeURIComponent(organizationId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`recurring-series POST: ${res.status} ${await res.text()}`);
  }
}

export async function postTransaction(
  bearer: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${apiBase()}/v1/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`transactions POST: ${res.status} ${await res.text()}`);
  }
}
