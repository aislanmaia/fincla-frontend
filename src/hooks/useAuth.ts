// hooks/useAuth.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { login, getCurrentUser, logout as apiLogout, isAuthenticated } from '../api/auth';
import { LoginResponse, User } from '../types/api';
import { handleApiError } from '../api/client';

export const useAuth = () => {
  const queryClient = useQueryClient();

  // Usar React Query para cache compartilhado do usuário
  const { data: user, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      if (!isAuthenticated()) {
        return null;
      }
      try {
        return await getCurrentUser();
      } catch (err) {
        // Token inválido ou expirado
        apiLogout();
        return null;
      }
    },
    enabled: isAuthenticated(),
    staleTime: 5 * 60 * 1000, // 5 minutos - dados do usuário raramente mudam
    retry: false,
  });

  const signIn = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await login(email, password);
      // Invalidar cache e buscar usuário atualizado
      await queryClient.invalidateQueries({ queryKey: ['current-user'] });
      return response;
    } catch (err) {
      const errorMessage = handleApiError(err);
      throw new Error(errorMessage);
    }
  };

  const signOut = () => {
    apiLogout();
    // Limpar cache do usuário
    queryClient.setQueryData(['current-user'], null);
  };

  return {
    user: user || null,
    loading,
    error: queryError ? handleApiError(queryError) : null,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
};

