# Federated sign-in (SSO + social)

AplifyAI supports **OIDC Authorization Code + PKCE** for:

| Provider | Button label | Category |
|----------|--------------|----------|
| Google | Continue with Google | Social |
| Apple | Continue with Apple | Social |
| Okta | Continue with Okta | Enterprise SSO |
| Microsoft Entra ID | Continue with Microsoft | Enterprise SSO |
| Google Workspace | Continue with Google Workspace | Enterprise SSO |

Demo email/role login still works when IdPs are not configured.

## Flow (web + mobile)

1. Client loads `GET /api/v1/auth/providers` (enable/disable each button).
2. User taps a provider → `GET /api/v1/auth/{provider}/start?intent=login|signup&surface=web|mobile`.
3. Backend redirects to the IdP authorize URL (state + PKCE stored server-side).
4. IdP redirects to `GET /api/v1/auth/{provider}/callback`.
5. Backend verifies `id_token`, issues a federated session, and redirects:
   - **Web:** `{WEB_APP_ORIGIN}/auth/callback?exchange=…&intent=…&provider=…`
   - **Mobile:** `{MOBILE_APP_ORIGIN}/callback?exchange=…&intent=…&provider=…` (default `aplifyai://auth/callback`)
6. Client exchanges once via `POST /api/v1/auth/federated/exchange` `{ exchange }` and stores the Bearer session.

Per-provider exchange routes (`POST /api/v1/auth/{provider}/exchange`) remain for compatibility.

## Shared env

```bash
WEB_APP_ORIGIN=http://localhost:3000
MOBILE_APP_ORIGIN=aplifyai://auth
AUTH_SESSION_SECRET=… # ≥32 chars
```

## Provider env

### Okta

```bash
OKTA_ISSUER=https://YOUR_ORG.okta.com/oauth2/default
OKTA_CLIENT_ID=
OKTA_CLIENT_SECRET=
OKTA_REDIRECT_URI=http://localhost:4000/api/v1/auth/okta/callback
# OKTA_DEFAULT_ROLE=manager
# OKTA_GROUP_ROLE_MAP={"AplifyAI-Owners":"founder"}
```

### Microsoft Entra ID

```bash
ENTRA_TENANT_ID=common   # or your directory tenant GUID / "organizations"
ENTRA_CLIENT_ID=
ENTRA_CLIENT_SECRET=
ENTRA_REDIRECT_URI=http://localhost:4000/api/v1/auth/entra/callback
# ENTRA_DEFAULT_ROLE=manager
# ENTRA_GROUP_ROLE_MAP={"AplifyAI-Owners":"founder"}
```

Create an **App registration** → Web redirect URI matching `ENTRA_REDIRECT_URI`. Enable ID tokens. Add optional claims `email`, `preferred_username`, and group claims if you use role maps.

### Google (Continue with Google)

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/google/callback
# GOOGLE_DEFAULT_ROLE=manager
```

Create an OAuth 2.0 **Web** client in Google Cloud Console. Add the redirect URI above.

### Google Workspace (company domain SSO)

```bash
# Can reuse GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, or set dedicated:
GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=
GOOGLE_WORKSPACE_REDIRECT_URI=http://localhost:4000/api/v1/auth/google_workspace/callback
GOOGLE_WORKSPACE_HD=yourcompany.com
# GOOGLE_WORKSPACE_DEFAULT_ROLE=manager
```

`GOOGLE_WORKSPACE_HD` adds Google’s `hd` authorize hint and rejects `id_token` claims whose `hd` does not match when present.

### Apple (Continue with Apple)

```bash
APPLE_CLIENT_ID=com.example.aplifyai.service
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/apple/callback
# APPLE_DEFAULT_ROLE=manager
```

Create a Services ID with Sign in with Apple, configure the return URL to `APPLE_REDIRECT_URI`, and create a key with Sign in with Apple enabled. The backend mints the client secret JWT (ES256) from the private key.

## Role mapping

1. First matching entry in `{PROVIDER}_GROUP_ROLE_MAP` (Okta/Entra/Workspace groups or Entra `roles`)
2. Custom claim `aplifyai_role` when present
3. Signup with empty group map → `founder`
4. Else `{PROVIDER}_DEFAULT_ROLE` (default `manager`)

User ids are namespaced: `okta:{sub}`, `entra:{sub}`, `google:{sub}`, etc.

## Status endpoint

`GET /api/v1/auth/providers` → `{ providers: FederatedProviderStatus[] }`

Each provider also exposes `GET /api/v1/auth/{provider}/status`.

## Surfaces

| Surface | Entry |
|---------|--------|
| Web login/signup | Buttons in `WorkspaceAuthForm` |
| Web callback | `/auth/callback` |
| Mobile login | Buttons on `mobile/app/login.tsx` via `expo-web-browser` |
| Mobile callback | `aplifyai://auth/callback` → `mobile/app/auth/callback.tsx` |

See also [OKTA_SSO.md](./OKTA_SSO.md) for Okta-specific Admin Console notes.
