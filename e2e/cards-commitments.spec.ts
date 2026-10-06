/** Real API contract and request budget for Parcelas & Compromissos. */
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { loginAsE2EOwner } from "./helpers/auth";
import { fetchFirstCategoriaTagId, loginOwnerBearer, postTransaction } from "./helpers/api-owner";
import { resetAndSeedOrganization } from "./helpers/test-org";

const ready = Boolean(process.env.TEST_RESET_SECRET && process.env.E2E_TEST_OWNER_EMAIL
  && process.env.E2E_TEST_OWNER_PASSWORD && process.env.VITE_API_BASE_URL);
test.skip(!ready, "Exige API descartável e credenciais de E2E.");

const apiBase = () => (process.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const activeOrgKey = "fincla_active_org_id";
let orgId = "";
let bearer = "";
let publicId = "";
let cardId = 0;

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

test.beforeAll(async () => {
  if (!ready) return;
  orgId = await resetAndSeedOrganization("empty", randomUUID());
  bearer = await loginOwnerBearer();
  const tagId = await fetchFirstCategoriaTagId(bearer, orgId);
  const response = await api("/v1/credit-cards", {
    method: "POST",
    body: JSON.stringify({
      organization_id: orgId, last4: "2740", brand: "Visa", due_day: 10,
      closing_day: 15, description: "Cartão de compromissos", credit_limit: 1000,
    }),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  const card = (await response.json()) as { id: number; public_id: string };
  cardId = card.id;
  publicId = card.public_id;
  const today = new Date();
  await postTransaction(bearer, {
    type: "expense", description: "Notebook parcelado", value: 180.18,
    payment_method: "credit_card", card_id: cardId, modality: "installment", installments_count: 18,
    date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-05T12:00:00`,
    organization_id: orgId, tag_ids: [tagId], status: "confirmed", recurring: false,
  });
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`matches the API and request budget on ${viewport.name}`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/v1/credit-cards")) requests.push(request.url());
    });
    await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [activeOrgKey, orgId]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsE2EOwner(page);
    await page.waitForLoadState("networkidle");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    requests.length = 0;
    await page.goto(`/cards/${publicId}/commitments`);
    await expect(page.getByRole("heading", { name: /Parcelas.*Compromissos/ })).toBeVisible();
    const balanceResponse = await api(
      `/v1/credit-cards/${cardId}/future-commitments?organization_id=${orgId}&months=12&include_inventory=true&include_remaining=true`,
    );
    expect(balanceResponse.status, await balanceResponse.clone().text()).toBe(200);
    const balance = (await balanceResponse.json() as {
      remaining_balance: { complete: boolean; net_amount: { amount: string; currency: string } };
    }).remaining_balance;
    expect(balance.complete).toBe(true);
    const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: balance.net_amount.currency })
      .format(Number(balance.net_amount.amount));
    await expect(page.getByTestId("committed-total")).toContainText(formatted);
    await expect(page.getByText("Notebook parcelado").first()).toBeVisible();
    expect(requests.length, requests.join("\n")).toBeLessThanOrEqual(4);
    expect(requests.filter((url) => url.includes("future-commitments"))).toHaveLength(1);
    expect(requests.filter((url) => url.includes("/invoices/history"))).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `e2e/screenshots/cards-commitments-${viewport.name}.png`, fullPage: true });
  });
}
