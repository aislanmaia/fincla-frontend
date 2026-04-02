// api/chat.ts
import apiClient from './client';
import type { ChatResponse } from './types';

/**
 * Envia uma mensagem para o assistente financeiro de IA
 */
export const sendChatMessage = async (
  message: string,
  sessionId?: string
): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>(
    '/ai/chat',
    {
      message,
      session_id: sessionId,
    }
  );
  return response.data;
};
