import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrganization } from '../useOrganization';
import { wrapper } from '@/test/utils/test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('useOrganization', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should start with null activeOrgId', () => {
        const { result } = renderHook(() => useOrganization(), { wrapper });

        expect(result.current.activeOrgId).toBeNull();
        expect(result.current.organizations).toEqual([]);
    });

    it('should load organizations and set first as active', async () => {
        const { result } = renderHook(() => useOrganization(), { wrapper });

        await waitFor(() => {
            expect(result.current.organizations.length).toBeGreaterThan(0);
        });

        await waitFor(() => {
            expect(result.current.activeOrgId).toBe('org-123');
        });

        expect(result.current.organizations).toHaveLength(1);
        expect(result.current.organizations[0].name).toBe('Test Organization');
    });

    it('should switch organization', async () => {
        const { result } = renderHook(() => useOrganization(), { wrapper });

        await waitFor(() => {
            expect(result.current.organizations.length).toBeGreaterThan(0);
        });

        // Switch to the same org (just to test the function)
        act(() => {
            result.current.selectOrganization('org-123');
        });

        expect(result.current.activeOrgId).toBe('org-123');
        expect(localStorage.getItem('active_organization_id')).toBe('org-123');
    });

    it('should persist active organization in localStorage', async () => {
        const { result } = renderHook(() => useOrganization(), { wrapper });

        await waitFor(() => {
            expect(result.current.organizations.length).toBeGreaterThan(0);
        });

        // Note: selectOrganization checks if org exists. 
        // Since MSW only returns org-123, we can only switch to org-123.
        // But we can test that it persists.
        act(() => {
            result.current.selectOrganization('org-123');
        });

        expect(localStorage.getItem('active_organization_id')).toBe('org-123');
    });

    it('should restore active organization from localStorage', async () => {
        // Pre-set localStorage
        localStorage.setItem('active_organization_id', 'org-123');

        const { result } = renderHook(() => useOrganization(), { wrapper });

        await waitFor(() => {
            expect(result.current.organizations.length).toBeGreaterThan(0);
        });

        expect(result.current.activeOrgId).toBe('org-123');
    });
});
