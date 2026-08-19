# Deployment — Dataverse SWA Dashboard

## Prerequisites

- Azure subscription + resource group (e.g. `rg-dv-dashboard-prod`, `westeurope`).
- Entra tenant + Dataverse environment URL (or `DATAVERSE_MODE=mock` for local/mock deploy).
- GitHub repo `exbald/dataverse-swa-dashboard` (or your fork) with `feat/dataverse-swa-dashboard` branch.
- `az` CLI (≥ 2.55) for Bicep deploys; `azd` optional; no `az login` required for local validation.

## Option A — Bicep (recommended, no `azd`)

```bash
# 1) Resource group
az group create -n rg-dv-dashboard-prod -l westeurope

# 2) What-if, then deploy
az deployment group create -g rg-dv-dashboard-prod -f infra/main.bicep \
  -p baseName=dv-dashboard environment=prod skuName=Free location=westeurope --what-if
az deployment group create -g rg-dv-dashboard-prod -f infra/main.bicep \
  -p baseName=dv-dashboard environment=prod skuName=Free location=westeurope

# 3) Outputs
az staticwebapp show -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod \
  --query "{hostname:defaultHostname, id:id}" -o json
```

## Option B — `azd`

```bash
azd auth login
azd up                # provision + deploy
# or step-wise: azd provision && azd deploy
# template wiring: azure.yaml (app_location=/, api_location=api, output_location=dist)
```

## Configure App Settings (secrets)

Bicep sets safe placeholders; set real values after deploy:

```bash
# Mock preview (no tenant needed)
az staticwebapp appsettings set -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod \
  --setting-names DATAVERSE_MODE=mock

# Live (requires Entra app registration — see infra/README.md)
az staticwebapp appsettings set -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod \
  --setting-names DATAVERSE_MODE=live \
                  DATAVERSE_URL=https://your-org.crm.dynamics.com \
                  DATAVERSE_TENANT_ID=<guid> \
                  DATAVERSE_CLIENT_ID=<guid> \
                  DATAVERSE_CLIENT_SECRET=<secret>
# Prod recommendation: Key Vault reference
# DATAVERSE_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/dv-client-secret/)
```

## GitHub Actions — SWA deploy token

The workflow `.github/workflows/azure-static-web-apps.yml` uses `AZURE_STATIC_WEB_APPS_API_TOKEN`.

```bash
# Retrieve token
az staticwebapp secrets list -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod \
  --query "properties.apiKey" -o tsv
```

Add to GitHub: **Settings → Secrets and variables → Actions → New repository secret** → name `AZURE_STATIC_WEB_APPS_API_TOKEN` (the workflow expects this; alias `azure_static_web_apps_api_token` also documented). Never commit the token.

Trigger: push to `main` deploys production; PRs open → preview env; PR closed → preview teardown (see `azure-static-web-apps.yml` `close_pull_request_job`).

## Local dev (no Azure needed)

```bash
# 1) Env
cp .env.example .env
cp api/local.settings.json.sample api/local.settings.json
# leave DATAVERSE_MODE=mock (no creds needed)

# 2) Install + build
npm --prefix api ci && npm --prefix api run build   # if frontend exists: npm ci && npm run build
npm --prefix api test

# 3) Run
# Option 1: SWA CLI (serves dist + api together)
npm i -g @azure/static-web-apps-cli
swa start dist --api-location api       # or: swa start http://localhost:5173 --api-location http://localhost:7071
# Option 2: Functions host alone
npm --prefix api start                  # func start on :7071, hit http://localhost:7071/api/health
# Option 3: Vite + func separately (when frontend lands)
# npm run dev  (vite on :5173, proxies /api → :7071)  +  npm --prefix api start
```

Health: `GET /api/health` → `{ status:"ok", version, mode, timestamp }`.

## Custom domain

```bash
az staticwebapp hostname set -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod --hostname dashboard.example.com
# Validate DNS: CNAME dashboard → <swa>.azurestaticapps.net (or TXT as shown in Portal → Custom domains).
```

TLS is auto-provisioned after validation. See `infra/README.md` for details.

## Preview environments

Per brief Q6, public previews require human approval.

```bash
# Create isolated preview (only when approved)
az staticwebapp create -n dv-dashboard-preview -g rg-dv-dashboard-prod --sku Free \
  --source https://github.com/exbald/dataverse-swa-dashboard --branch feat/dataverse-swa-dashboard \
  --app-location "/" --api-location "api" --output-location "dist"
# Teardown
az staticwebapp delete -n dv-dashboard-preview -g rg-dv-dashboard-prod --yes
```

Keep `DATAVERSE_MODE=mock` on previews so no tenant creds are exposed.

## What CI checks before deploy

- `ci.yml` validates `staticwebapp.config.json` / `api/host.json` / `api/local.settings.json.sample` parse, then runs typecheck + test + build for root + `api/`, and scans `dist/` for secret leakage. All on PR.
- `azure-static-web-apps.yml` deploys on push to `main` (and PR previews). Both workflows pin Node 20.

## Rollback

- **SWA:** Portal → Static Web App → Deployments → revert to previous commit, or `git revert` + push to `main`.
- **App Settings / infra:** `az deployment group create` is idempotent; re-run with prior param values, or `az staticwebapp appsettings set` to revert a single setting.
