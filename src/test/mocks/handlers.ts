// test/mocks/handlers.ts
// MSW handlers para mockar API durante testes

import { http, HttpResponse } from 'msw';

export const handlers = [
    // Auth endpoints
    // Usar wildcard (*) para ignorar host/porta e focar apenas no path
    http.post('*/v1/auth/login', () => {
        return HttpResponse.json({
            token: 'mock-token-123',
            user_id: 'user-123',
            email: 'test@example.com',
            role: 'owner',
            subscription: {
                plan: 'free',
                status: 'active',
                max_organizations: 1,
                max_users_per_org: 5,
            },
        });
    }),

    http.get('*/v1/auth/me', () => {
        return HttpResponse.json({
            id: 'user-123',
            email: 'test@example.com',
            role: 'owner',
            first_name: 'Test',
            last_name: 'User',
            created_at: '2024-01-01T00:00:00Z',
            subscription: {
                plan: 'free',
                status: 'active',
                max_organizations: 1,
                max_users_per_org: 5,
                features: [],
            },
        });
    }),

    // Organizations endpoints
    http.get('*/v1/memberships/my-organizations', () => {
        return HttpResponse.json({
            total: 1,
            organizations: [
                {
                    organization: {
                        id: 'org-123',
                        name: 'Test Organization',
                        description: 'Test description',
                        created_at: '2024-01-01T00:00:00Z',
                    },
                    membership: {
                        id: 'membership-123',
                        role: 'owner',
                        created_at: '2024-01-01T00:00:00Z',
                    },
                },
            ],
        });
    }),

    // Transactions endpoints
    http.get('*/v1/transactions', ({ request }) => {
        const url = new URL(request.url);
        const organizationId = url.searchParams.get('organization_id');
        
        return HttpResponse.json([
            {
                id: 1,
                organization_id: organizationId || 'org-123',
                type: 'expense',
                description: 'Test expense',
                category: 'Alimentação',
                value: 50.0,
                payment_method: 'PIX',
                date: '2024-01-15T10:00:00',
                created_at: '2024-01-15T10:00:00',
                updated_at: '2024-01-15T10:00:00',
                tags: {
                    categoria: [
                        {
                            id: 'tag-123',
                            name: 'Alimentação',
                            type: 'categoria',
                            color: '#FF5733',
                            is_default: true,
                            is_active: true,
                            organization_id: organizationId || 'org-123',
                        },
                    ],
                },
            },
        ]);
    }),

    http.post('*/v1/transactions', () => {
        return HttpResponse.json({
            id: 2,
            organization_id: 'org-123',
            type: 'income',
            description: 'Test income',
            category: 'Salário',
            value: 1000.0,
            payment_method: 'Transferência',
            date: '2024-01-01T10:00:00',
            created_at: '2024-01-01T10:00:00',
            updated_at: '2024-01-01T10:00:00',
            tags: {},
        }, { status: 201 });
    }),

    // Tags endpoints
    http.get('*/v1/tag-types', () => {
        return HttpResponse.json([
            {
                id: 'tagtype-123',
                name: 'categoria',
                description: 'Categoria da transação',
                is_required: true,
                max_per_transaction: 1,
            },
        ]);
    }),

    http.get('*/v1/tags', () => {
        return HttpResponse.json([
            {
                id: 'tag-123',
                name: 'Alimentação',
                type: 'categoria',
                color: '#FF5733',
                is_default: true,
                is_active: true,
                organization_id: 'org-123',
            },
        ]);
    }),

    // Financial Impact endpoint
    http.post('*/v1/financial-impact/simulate', () => {
        return HttpResponse.json({
            simulation_id: 'sim-123',
            summary: {
                verdict: 'viable',
                verdict_message: 'Compra Viável',
                total_impact: 50.0,
                duration_months: 10,
            },
            timeline: [
                {
                    month: 'Janeiro',
                    year: 2025,
                    month_iso: '2025-01',
                    financial_data: {
                        projected_income: 5200,
                        base_expenses: 2800,
                        existing_commitments: 1200,
                        new_installment: 50,
                        total_obligations: 4050,
                        savings_goal: 1000,
                    },
                    result: {
                        projected_balance: 1150,
                        status: 'success',
                        meets_goal: true,
                    },
                },
            ],
        });
    }),
];
