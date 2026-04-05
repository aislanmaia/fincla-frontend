/**
 * Baseline: reset + seed `empty` (org limpa). Specs que precisam de dados chamam resetAndSeed de novo.
 */
import { resetAndSeedOrganization } from "./helpers/test-org";

export default async function globalSetup() {
  if (!process.env.TEST_RESET_SECRET) {
    console.warn("[e2e] TEST_RESET_SECRET ausente — globalSetup não chamou a API.");
    return;
  }

  const profile =
    process.env.E2E_GLOBAL_SEED_PROFILE ||
    process.env.E2E_SEED_PROFILE ||
    "empty";

  await resetAndSeedOrganization(profile);
}
