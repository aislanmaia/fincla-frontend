import { expect, type Page } from "@playwright/test";

export async function waitForDashboardSummary(page: Page): Promise<void> {
  await page.waitForResponse(
    (r) =>
      r.url().includes("/v1/transactions/summary") &&
      r.request().method() === "GET" &&
      r.ok(),
    { timeout: 45_000 },
  );
}

/** Gatilho do datepicker (presets ou personalizado já aplicado). */
export async function openDashboardPeriodMenu(page: Page): Promise<void> {
  const trigger = page.getByRole("button", {
    name: /Este mês|Mês passado|Período personalizado|Personalizado|Mês atual|30 dias|3 meses|6 meses|12 meses|Ano \(YTD\)/,
  });
  await expect(trigger.first()).toBeVisible({ timeout: 30_000 });
  await trigger.first().click();
  await expect(page.getByRole("tab", { name: "Predefinido" })).toBeVisible();
}

export async function selectDashboardPreset(
  page: Page,
  label: "Este mês" | "Mês passado",
): Promise<void> {
  await page.getByRole("menuitemradio", { name: label }).click();
  await waitForDashboardSummary(page);
}

export async function expectKpiCard(page: Page, titleRx: RegExp, value: string): Promise<void> {
  const src = titleRx.source;
  if (src.startsWith("^Receitas")) {
    await expect(page.getByTestId("dashboard-kpi-receitas").locator("> div").nth(1)).toHaveText(value);
    return;
  }
  if (src.startsWith("^Despesas")) {
    await expect(page.getByTestId("dashboard-kpi-despesas").locator("> div").nth(1)).toHaveText(value);
    return;
  }
  const title = page.getByText(titleRx).first();
  await expect(title).toBeVisible();
  await expect(title.locator("..").getByText(value, { exact: true })).toBeVisible();
}

export async function expectComprometido(page: Page, value: string): Promise<void> {
  await expect(page.getByTestId("dashboard-composicao-comprometido")).toHaveText(value);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD → dd/mm/aaaa para o LocaleDatePicker (pt-BR). */
export function ymdToBrInput(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) throw new Error(`ymd inválido: ${ymd}`);
  return `${d}/${m}/${y}`;
}

/**
 * Aba Personalizado: preenche data inicial e final (Enter confirma) e espera o summary.
 * Não fecha o painel — o caller pode dar Escape ou clicar fora.
 */
export async function fillDashboardCustomRange(
  page: Page,
  startYmd: string,
  endYmd: string,
): Promise<void> {
  await page.getByRole("tab", { name: "Personalizado" }).click();

  const ini = page.getByText("Data inicial", { exact: true }).locator("..");
  const fim = page.getByText("Data final", { exact: true }).locator("..");

  const startInput = ini.locator('input[placeholder="dd/mm/aaaa"]');
  const endInput = fim.locator('input[placeholder="dd/mm/aaaa"]');

  await startInput.click();
  await startInput.fill(ymdToBrInput(startYmd));
  await startInput.press("Enter");

  await endInput.click();
  await endInput.fill(ymdToBrInput(endYmd));
  await endInput.press("Enter");

  await waitForDashboardSummary(page);
}

/** Intervalo inclusivo dentro do mês de calendário anterior ao de `anchor`. */
export function rangePrevMonthInclusiveDays(
  anchor: Date,
  startDay: number,
  endDay: number,
): { start: string; end: string } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const lastDayOfPrev = new Date(y, m, 0).getDate();
  const dStart = Math.min(Math.max(1, startDay), lastDayOfPrev);
  const dEnd = Math.min(Math.max(dStart, endDay), lastDayOfPrev);
  const s = new Date(y, m - 1, dStart);
  const e = new Date(y, m - 1, dEnd);
  return {
    start: `${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}`,
    end: `${e.getFullYear()}-${pad2(e.getMonth() + 1)}-${pad2(e.getDate())}`,
  };
}

/**
 * Ciclo “dia 5 → dia 4 do mês seguinte” (ex.: 05/mar–04/abr).
 * Se o dia 4 do mês atual ainda não chegou, usa o ciclo anterior (ex.: em 03/abr → 05/fev–04/mar).
 */
export function rangeBillingCycleFiveToFour(anchor: Date): { start: string; end: string } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();

  const startCurr = new Date(y, m - 1, 5);
  const endCurr = new Date(y, m, 4);
  const today0 = new Date(y, m, d).getTime();

  if (endCurr.getTime() <= today0) {
    return {
      start: `${startCurr.getFullYear()}-${pad2(startCurr.getMonth() + 1)}-${pad2(startCurr.getDate())}`,
      end: `${endCurr.getFullYear()}-${pad2(endCurr.getMonth() + 1)}-${pad2(endCurr.getDate())}`,
    };
  }

  const startPrev = new Date(y, m - 2, 5);
  const endPrev = new Date(y, m - 1, 4);
  return {
    start: `${startPrev.getFullYear()}-${pad2(startPrev.getMonth() + 1)}-${pad2(startPrev.getDate())}`,
    end: `${endPrev.getFullYear()}-${pad2(endPrev.getMonth() + 1)}-${pad2(endPrev.getDate())}`,
  };
}

export function rangeMesPassado(anchor = new Date()): { start: string; end: string } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    start: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    end: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}
