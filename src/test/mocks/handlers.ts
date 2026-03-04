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
        
        return HttpResponse.json({
            data: [
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
            ],
            pagination: {
                page: 1,
                limit: 100,
                total: 1,
                pages: 1,
                has_next: false,
                has_prev: false,
            },
        });
    }),

    http.get('*/v1/transactions/summary', ({ request }) => {
        const url = new URL(request.url);
        const organizationId = url.searchParams.get('organization_id');
        return HttpResponse.json({
            total_transactions: 1,
            total_value: 50.0,
            total_income: 0,
            total_expenses: 50.0,
            balance: -50.0,
            average_transaction: 50.0,
            period: {
                start_date: '2024-01-01',
                end_date: '2024-01-31',
            },
            filters_applied: {
                organization_id: organizationId || 'org-123',
                type: null,
                category: null,
                payment_method: null,
                date_start: '2024-01-01',
                date_end: '2024-01-31',
            },
        });
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
        return HttpResponse.json({
            tag_types: [
                {
                    id: 'tagtype-123',
                    name: 'categoria',
                    description: 'Categoria da transação',
                    is_required: true,
                    max_per_transaction: 1,
                },
            ],
        });
    }),
    http.post('*/v1/tag-types', async ({ request }) => {
        const body = (await request.json()) as { name: string; description?: string };
        return HttpResponse.json(
            {
                id: `tagtype-${Date.now()}`,
                name: body.name,
                description: body.description ?? null,
                is_required: false,
                max_per_transaction: null,
            },
            { status: 201 }
        );
    }),
    http.patch('*/v1/tag-types/*', async ({ request }) => {
        const body = (await request.json()) as { name?: string; description?: string };
        return HttpResponse.json({
            id: 'tagtype-123',
            name: body.name ?? 'categoria',
            description: body.description ?? null,
            is_required: false,
            max_per_transaction: null,
        });
    }),
    http.delete('*/v1/tag-types/*', () => {
        return new HttpResponse(null, { status: 204 });
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

    // Consultant endpoints
    http.get('*/v1/consultant/summary', () => {
        return HttpResponse.json({
            total_income: 50000,
            total_expenses: 32000,
            balance: 18000,
            total_transactions: 245,
            organizations_count: 8,
            period_start: '2025-01-01',
            period_end: '2025-01-31',
        });
    }),
    http.get('*/v1/consultant/clients', () => {
        return HttpResponse.json({
            total: 2,
            clients: [
                {
                    organization_id: 'org-123',
                    organization_name: 'Empresa ABC',
                    role: 'owner',
                    membership_created_at: '2024-06-15T10:00:00Z',
                },
                {
                    organization_id: 'org-456',
                    organization_name: 'Empresa XYZ',
                    role: 'member',
                    membership_created_at: '2024-08-20T14:30:00Z',
                },
            ],
        });
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
