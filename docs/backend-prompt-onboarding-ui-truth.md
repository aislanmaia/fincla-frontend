# Prompt de Backend — Tornar Verdadeiras as Promessas da UI

> Objetivo: implementar no backend apenas os pontos necessários para que as promessas já feitas pela UI do Fincla sejam verdadeiras no produto.
>
> Escopo principal: `Onboarding`, `Login > Esqueci minha senha`, `Configurações > Membros` e `ordem/prioridade de categorias`.
>
> Contexto: o frontend já foi ajustado para confiar em `onboarding_completed` como fonte de verdade e já persiste organização, categorias, receita recorrente e cartão quando a API suporta isso.

---

## Resumo executivo

Hoje existem 4 gaps principais entre o que a UI promete e o que o backend efetivamente suporta:

1. A UI promete **convite de membros por e-mail**, mas o backend só expõe `POST /v1/users/register/member`, que exige senha no momento do cadastro.
2. A UI promete **recuperação de senha por link**, mas não há endpoints para esse fluxo.
3. A UI promete que as **categorias escolhidas no onboarding aparecem primeiro** ao lançar transações, mas a API não expõe preferência/ordem/prioridade dessas categorias.
4. O contrato de **`org_type`** precisa ser estabilizado para refletir os valores usados pela UI de onboarding.

---

## O que o frontend já faz hoje

O frontend já está pronto para:

- usar `GET /v1/users/me` como fonte de verdade para `onboarding_completed`;
- exigir onboarding quando `onboarding_completed !== true`;
- persistir:
  - criação da organização;
  - `onboarding_completed = true`;
  - categorias selecionadas como tags;
  - primeira receita recorrente;
  - primeiro cartão;
- bloquear a conclusão do onboarding se o usuário preencher `membros`, porque hoje a UI promete convite real, mas a API ainda não suporta esse fluxo corretamente.

Ou seja: o principal bloqueio funcional restante no onboarding é **membros**.

---

## Requisitos de backend

### 1. Convites de membros por e-mail

### Problema atual

A UI promete:

- "Convide membros para lançar transações juntos"
- "Os convidados receberão um e-mail com link de acesso"
- gerenciamento posterior em `Configurações > Membros`

Hoje isso não é verdadeiro, porque o backend só possui:

- `POST /v1/users/register/member`

Esse endpoint exige:

- `email`
- `password`
- `organization_id`

Isso não serve para fluxo de convite via onboarding.

### O backend precisa implementar

#### `POST /v1/organizations/{organization_id}/invitations`

Cria um convite para um ou mais e-mails.

**Auth:** Bearer + owner da organização

**Body sugerido:**

```json
{
  "emails": [
    "pessoa1@exemplo.com",
    "pessoa2@exemplo.com"
  ]
}
```

**Resposta sugerida:**

```json
{
  "invitations": [
    {
      "id": "uuid",
      "email": "pessoa1@exemplo.com",
      "organization_id": "uuid",
      "status": "pending",
      "expires_at": "2026-03-31T23:59:59Z",
      "created_at": "2026-03-24T12:00:00Z"
    }
  ]
}
```

#### Requisitos de negócio

- gerar token seguro por convite;
- enviar e-mail com link de acesso;
- impedir convite duplicado pendente para o mesmo e-mail e organização;
- se o usuário já existir, o convite ainda deve funcionar;
- `owner` pode reenviar e cancelar;
- convites expiram.

#### Endpoints complementares recomendados

##### `GET /v1/organizations/{organization_id}/invitations`

Lista convites pendentes/aceitos/expirados.

##### `POST /v1/organizations/{organization_id}/invitations/{invitation_id}/resend`

Reenvia convite.

##### `DELETE /v1/organizations/{organization_id}/invitations/{invitation_id}`

Cancela convite.

##### `POST /v1/invitations/accept`

Aceita convite por token.

**Body sugerido:**

```json
{
  "token": "token-do-convite",
  "first_name": "Ana",
  "last_name": "Souza",
  "password": "senha-escolhida-pelo-usuario"
}
```

### Critério de aceite

- o frontend pode enviar apenas os e-mails coletados no onboarding;
- o backend envia convite real;
- o membro aparece corretamente depois em `Configurações > Membros`;
- convites pendentes podem ser listados, reenviados e cancelados.

---

### 2. Recuperação de senha por link

### Problema atual

A UI de login promete:

- `Esqueci minha senha`
- `Enviar link de recuperação`
- `Enviamos um link de recuperação para...`

Mas hoje não há endpoints suportando esse fluxo.

### O backend precisa implementar

#### `POST /v1/auth/forgot-password`

Solicita envio do link de redefinição.

**Body:**

```json
{
  "email": "demo@financeiro.app"
}
```

**Resposta sugerida:**

```json
{
  "message": "Se o e-mail existir, enviaremos um link de recuperação."
}
```

#### `POST /v1/auth/reset-password`

Redefine a senha usando token.

**Body:**

```json
{
  "token": "token-de-recuperacao",
  "new_password": "@NovaSenha123"
}
```

**Resposta sugerida:**

```json
{
  "message": "Senha redefinida com sucesso."
}
```

### Regras de negócio

- não vazar se o e-mail existe ou não;
- token com expiração;
- token de uso único;
- invalidar tokens anteriores quando necessário.

### Critério de aceite

- a promessa visual da tela de recuperação passa a ser real;
- o frontend consegue trocar o mock local por chamadas reais sem mudar a UI.

---

### 3. Prioridade/ordem das categorias escolhidas no onboarding

### Problema atual

A UI promete:

- "As categorias selecionadas aparecem primeiro ao lançar transações"

Hoje o frontend consegue criar as tags/categorias, mas a API não traz qualquer noção de:

- prioridade;
- ordem;
- favoritas;
- categorias destacadas do onboarding.

Na prática, o frontend acaba tendo que ordenar localmente.

### O backend precisa implementar

Escolher uma das duas abordagens abaixo.

#### Opção recomendada: metadado na própria tag da organização

Adicionar campos como:

- `sort_order: integer | null`
- `is_onboarding_highlight: boolean`

E permitir atualização disso via tags.

#### Alternativa: preferências por organização

Criar recurso específico de preferências:

##### `PATCH /v1/organizations/{organization_id}/preferences/categories`

**Body sugerido:**

```json
{
  "priority_tag_ids": [
    "uuid-moradia",
    "uuid-alimentacao",
    "uuid-transporte"
  ]
}
```

### Requisito funcional

Ao listar categorias/tags para lançamento de transação, a API deve devolver a ordem já priorizada.

### Critério de aceite

- as categorias escolhidas no onboarding aparecem primeiro na UI de lançamento;
- essa prioridade persiste entre sessões e dispositivos;
- o frontend não precisa inventar ordenação própria para simular a promessa da UI.

---

### 4. Contrato estável de `org_type`

### Problema atual

A UI de onboarding usa hoje valores como:

- `casal`
- `negocio`
- `outro`
- e em alguns pontos do shell ainda existe `familia` como fallback

Já a documentação backend usa exemplos como:

- `personal`
- `couple`
- `family`
- `business`

Sem um contrato estável, a UI e a API podem divergir semanticamente.

### O backend precisa fazer

Definir oficialmente um contrato e mantê-lo em todos os endpoints relevantes:

- `POST /v1/organizations`
- `PATCH /v1/organizations/{id}`
- `GET /v1/organizations/{id}`
- `GET /v1/memberships/my-organizations`

### Recomendação

Padronizar internamente e externamente em um único enum. Exemplo:

```json
["family", "couple", "business", "other"]
```

Se quiser manter compatibilidade com os ids atuais do frontend, também é aceitável suportar mapeamento explícito no backend, desde que a resposta seja consistente e documentada.

### Critério de aceite

- o tipo enviado no onboarding é persistido sem ambiguidade;
- o tipo retornado pelo backend é consistente em todos os endpoints;
- não existe necessidade de fallback semântico frágil no frontend.

---

## Ajustes recomendados de consistência

### 5. Paridade entre `GET /v1/users/me` e `GET /v1/auth/me`

O frontend hoje usa `GET /v1/users/me` para o bootstrap de sessão.

Ainda assim, o ideal é que ambos retornem os mesmos campos relevantes do usuário, especialmente:

- `id`
- `email`
- `role`
- `first_name`
- `last_name`
- `onboarding_completed`

### Critério de aceite

- não há divergência de contrato entre `/users/me` e `/auth/me` para o estado básico da sessão.

---

## Ordem de implementação sugerida

1. Convites de membros
2. Recuperação de senha
3. Prioridade/ordem de categorias
4. Estabilização do contrato de `org_type`
5. Paridade entre `/users/me` e `/auth/me`

---

## O que não precisa mudar no frontend

Para este escopo, o agente/backend **não deve pedir redesign da UI**.

As telas já existem e as promessas já estão definidas visualmente. O backend deve se adaptar a elas, principalmente em:

- convite de membros;
- recuperação de senha;
- prioridade de categorias;
- consistência de `org_type`.

---

## Definição de pronto

Considere este pacote concluído quando:

1. O onboarding puder convidar membros de verdade por e-mail.
2. `Configurações > Membros` puder refletir membros ativos e convites pendentes.
3. `Esqueci minha senha` corresponder a um fluxo real de recuperação.
4. As categorias escolhidas no onboarding realmente aparecerem primeiro ao lançar transações.
5. `org_type` estiver estável e consistente em todos os endpoints.
6. `/users/me` e `/auth/me` retornarem contrato coerente para estado de sessão.

---

## Observação final para o agente de backend

Se for necessário escolher entre:

- adaptar o backend à promessa já feita pela UI;
- ou exigir alteração da UI,

priorize **adaptar o backend**.

Essa tarefa existe justamente para tornar verdadeiras as promessas que o usuário já vê no produto.
