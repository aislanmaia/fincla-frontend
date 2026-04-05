/**
 * Integração opcional contra API real (rotas /test/* não usam JWT).
 * Rode:
 *   FINCLA_INTEGRATION_API=1 TEST_RESET_SECRET=... VITE_API_BASE_URL=http://localhost:5000 npm test -- recurring-api.optional
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { resetTestOrganization, seedTestOrganization } from '../testFixtures';

const RUN = process.env.FINCLA_INTEGRATION_API === '1' && process.env.TEST_RESET_SECRET;

describe.skipIf(!RUN)('Integração API — test reset + seed (sem JWT)', () => {
  let orgId: string;
  const secret = process.env.TEST_RESET_SECRET!;

  beforeAll(async () => {
    const reset = await resetTestOrganization(secret, { ensure_fixtures: true });
    orgId = reset.organization_id;
  }, 60_000);

  it('seed recurring_e2e responde 200', async () => {
    const seeded = await seedTestOrganization(secret, {
      organization_id: orgId,
      profile: 'recurring_e2e',
    });
    expect(seeded.organization_id).toBe(orgId);
    expect(seeded.profile).toBe('recurring_e2e');
    expect(seeded.seeded).toBeDefined();
  }, 30_000);

  it('segundo reset limpa dados mantendo org', async () => {
    const again = await resetTestOrganization(secret, {
      organization_id: orgId,
      ensure_fixtures: true,
    });
    expect(again.organization_id).toBe(orgId);
  }, 60_000);
});
