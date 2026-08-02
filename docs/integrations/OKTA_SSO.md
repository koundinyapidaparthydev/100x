# Okta sign-in (OIDC)

> Prefer the full multi-provider guide: [FEDERATED_SSO.md](./FEDERATED_SSO.md) (Okta, Entra, Google Workspace, Google, Apple).

AplifyAI supports **Okta Authorization Code + PKCE** for workspace owner / team member sign-in.

## Flow

1. Web: **Continue with Okta** → `GET /api/v1/auth/okta/start?intent=login|signup`
2. Backend redirects to Okta authorize URL (state + PKCE stored server-side)
3. Okta redirects to `OKTA_REDIRECT_URI` → `GET /api/v1/auth/okta/callback`
4. Backend verifies `id_token` (JWKS / RS256), mints an AplifyAI session, redirects to  
   `{WEB_APP_ORIGIN}/auth/callback?exchange=…&intent=…`
5. Web exchanges the one-time code via `POST /api/v1/auth/okta/exchange` and stores the session

## Configure (local)

1. In Okta Admin: **Applications → Create App Integration → OIDC → Web Application**
2. Grant types: **Authorization Code** (enable PKCE)
3. Sign-in redirect URI: `http://localhost:4000/api/v1/auth/okta/callback`
4. Assign users/groups to the app
5. Copy into `backend/.env` (see `backend/.env.example`):

```bash
OKTA_ISSUER=https://YOUR_ORG.okta.com/oauth2/default
OKTA_CLIENT_ID=...
OKTA_CLIENT_SECRET=...
OKTA_REDIRECT_URI=http://localhost:4000/api/v1/auth/okta/callback
WEB_APP_ORIGIN=http://localhost:3000
OKTA_DEFAULT_ROLE=manager
# Optional:
# OKTA_GROUP_ROLE_MAP={"AplifyAI-Owners":"root","AplifyAI-Leads":"manager","AplifyAI-Contributors":"engineer"}
```

6. Restart the backend. `GET /api/v1/auth/okta/status` should return `"enabled": true`.

## Role mapping

| Source | Behavior |
|--------|----------|
| `OKTA_GROUP_ROLE_MAP` | First matching Okta `groups` claim wins |
| Claim `aplifyai_role` | If present and valid, overrides |
| Signup intent | If no group map configured, defaults to **root** (org owner; must complete onboarding) |
| Otherwise | `OKTA_DEFAULT_ROLE` (default `manager`) |

Add the **groups** claim to the Okta authorization server ID token if you use group mapping.

## Without Okta env

The button shows **Continue with Okta — not configured**. Demo workspace owner / team member sign-in still works.
