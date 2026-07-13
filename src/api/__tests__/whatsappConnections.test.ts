import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import {
  getAssistantInfo,
  linkWhatsAppPhone,
  listWhatsAppConnections,
  unlinkWhatsAppPhone,
} from '../whatsappConnections';
import { PendingWhatsAppLink, WhatsAppAssistantInfo } from '../types';

vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const pendingLink: PendingWhatsAppLink = {
  status: 'pending',
  connection_id: 'conn_1',
  phone_number: '+5511999999999',
  verification_code: '123456',
  expires_at: '2026-07-13T12:10:00Z',
  wa_me_url: 'https://wa.me/15551502382?text=123456',
};

const assistant: WhatsAppAssistantInfo = {
  phone_number: '+15551502382',
  display_name: 'Fincla',
  wa_me_url: 'https://wa.me/15551502382',
};

describe('whatsappConnections API client', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.delete).mockReset();
  });

  it('linkWhatsAppPhone posts to /whatsapp-connections and returns the pending link', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: pendingLink });

    const result = await linkWhatsAppPhone({
      organization_id: 'org_1',
      phone_number: '+5511999999999',
    });

    expect(result).toEqual(pendingLink);
    expect(result.verification_code).toBe('123456');
    expect(apiClient.post).toHaveBeenCalledWith('/whatsapp-connections', {
      organization_id: 'org_1',
      phone_number: '+5511999999999',
    });
  });

  it('getAssistantInfo reads the bot number from /whatsapp-connections/assistant', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: assistant });

    const result = await getAssistantInfo();

    expect(result).toEqual(assistant);
    expect(apiClient.get).toHaveBeenCalledWith('/whatsapp-connections/assistant');
  });

  it('listWhatsAppConnections passes organization_id as a query param', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { total: 0, connections: [] } });

    await listWhatsAppConnections('org_1');

    expect(apiClient.get).toHaveBeenCalledWith('/whatsapp-connections', {
      params: { organization_id: 'org_1' },
    });
  });

  it('unlinkWhatsAppPhone deletes by connection id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: undefined });

    await unlinkWhatsAppPhone('conn_1');

    expect(apiClient.delete).toHaveBeenCalledWith('/whatsapp-connections/conn_1');
  });
});
