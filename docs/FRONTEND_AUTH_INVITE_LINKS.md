# Compliance frontend — links de e-mail (SPA)

**Público:** backend (e quem configura templates de e-mail).

**Objetivo:** este arquivo existe **somente** para o backend saber **o que implementar nos links dos e-mails** para ficar em **compliance com o frontend** (Fincla SPA). Não descreve a API em si.

**Onde documentar o restante**

| O quê | Onde |
|--------|------|
| Endpoints, retornos, parâmetros, erros, payloads, evoluções da API | **`docs/FRONTEND_API_GUIDE.md`** — **sempre**. Toda mudança que o backend fizer na API deve ir para esse guia. |
| Formato da **URL** do botão/link no e-mail (query/hash) que o SPA lê antes de chamar a API | **Este arquivo** (`FRONTEND_AUTH_INVITE_LINKS.md`) — repasse ao backend só para esse fim. |

O frontend implementa a leitura dessas URLs em `src/ui/features/auth/authEntryUrl.js`.

---

## Regras para os `href` dos e-mails

Os links devem apontar para a **origem do app** (onde o SPA é servido), **não** para a API REST.

### Recuperação de senha

Após o clique, o SPA abre a tela de nova senha e o cliente chama `POST /v1/auth/reset-password` (contrato no `FRONTEND_API_GUIDE.md`).

**URLs aceitas pelo SPA:**

| Parâmetros | Exemplo |
|------------|---------|
| `reset_token` | `https://app.exemplo.com/?reset_token=<token>` |
| `action` + `token` | `https://app.exemplo.com/?action=reset_password&token=<token>` |

- Query **depois do `#`** também é lida (ex.: `#/login?reset_token=…`).
- Se o mesmo parâmetro existir na query principal e na hash, **prevalece a query principal**.
- O SPA **não** trata `?token=` sozinho como reset (evita conflito com convite).

### Convite para organização

Após o clique, o SPA abre a tela de senha (nome opcional) e o cliente chama `POST /v1/invitations/accept` (contrato no `FRONTEND_API_GUIDE.md`).

**URLs aceitas:**

| Parâmetros | Exemplo |
|------------|---------|
| `invite_token` | `?invite_token=<token>` |
| `invitation_token` | `?invitation_token=<token>` |
| `action` + `token` | `?action=accept_invite&token=<token>` |

Mesmas regras de hash e precedência que no reset.

### Prioridade

Se a URL indicar **convite** (`invite_token`, `invitation_token` ou `action=accept_invite`), esse fluxo tem prioridade sobre o de reset.

---

## Checklist (compliance com o frontend)

- [ ] E-mail de **esqueci minha senha** usa um dos formatos de reset acima.
- [ ] E-mail de **convite** usa um dos formatos de convite acima (evitar só `?token=` sem `action` se isso colidir com outro fluxo).
- [ ] Base URL do front correta por ambiente (staging/prod).
- [ ] Qualquer mudança nos **endpoints** ou **contratos** continua documentada **apenas** no `FRONTEND_API_GUIDE.md`, não neste arquivo.
