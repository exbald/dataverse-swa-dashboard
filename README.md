# dataverse-swa-dashboard

Azure Static Web App dashboard for Microsoft Dataverse (SWA + Entra ID).

- **Stack:** Vite + React + TypeScript (SWA `app_location:/`, `output_location:dist`) + SWA Managed Functions (`api/`, Node 20).
- **Auth:** SWA Easy Auth (`/.auth/login/aad`) + `x-ms-client-principal` validated server-side; least-privilege Dataverse app registration.
- **Data:** Typed contracts + `DataverseService` with mock/live factory (`DATAVERSE_MODE=mock|live`). Placeholder entities `accounts/contacts/opportunities` until real schema is supplied.

## Docs index

| Doc | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | Target architecture, components, security, config, deployment overview |
| `docs/DEPLOYMENT.md` | Provisioning (Bicep & `azd`), App Settings, SWA token, local dev, custom domain, previews |
| `docs/SECRETS.md` | Secrets inventory, rotation (Dataverse secret, SWA token, leak response), Key Vault |
| `docs/TROUBLESHOOTING.md` | Auth, `host.json`, 500/429, build, deploy token, CORS, App Insights |
| `docs/OPERATIONS.md` | Health, logs, polling/caching, scaling, on-call runbook, post-deploy checklist |
| `infra/README.md` | Infra deep-dive: naming, regions, SKU, Entra app registration steps, env mapping, domain/teardown |

## Quick start

```bash
cp .env.example .env
cp api/local.settings.json.sample api/local.settings.json
# DATAVERSE_MODE=mock by default — no creds needed

# API (requires Node 20)
npm --prefix api ci
npm --prefix api test
npm --prefix api run build

# When frontend lands:
# npm ci && npm run build
```

**Local run (mock, no Azure):**

```bash
# SWA CLI (serves dist + api together) — recommended
npm i -g @azure/static-web-apps-cli
swa start dist --api-location api
# or: swa start http://localhost:5173 --api-location http://localhost:7071

# Functions host alone
npm --prefix api start   # http://localhost:7071/api/health
```

**Env vars:** see `.env.example` + `api/local.settings.json.sample`. All `DATAVERSE_*` are **server-only** (never in `staticwebapp.config.json` or `dist/`).

## SWA config

- `staticwebapp.config.json` at root (`navigationFallback`, `routes`, `auth.rolesSource:/api/getRoles`, `responseOverrides.401 → /.auth/login/aad`). Validated in CI.
- `api/host.json` (`routePrefix:api`).
- Infra: `infra/main.bicep` + `azure.yaml` (optional `azd`). See `infra/README.md`.

## CI/CD

- `.github/workflows/ci.yml` — lint/typecheck/test/build on PR (`staticwebapp.config.json`/`api/host.json` JSON lint + bundle secret scan).
- `.github/workflows/azure-static-web-apps.yml` — SWA deploy (`Azure/static-web-apps-deploy@v1`, `api_location:api`, `app_location:/`, `output_location:dist`, secret `AZURE_STATIC_WEB_APPS_API_TOKEN`).

## Mock vs live toggle

| Mode | `DATAVERSE_MODE` | Credentials | Behavior |
|---|---|---|---|
| Mock (default) | `mock` | none | Deterministic fixtures, auth stub (no real Entra needed) |
| Live | `live` | `DATAVERSE_URL`, `DATAVERSE_TENANT_ID`, `DATAVERSE_CLIENT_ID`, `DATAVERSE_CLIENT_SECRET` | MSAL confidential client → Dataverse Web API |

Switch via App Settings or `api/local.settings.json`. In `live` mode the API enforces `x-ms-client-principal` and optional `ENTRA_ALLOWED_TENANT_IDS`.

## Health

`GET /api/health` → `{ status:"ok", version, mode, timestamp }` (see `docs/OPERATIONS.md`).

## Preview policy

Do **not** create a public SWA preview without human approval (brief Q6). Steps are documented but not executed. If a mock preview is created for isolated QA, it must be torn down — see `infra/README.md` / `docs/DEPLOYMENT.md`.

## Security note

Never commit `api/local.settings.json` or `.env` (gitignored). Bundle scan in `ci.yml` verifies no `DATAVERSE_CLIENT_SECRET` in `dist/`.
