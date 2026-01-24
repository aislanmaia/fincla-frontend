import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { wrapper } from '@/test/utils/test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const API_BASE_URL = 'http://localhost:8000';

describe('useAuth', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should start with null user', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('should login successfully', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.signIn('test@example.com', 'password');
        });

        // Após login, o query precisa ser refetchado
        // Esperar um pouco mais para o React Query processar
        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        }, { timeout: 3000 });

        expect(result.current.user?.email).toBe('test@example.com');
    });

    it('should logout successfully', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        // First login
        await act(async () => {
            await result.current.signIn('test@example.com', 'password');
        });

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        }, { timeout: 3000 });

        // Then logout
        act(() => {
            result.current.signOut();
        });

        // Após logout, o query deve retornar null
        await waitFor(() => {
            expect(result.current.user).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        });

        expect(localStorage.getItem('auth_token')).toBeNull();
    });
});
