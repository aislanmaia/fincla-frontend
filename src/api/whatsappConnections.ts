// api/whatsappConnections.ts
import apiClient from './client';
import {
  WhatsAppConnection,
  CreateWhatsAppConnectionRequest,
  ListWhatsAppConnectionsResponse,
} from '../types/api';

/**
 * Vincula um número de WhatsApp à organização.
 * O número deve estar no formato E.164 (ex: +5511999999999).
 * Apenas owner pode vincular.
 */
export const linkWhatsAppPhone = async (
  data: CreateWhatsAppConnectionRequest
): Promise<WhatsAppConnection> => {
  const response = await apiClient.post<WhatsAppConnection>(
    '/whatsapp-connections',
    data
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
