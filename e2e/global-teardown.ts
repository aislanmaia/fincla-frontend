/**
 * Após a suíte: reset + seed `empty` deixa a org de teste zerada
 * para que a próxima execução (local ou CI) comece do zero previsível.
 */
import { resetAndSeedOrganization } from "./helpers/test-org";

export default async function globalTeardown() {
  if (!process.env.TEST_RESET_SECRET) {
    console.warn("[e2e] TEST_RESET_SECRET ausente — globalTeardown não chamou a API.");
    return;
  }

  if (process.env.E2E_SKIP_TEARDOWN === "1") {
    console.log("[e2e] E2E_SKIP_TEARDOWN=1 — pulando reset final.");
    return;
  }

  try {
    await resetAndSeedOrganization("empty");
  } catch (err) {
    console.warn("[e2e] globalTeardown falhou (ignorado):", err);
  }
}
