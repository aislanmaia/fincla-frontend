// api/auth.ts
import apiClient from './client';
import { LoginRequest, LoginResponse, User, ChangePasswordRequest, ChangePasswordResponse } from '../types/api';

/**
 * Autentica um usuário e retorna o token JWT
 */
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/auth/login', {
    email,
    password,
  });
  
  // Armazenar token
  if (response.data.token) {
    localStorage.setItem('auth_token', response.data.token);
  }
  
  return response.data;
};

/**
 * Retorna informações do usuário autenticado
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
};

/**
 * Verifica se o usuário está autenticado
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('auth_token');
};

/**
 * Faz logout removendo o token
 */
export const logout = (): void => {
  localStorage.removeItem('auth_token');
};

/**
 * Atualiza a senha do usuário autenticado
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResponse> => {
  const response = await apiClient.put<ChangePasswordResponse>(
    '/users/me/password',
    {
      current_password: currentPassword,
      new_password: newPassword,
    }
  );
  return response.data;
};

