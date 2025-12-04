// hooks/useOrganization.ts
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyOrganizations } from '@/api/organizations';
import { OrganizationWithMembership } from '@/types/api';

const STORAGE_KEY = 'active_organization_id';

/**
 * Hook para gerenciar a organização ativa do usuário
 * - Carrega organizações do backend
 * - Persiste seleção no localStorage
 * - Fornece funções para trocar de organização
 */
export function useOrganization() {
    const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
        // Carregar do localStorage na inicialização
        return localStorage.getItem(STORAGE_KEY);
    });

    // Carregar organizações do usuário
    const {
        data: organizationsData,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['my-organizations'],
        queryFn: getMyOrganizations,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });

    const organizations = organizationsData?.organizations || [];
    const totalOrganizations = organizationsData?.total || 0;

    // Selecionar primeira organização automaticamente se não houver seleção
    useEffect(() => {
        if (!activeOrgId && organizations.length > 0) {
            const firstOrg = organizations[0].organization;
            setActiveOrgId(firstOrg.id);
            localStorage.setItem(STORAGE_KEY, firstOrg.id);
        }
    }, [activeOrgId, organizations]);

    // Verificar se organização ativa ainda existe na lista
    useEffect(() => {
        if (activeOrgId && organizations.length > 0) {
            const exists = organizations.some((o) => o.organization.id === activeOrgId);
            if (!exists) {
                // Organização não existe mais, selecionar primeira disponível
                const firstOrg = organizations[0].organization;
                setActiveOrgId(firstOrg.id);
                localStorage.setItem(STORAGE_KEY, firstOrg.id);
            }
        } else if (activeOrgId && organizations.length === 0 && !isLoading) {
            // Usuário não tem mais organizações, limpar activeOrgId
            setActiveOrgId(null);
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [activeOrgId, organizations, isLoading]);

    /**
     * Troca a organização ativa
     */
    const selectOrganization = (organizationId: string) => {
        const exists = organizations.some((o) => o.organization.id === organizationId);
        if (!exists) {
            console.error(`Organization ${organizationId} not found in user's organizations`);
            return false;
        }

        setActiveOrgId(organizationId);
        localStorage.setItem(STORAGE_KEY, organizationId);
        return true;
    };

    /**
     * Obtém dados completos da organização ativa
     */
    const activeOrganization = organizations.find(
        (o) => o.organization.id === activeOrgId
    );

    /**
     * Verifica se usuário é owner da organização ativa
     */
    const isOwner = activeOrganization?.membership.role === 'owner';

    return {
        // Estado
        activeOrgId,
        activeOrganization: activeOrganization?.organization || null,
        activeMembership: activeOrganization?.membership || null,
        isOwner,

        // Lista de organizações
        organizations: organizations.map((o) => o.organization),
        organizationsWithMembership: organizations,
        totalOrganizations,

        // Loading e erro
        isLoading,
        error: error ? String(error) : null,

        // Ações
        selectOrganization,
        refetch,
    };
}
