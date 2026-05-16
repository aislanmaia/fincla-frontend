# Endpoint de testes: `POST /v1/test/reset-organization`

**Audiência:** backend (implementação) e frontend/QA (E2E, CI).  
**Objetivo:** resetar dados de uma organização de teste de forma **idempotente**, com opção de **criar** org + owner quando ainda não existirem — sem nenhuma superfície ativa em **produção**.

**Documentos relacionados:** `docs/BACKEND_DASHBOARD_RECURRING_PERIOD_ALIGNMENT.md` (KPIs / summary).

---

## 1. Contexto

O frontend usa uma **organização dedicada a E2E**. Este endpoint:

1. (Opcional) **Garante** que existam organização de teste e membro **owner**.
2. **Apaga** dados mutáveis da org (transações, séries, orçamentos, etc.).
3. **Preserva** a org e o vínculo do owner para login imediato na suite.

---

## 2. Contrato HTTP

| Item | Valor |
|------|--------|
| Método | `POST` |
| Caminho | `/v1/test/reset-organization` |
| `Content-Type` | `application/json` |
| Autenticação | **Não** exige `Authorization: Bearer` (recomendado), para evitar dependência de login antes do reset. Toda a proteção é por **ambiente + header secreto**. Se o produto exigir JWT no futuro, documentar no guia da API e o CI deve usar usuário *service* com token de longa duração. |
| Obrigatório | Header `X-Test-Reset-Token: <TEST_RESET_SECRET>` |

**Produção:** a rota **não é registrada** (cliente recebe **404** em qualquer método nesse path).

---

## 3. Corpo da requisição (JSON)

### 3.1 Campos

| Campo | Tipo | Obrigatório | Padrão quando omitido |
|-------|------|-------------|------------------------|
| `organization_id` | `string` (UUID) | Não | Ver matriz §5 |
| `ensure_fixtures` | `boolean` | Não | **`true`** (recomendação de contrato: omitir = provisionar se necessário) |
| `owner_user_id` | `string` (UUID) | Não | Se informado **e** existir, o backend deve garantir membership **owner** dessa org para esse usuário em vez de criar usuário técnico (quando aplicável ao modelo de auth). |

**Regra de ouro para o CI:** enviar sempre `ensure_fixtures: true` explicitamente evita divergência se um dia o padrão mudar.

### 3.2 Exemplo mínimo (primeiro run, sem org conhecida)

```json
{
  "ensure_fixtures": true
}
```

### 3.3 Exemplo com org já conhecida

```json
{
  "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "ensure_fixtures": true
}
```

---

## 4. Resposta de sucesso (`200 OK`)

### 4.1 Schema (canônico)

```typescript
interface TestResetOrganizationResponse {
  organization_id: string;
  /** Sempre presente após sucesso. */
  provisioned: {
    organization_created: boolean;
    owner_user_created: boolean;
    membership_created: boolean;
  };
  /** Contagens de registros removidos (0 se não havia dados). */
  deleted: Record<string, number>;
  /** Lista fixa informativa do que não foi apagado. */
  preserved: string[];
  /** Opcional: UUID do usuário owner efetivo (útil para logs no CI). */
  owner_user_id?: string;
}
```

### 4.2 Exemplo

```json
{
  "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "provisioned": {
    "organization_created": true,
    "owner_user_created": true,
    "membership_created": true
  },
  "owner_user_id": "…",
  "deleted": {
    "transactions": 47,
    "recurring_series": 12,
    "budgets": 3,
    "goals": 2,
    "tags": 8,
    "credit_cards": 1
  },
  "preserved": ["organization", "owner_membership"]
}
```

**Proibido:** retornar senha, hash ou refresh token na resposta.

Os nomes dentro de `deleted` devem refletir o modelo real (podem incluir mais chaves).

---

## 5. Matriz de decisão (backend)

Legenda: **E** = `ensure_fixtures`, **OID** = `organization_id`.

| OID | E | Situação | Ação |
|-----|---|----------|------|
| omitido | `true` | — | Resolver org padrão de teste: buscar por **slug ou nome canônico** acordado (ex.: `__test_e2e_default` / slug `test-e2e-default`). Se não existir, **criar** org elegível + owner + membership → **reset**. |
| omitido | `false` | — | **422** `organization_id` obrigatório quando `ensure_fixtures` é `false`. |
| UUID válido | qualquer | Org existe, **é** org de teste (§8.3) | **Reset** nessa org. Provisionar owner/membership só se faltar e `E === true`. |
| UUID válido | `true` | Org **não** existe | **Criar** nova org de teste (novo UUID **ou** política do backend), retornar `organization_created: true` → **reset**. **Não** retornar 404. |
| UUID válido | `false` | Org **não** existe | **404** `organization not found`. |
| UUID válido | qualquer | Org existe, **não** é org de teste | **403** (produção de dados reais). |
| UUID inválido | — | formato | **422** |

**Idempotência:** chamadas repetidas com os mesmos parâmetros devem resultar em org vazia (dados resetados), sem erro, e `provisioned.*_created` em `false` após a primeira criação.

---

## 6. Provisionamento (org + owner)

Quando `ensure_fixtures === true` e faltar algo:

1. **Organização:** nome/slug com prefixo `__test_` ou flag `is_test_org: true` (o backend escolhe uma convenção e **fixa** no código).
2. **Usuário owner:**  
   - Se `owner_user_id` válido foi enviado → garantir papel de owner nessa org.  
   - Senão → criar ou reutilizar usuário técnico cujo email/senha vêm **somente** de variáveis de ambiente do servidor, por exemplo:  
     - `E2E_TEST_OWNER_EMAIL`  
     - `E2E_TEST_OWNER_PASSWORD` (ou hash pré-calculado, conforme stack)  
   Essas variáveis **não existem** em produção.
3. **Ordem:** garantir fixtures → executar deleções da §9 → retornar `200`.

---

## 7. Erros HTTP (referência)

| Código | Quando |
|--------|--------|
| **401** | Ausência de `X-Test-Reset-Token`, token incorreto ou `TEST_RESET_SECRET` não configurado no servidor (tratar como inválido). |
| **403** | `organization_id` aponta para organização **não** elegível como teste. |
| **404** | Rota inexistente (produção) **ou** org não encontrada com `ensure_fixtures: false`. |
| **422** | JSON inválido, UUID malformado, `organization_id` obrigatório faltando com `ensure_fixtures: false`, ou regras de validação do body. |
| **500** | Falha na transação de limpeza; o backend deve fazer **rollback** quando usar transação única. |

**Nota:** com `ensure_fixtures: true`, “org não encontrada” para UUID desconhecido **não** deve gerar 404; seguir §5 (criar fixture).

---

## 8. Segurança

### 8.1 Ambientes em que a rota existe

| Ambiente | Registrar rota? |
|----------|-----------------|
| **development** | Sim |
| **test** | Sim |
| **staging** | Sim |
| **production** | **Não** (404) |

Variáveis típicas: `APP_ENV`, `NODE_ENV`, `RAILS_ENV` — o backend documenta qual usa como fonte da verdade.

### 8.2 Segredo

- `TEST_RESET_SECRET`: string longa, aleatória, igual no servidor e no CI.
- Nunca commitar; injetar via secrets do CI / `.env.local`.

### 8.3 O que caracteriza “organização de teste”

Uma org só pode ser alvo do reset se **uma** das condições for verdadeira:

- Nome (ou slug) começa com `__test_`, **ou**
- `is_test_org === true` no registro, **ou**
- Foi criada por este próprio endpoint / fluxo `/v1/test/*`.

Orgs recém-criadas por `ensure_fixtures` já nascem elegíveis.

---

## 9. Escopo da limpeza

Executar preferencialmente em **uma transação** de banco.

**Apagar (exemplos — ajustar ao schema):** pivôs de transação → transações → séries recorrentes → recorrências legadas → orçamentos → metas/contribuições → cartões → tags customizadas (definir se tags sistema ficam) → relatórios/snapshots.

**Nunca apagar neste endpoint:** registro da organização; membership do owner (se não houver owner, criar antes com §6).

**Seeds mínimos:** se o app quebrar sem certas tags/tipos, recriá-los após o reset ou preservá-los — documentar no guia da API.

---

## 10. `POST /v1/test/seed` (opcional)

Mesmas travas que §8 + mesmo header `X-Test-Reset-Token`.

```json
{
  "organization_id": "uuid",
  "profile": "recurring_e2e"
}
```

Perfis sugeridos: `recurring_e2e`, `dashboard_e2e`, `empty` — conteúdo mínimo descrito no time backend.

**Ordem no CI:** `reset-organization` → `seed` (se usado).

---

## 11. Guia de implementação — frontend / E2E / CI

### 11.1 Variáveis de ambiente (runner E2E)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_API_BASE_URL` ou base usada pelo Playwright | Sim | URL da API (dev local, staging, container). |
| `TEST_RESET_SECRET` | Sim | Igual ao `TEST_RESET_SECRET` do backend. |
| `TEST_ORG_ID` | Não no **primeiro** run | Após o primeiro `200`, persistir `organization_id` da resposta para as próximas chamadas (cache em arquivo, env injetado pelo CI, etc.). |
| `E2E_TEST_OWNER_EMAIL` / `E2E_TEST_OWNER_PASSWORD` | Sim para **login UI** | Devem ser os **mesmos** valores configurados no servidor para o usuário técnico (ou credenciais de um usuário já vinculado via `owner_user_id`). |

### 11.2 Sequência recomendada

```text
globalSetup ou beforeAll:
  POST /v1/test/reset-organization
    Headers: X-Test-Reset-Token: process.env.TEST_RESET_SECRET
    Body: { "ensure_fixtures": true, "organization_id": process.env.TEST_ORG_ID ?? undefined }
  → salvar response.organization_id em TEST_ORG_ID para o job
  → (opcional) POST /v1/test/seed

testes:
  login na SPA com E2E_TEST_OWNER_EMAIL / PASSWORD
  selecionar org TEST_ORG_ID

afterAll:
  mesmo POST reset com TEST_ORG_ID + ensure_fixtures: true
```

### 11.3 Exemplo de chamada (Node / Playwright globalSetup)

```typescript
const base = process.env.VITE_API_BASE_URL!.replace(/\/$/, '');
const secret = process.env.TEST_RESET_SECRET!;
const res = await fetch(`${base}/v1/test/reset-organization`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Test-Reset-Token': secret,
  },
  body: JSON.stringify({
    ensure_fixtures: true,
    ...(process.env.TEST_ORG_ID ? { organization_id: process.env.TEST_ORG_ID } : {}),
  }),
});
if (!res.ok) throw new Error(`reset-organization failed: ${res.status} ${await res.text()}`);
const data = await res.json();
// persistir data.organization_id para os testes
```

### 11.4 O que **não** fazer

- Não chamar este endpoint da SPA em build de produção.
- Não commitar `TEST_RESET_SECRET`.
- Não apontar `TEST_ORG_ID` para org de cliente real.

---

## 12. Checklist backend

- [ ] Rota registrada **apenas** em development / test / staging.
- [ ] Validação de `X-Test-Reset-Token`.
- [ ] Padrão de `ensure_fixtures` documentado no OpenAPI (recomendado: omitido = `true` **nesta rota apenas**).
- [ ] Matriz §5 coberta por testes automatizados.
- [ ] Transação ou compensação em caso de falha parcial.
- [ ] Resposta inclui `provisioned` e `deleted` consistentes.
- [ ] Entrada em [**FRONTEND_API_GUIDE.md**](../../fincla-api/docs/FRONTEND_API_GUIDE.md) (**fincla-api**, seção ferramentas de teste).
- [ ] Produção: sem rota, sem `TEST_RESET_SECRET` no deploy.

---

## 13. Ambiguidades resolvidas (FAQ)

| Dúvida | Resposta |
|--------|----------|
| Precisa de JWT? | **Não**, por padrão; só o header secreto + ambiente. |
| UUID inexistente com `ensure_fixtures: true`? | **Criar** org de teste e retornar o novo `organization_id`, depois reset. |
| Org de produção por engano? | **403**. |
| Senha do usuário técnico na resposta? | **Nunca**; CI e servidor usam as mesmas env vars. |
| `deleted` pode ser tudo zero? | Sim, após primeiro reset ou org nova. |
