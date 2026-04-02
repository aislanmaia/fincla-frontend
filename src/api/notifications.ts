// api/notifications.ts
import apiClient from './client';
import type { NotificationListResponse } from './types';

/**
 * Lista as notificações do usuário autenticado com paginação
 */
export const listNotifications = async (
  organizationId?: string,
  page = 1,
  limit = 20
): Promise<NotificationListResponse> => {
  const response = await apiClient.get<NotificationListResponse>(
    '/notifications',
    { params: { organization_id: organizationId, page, limit } }
  );
  return response.data;
};

/**
 * Marca uma notificação específica como lida
 */
export const markNotificationRead = async (
  notificationId: string
): Promise<void> => {
  await apiClient.post(`/notifications/${notificationId}/read`);
};

/**
 * Marca todas as notificações do usuário como lidas
 * (opcionalmente filtrado por organização)
 */
export const markAllNotificationsRead = async (
  organizationId?: string
): Promise<{ updated: number }> => {
  const response = await apiClient.post<{ updated: number }>(
    '/notifications/read-all',
    null,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
