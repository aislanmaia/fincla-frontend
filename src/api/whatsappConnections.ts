// api/whatsappConnections.ts
import apiClient from './client';
import {
  CreateWhatsAppConnectionRequest,
  ListWhatsAppConnectionsResponse,
  PendingWhatsAppLink,
  WhatsAppAssistantInfo,
} from './types';

/**
 * Inicia a verificação de um número de WhatsApp. Apenas owner.
 * O número deve estar no formato E.164 (ex: +5511999999999).
 *
 * NÃO ativa o vínculo: devolve um código de uso único que o usuário precisa
 * enviar ao bot, pelo WhatsApp, a partir do número que está vinculando.
 */
export const linkWhatsAppPhone = async (
  data: CreateWhatsAppConnectionRequest
): Promise<PendingWhatsAppLink> => {
  const response = await apiClient.post<PendingWhatsAppLink>(
    '/whatsapp-connections',
    data
  );
  return response.data;
};

/**
 * Número do assistente (o bot) que o usuário deve contatar, e o deep link.
 */
export const getAssistantInfo = async (): Promise<WhatsAppAssistantInfo> => {
  const response = await apiClient.get<WhatsAppAssistantInfo>(
    '/whatsapp-connections/assistant'
  );
  return response.data;
};

/**
 * Lista as conexões WhatsApp de uma organização.
 * Owner ou member podem listar.
 */
export const listWhatsAppConnections = async (
  organizationId: string
): Promise<ListWhatsAppConnectionsResponse> => {
  const response = await apiClient.get<ListWhatsAppConnectionsResponse>(
    '/whatsapp-connections',
    { params: { organization_id: organizationId } }
  );
  return response.data;
};

/**
 * Desvincula (desativa) uma conexão WhatsApp.
 * Apenas owner pode desvincular.
 */
export const unlinkWhatsAppPhone = async (
  connectionId: string
): Promise<void> => {
  await apiClient.delete(`/whatsapp-connections/${connectionId}`);
};
