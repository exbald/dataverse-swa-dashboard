# Architecture — Dataverse SWA Dashboard

## Overview

Azure Static Web App (SWA) + managed API boundary. Browser never calls Dataverse directly.

```
Browser (SWA static assets, Vite + React, dist/)
  │
  ├─ /.auth/login/aad ──────────── Entra ID (SWA Easy Auth)
  │         │
  │         └─ x-ms-client-principal (base64 JSON) ──> API validates per request
  │
  └─ /api/* (same-origin) ──────> SWA Managed Functions (Node 20, api/)
                                   │
                                   ├─ GET /api/health  (no auth required, for probes)
                                   ├─ GET /api/kpis
                                   ├─ GET /api/entities/:entity?pageSize=&pageToken=&filter=&sort=&q=
                                   └─ DataverseService ──┬─ MockDataverseService (DATAVERSE_MODE=mock)
                                                          └─ LiveDataverseService (DATAVERSE_MODE=live, MSAL confidential client)

LiveDataverseService ── OAuth2 client credentials ──> Entra ID ──> Dataverse Web API (OData)
   scope: https://<org>.crm.dynamics.com/.default
   token cached server-side (MSAL), never sent to browser
```

## Components

### Frontend — SWA static hosting

- **Stack:** Vite + React + TypeScript, `app_location: "/"`, `output_location: "dist"`.
- **Routing:** `staticwebapp.config.json` with `navigationFallback: { rewrite: "/index.html" }` for SPA. API routes (`/api/*`) require `authenticated` role; unauthenticated requests redirect to `/.auth/login/aad` via `responseOverrides.401`.
- **Data fetching:** Typed wrappers around `GET /api/kpis` and `GET /api/entities/:entity?...`; polling (configurable, default 60s) + manual Refresh; `staleTime`/`Cache-Control` advisory.
- **UX states:** loading skeletons, empty ("No records — adjust filters"), error (retry + `correlationId`), 401/403 (sign-in / not authorized).
- **Env:** `VITE_API_BASE=/api` (same-origin). **No** `DATAVERSE_*` in frontend env.

### API — SWA Managed Functions (`api/`)

- **Runtime:** Azure Functions v4 extension bundle, `routePrefix: "api"` (`api/host.json`).
- **Contracts:** `api/src/contracts.ts` — Zod validation, pagination `{ data, nextPageToken, totalCount }`, error `{ error: { code, message, correlationId } }`, KPIs, health.
- **Auth:** `api/src/auth.ts` — parses `x-ms-client-principal` (SWA Easy Auth header, base64 JSON). In `mock` mode returns stub principal; in `live` mode rejects unauthenticated + enforces optional `ENTRA_ALLOWED_TENANT_IDS` allowlist.
- **Env:** `api/src/env.ts` — Zod-parsed env (`DATAVERSE_MODE`, `DATAVERSE_URL`, `DATAVERSE_TENANT_ID`, `DATAVERSE_CLIENT_ID`, `DATAVERSE_CLIENT_SECRET`, `API_CACHE_TTL`). `requireLiveEnv()` throws if live mode is missing secrets.
- **Dataverse layer:** `DataverseService` interface (`api/src/dataverse/interface.ts`) + `MockDataverseService` (deterministic fixtures, `api/src/dataverse/mock.ts`) and `LiveDataverseService` (OData Web API via `@azure/msal-node`, to be completed by backend track). Factory selects by `DATAVERSE_MODE`.
- **Cross-cutting:** Correlation IDs (`api/src/correlation.ts`, `x-correlation-id` / `x-request-id` passthrough), retry with backoff on 429/5xx, Zod input validation, structured logging (never log secrets).

### Placeholder data model

Until real Dataverse schema is supplied, contracts use placeholder entities:

- `SUPPORTED_ENTITIES = ["accounts", "contacts", "opportunities"]`
- `EntityRecord { id, name, status, owner, createdOn (ISO), amount? }`
- Mock fixtures: 50 accounts / 42 contacts / 36 opportunities, seeded deterministically. Replace `seededRecords` + `FIXTURES` with real logical names/fields when schema arrives.

## Security

- **Least-privilege app registration:** Read-only on approved tables. Created via Entra Portal / Power Platform Admin Center → Application User + security role (see `infra/README.md`).
- **Secrets are server-only:** `DATAVERSE_*` lives in Functions App Settings / Key Vault references. Never in `staticwebapp.config.json`, `dist/`, or browser bundle. CI includes a bundle grep guard.
- **Browser boundary:** All Dataverse access via `/api/*`. Frontend never holds Dataverse tokens; only Entra session + API JSON.
- **Validation:** Zod on every handler input; parameterized OData `$filter` construction; no `dangerouslySetInnerHTML`.
- **Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` via `staticwebapp.config.json` `globalHeaders`.

## Configuration

- `staticwebapp.config.json` at repo root (validated by CI).
- `api/host.json` (`routePrefix: "api"`).
- `api/local.settings.json` (gitignored; copy from `api/local.settings.json.sample`).
- `.env.example` at root (documents all vars; no real secrets).

## Deployment

- **IaC:** `infra/main.bicep` (SWA + Log Analytics + App Insights) + `azure.yaml` for `azd` (optional).
- **CI:** `.github/workflows/ci.yml` (lint/typecheck/test/build + JSON lint + bundle scan on PR) and `.github/workflows/azure-static-web-apps.yml` (SWA deploy via `Azure/static-web-apps-deploy@v1`).
- **Custom domain:** SWA → Custom domains → CNAME/TXT validation; TLS auto-provisioned.

## Observability

- **Health:** `GET /api/health` → `{ status:"ok", version, mode, timestamp }`.
- **Logs:** SWA → Functions → Logs; or Application Insights (`APPLICATIONINSIGHTS_CONNECTION_STRING` wired by Bicep).
- **Tracing:** Correlation ID on every request/response; propagated to Dataverse calls.

## Related docs

- `docs/DEPLOYMENT.md` — provisioning & deploy steps
- `docs/SECRETS.md` — rotation & Key Vault
- `docs/TROUBLESHOOTING.md` — common failures
- `docs/OPERATIONS.md` — health, logs, runbook
- `infra/README.md` — infra deep-dive (naming, regions, SKU, Entra setup, custom domain)
