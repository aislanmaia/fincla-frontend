/**
 * Chamadas às rotas /v1/test/* (sem JWT; só X-Test-Reset-Token).
 * Usadas em globalSetup Playwright/CI — não usar a partir da SPA em produção.
 */
import axios from 'axios';
import { API_CONFIG } from './config';
import type {
  ResetTestOrganizationRequest,
  SeedTestOrganizationRequest,
  SeedTestOrganizationResponse,
  TestResetOrganizationResponse,
} from './types';

const testClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.REQUEST_CONFIG.TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

function testHeaders(secret: string) {
  return { 'X-Test-Reset-Token': secret };
}

export async function resetTestOrganization(
  secret: string,
  body: ResetTestOrganizationRequest = {},
): Promise<TestResetOrganizationResponse> {
  const response = await testClient.post<TestResetOrganizationResponse>(
    '/test/reset-organization',
    body,
    { headers: testHeaders(secret) },
  );
  return response.data;
}

export async function seedTestOrganization(
  secret: string,
  body: SeedTestOrganizationRequest,
): Promise<SeedTestOrganizationResponse> {
  const response = await testClient.post<SeedTestOrganizationResponse>(
    '/test/seed',
    body,
    { headers: testHeaders(secret) },
  );
  return response.data;
}
