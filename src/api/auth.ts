// api/auth.ts
import apiClient from './client';
import type {
  LoginResponse,
  User,
  ChangePasswordRequest,
  ChangePasswordResponse,
  UpdateProfileRequest,
  RegisterOwnerRequest,
  RegisterOwnerResponse,
  RegisterMemberRequest,
  RegisterMemberResponse,
} from './types';

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
 * Retorna o perfil do usuário autenticado (mesmo que /auth/me)
 */
export const getMyProfile = async (): Promise<User> => {
  const response = await apiClient.get<User>('/users/me');
  return response.data;
};

/**
 * Atualiza campos do perfil do usuário autenticado (partial update)
 */
export const updateMyProfile = async (
  data: UpdateProfileRequest
): Promise<User> => {
  const response = await apiClient.patch<User>('/users/me', data);
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

/**
 * Registra um novo usuário owner (público, não requer autenticação)
 */
export const registerOwner = async (
  email: string,
  password: string,
  plan: 'free' | 'beta' | 'premium' = 'free'
): Promise<RegisterOwnerResponse> => {
  const response = await apiClient.post<RegisterOwnerResponse>(
    '/users/register/owner',
    { email, password, plan }
  );
  return response.data;
};

/**
 * Registra um novo membro em uma organização (apenas owners)
 */
export const registerMember = async (
  email: string,
  password: string,
  organizationId: string
): Promise<RegisterMemberResponse> => {
  const response = await apiClient.post<RegisterMemberResponse>(
    '/users/register/member',
    {
      email,
      password,
      organization_id: organizationId,
    }
  );
  return response.data;
};

/**
 * Solicita e-mail com link de recuperação de senha (resposta genérica)
 */
export const forgotPassword = async (
  email: string
): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>(
    '/auth/forgot-password',
    { email }
  );
  return response.data;
};

/**
 * Redefine a senha com token recebido por e-mail
 */
export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>(
    '/auth/reset-password',
    { token, new_password: newPassword }
  );
  return response.data;
};
