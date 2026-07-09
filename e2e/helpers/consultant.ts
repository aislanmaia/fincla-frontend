/**
 * Provisiona um consultor (e opcionalmente um cliente) via API, para os specs
 * do Consultor IA. Cada run usa e-mails únicos, então os specs não brigam
 * entre si nem dependem do seed global.
 */

function apiBase(): string {
  return (process.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
}

const PASSWORD = "Password123!";

export type ConsultantPlan = "consultant_pro" | "consultant_basic";

export interface SeededConsultant {
  email: string;
  password: string;
  token: string;
}

async function postJson(path: string, body: unknown, token?: string) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
}

/** Registra + loga um consultor no plano pedido. */
export async function createConsultant(plan: ConsultantPlan): Promise<SeededConsultant> {
  const email = `e2e-consultant-${plan}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;

  const registered = await postJson("/v1/users/register/owner", { email, password: PASSWORD, plan });
  if (!registered.ok) {
    throw new Error(`register consultant: ${registered.status} ${await registered.text()}`);
  }

  const logged = await postJson("/v1/auth/login", { email, password: PASSWORD });
  if (!logged.ok) throw new Error(`login consultant: ${logged.status} ${await logged.text()}`);

  const data = (await logged.json()) as { token?: string; access_token?: string };
  const token = data.token || data.access_token;
  if (!token) throw new Error("login consultant: token ausente");

  // Sem isto o consultor cai no wizard de onboarding em vez da área /consultant.
  // O gate de onboarding do consultor ainda não tem fluxo próprio (é contornado
  // por seed hoje); aqui usamos o endpoint público de perfil.
  const patched = await fetch(`${apiBase()}/v1/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ onboarding_completed: true }),
  });
  if (!patched.ok) {
    throw new Error(`complete onboarding: ${patched.status} ${await patched.text()}`);
  }

  return { email, password: PASSWORD, token };
}

/** Cria um cliente na carteira do consultor. Devolve o nome exibido na Carteira. */
export async function createClientFor(consultant: SeededConsultant): Promise<{ clientName: string }> {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const firstName = "Rafael";
  const lastName = "Menezes";

  const res = await postJson(
    "/v1/consultant/clients",
    {
      first_name: firstName,
      last_name: lastName,
      email: `e2e-client-${stamp}@test.com`,
      org_name: `Cliente E2E ${stamp}`,
      estimated_income: "14200",
      initial_balance: "3850",
    },
    consultant.token,
  );

  if (!res.ok) throw new Error(`create client: ${res.status} ${await res.text()}`);
  return { clientName: `${firstName} ${lastName}` };
}
