/**
 * Reset + seed via API de teste (fincla-api/docs/FRONTEND_API_GUIDE.md).
 * Usado no globalSetup e nos testes para org sempre previsível.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(__dirname, "../.cache");
const cacheFile = path.join(cacheDir, "setup.json");

function readCachedOrganizationId(): string | undefined {
  try {
    const raw = fs.readFileSync(cacheFile, "utf8");
    const parsed = JSON.parse(raw) as { organizationId?: unknown };
    return typeof parsed.organizationId === "string" ? parsed.organizationId : undefined;
  } catch {
    return undefined;
  }
}

export async function resetAndSeedOrganization(profile: string): Promise<string> {
  const secret = process.env.TEST_RESET_SECRET;
  if (!secret) {
    throw new Error("TEST_RESET_SECRET ausente");
  }

  const base = (process.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
  const organizationId =
    process.env.TEST_ORG_ID?.trim() || readCachedOrganizationId();

  const resetRes = await fetch(`${base}/v1/test/reset-organization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Reset-Token": secret,
    },
    body: JSON.stringify({
      ensure_fixtures: true,
      ...(organizationId ? { organization_id: organizationId } : {}),
    }),
  });
  if (!resetRes.ok) {
    throw new Error(`reset-organization: ${resetRes.status} ${await resetRes.text()}`);
  }
  const resetBody = (await resetRes.json()) as { organization_id: string };

  const seedRes = await fetch(`${base}/v1/test/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Reset-Token": secret,
    },
    body: JSON.stringify({
      organization_id: resetBody.organization_id,
      profile,
    }),
  });
  if (!seedRes.ok) {
    throw new Error(`test/seed: ${seedRes.status} ${await seedRes.text()}`);
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    cacheFile,
    JSON.stringify({ organizationId: resetBody.organization_id, profile }, null, 2),
    "utf8",
  );

  return resetBody.organization_id;
}
