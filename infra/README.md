# Infra — Azure Static Web App for Dataverse Dashboard

## What `infra/` contains

| File | Purpose |
|---|---|
| `main.bicep` | Declarative SWA + Log Analytics + App Insights. Parameters are safe defaults; secrets are never committed. |
| `azure.yaml` (repo root) | `azd` entrypoint — `azd up` provisions infra then deploys. Optional; you can use `az` CLI + Bicep directly. |
| `README.md` (this file) | Naming, regions, SKU, Entra app registration (least-privilege), env mapping, custom domain, and teardown. |

## Naming, regions, SKU

- **Naming:** `baseName` + `environment` + suffix. Example: `dv-dashboard-prod-swa`. Override `baseName`/`environment` at deploy time; SWA names must stay <= 40 chars and globally resolvable as `<name>.azurestaticapps.net`.
- **Region:** SWA is available in a subset of Azure regions (e.g. `westeurope`, `eastus2`, `centralus`, `westus2`, `eastasia`). `location` param defaults to `westeurope`; pick the region closest to your Dataverse tenant to reduce latency. Dataverse latency dominates — keep both in the same geography when possible.
- **SKU:**
  - `Free` — fine for mock/dev, preview envs, and low-traffic internal dashboards. Limits: bandwidth, custom domain restrictions on some older Free SKUs, no SLA. Preview environments are still available.
  - `Standard` — required for production SLA, higher bandwidth, and enterprise-grade CDN/custom domain guarantees. Switch via `skuName=Standard` param.

## Deploy — Bicep (no `azd` required)

```bash
# 1) One-time: create resource group
az group create -n rg-dv-dashboard-prod -l westeurope

# 2) Deploy infra (what-if first)
az deployment group create \
  -g rg-dv-dashboard-prod \
  -f infra/main.bicep \
  -p baseName=dv-dashboard environment=prod skuName=Free location=westeurope --what-if
az deployment group create \
  -g rg-dv-dashboard-prod \
  -f infra/main.bicep \
  -p baseName=dv-dashboard environment=prod skuName=Free location=westeurope

# 3) Read outputs
az staticwebapp show -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod --query "{hostname:defaultHostname, id:id}" -o json
```

## Deploy — `azd` (optional)

```bash
azd auth login
azd up   # provisions infra/main.bicep then deploys web service
# or step-wise:
azd provision
azd deploy
```

`azd` reads `azure.yaml` at repo root (`appLocation=/`, `apiLocation=api`, `outputLocation=dist`).

## SWA deployment token (CI)

SWA GitHub Actions deploy uses `azure_static_web_apps_api_token` (the SWA deployment token). Retrieval:

```bash
az staticwebapp secrets list -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod --query "properties.apiKey" -o tsv
```

Add as GitHub secret: repo → Settings → Secrets and variables → Actions → **New repository secret** → name `AZURE_STATIC_WEB_APPS_API_TOKEN` (or `azure_static_web_apps_api_token` — match the workflow env). The repo's workflow at `.github/workflows/azure-static-web-apps.yml` consumes it. **Never commit the token.**

For `azd` pipelines, `azd pipeline config` wires OIDC / token automatically.

## Env var mapping

| Bicep / SWA App Setting | Local (`api/local.settings.json`) | Purpose |
|---|---|---|
| `DATAVERSE_MODE` | `Values.DATAVERSE_MODE` | `mock` (default) or `live` |
| `DATAVERSE_URL` | `Values.DATAVERSE_URL` | e.g. `https://your-org.crm.dynamics.com` |
| `DATAVERSE_TENANT_ID` | `Values.DATAVERSE_TENANT_ID` | Entra tenant GUID |
| `DATAVERSE_CLIENT_ID` | `Values.DATAVERSE_CLIENT_ID` | App registration client ID |
| `DATAVERSE_CLIENT_SECRET` | `Values.DATAVERSE_CLIENT_SECRET` | **Secret — set via portal/Key Vault, not Bicep** |
| `ENTRA_ALLOWED_TENANT_IDS` | `Values.ENTRA_ALLOWED_TENANT_IDS` | Comma-separated tenant allowlist; empty = lenient (dev) |
| `API_CACHE_TTL` | `Values.API_CACHE_TTL` | Seconds, default 60 |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights (auto-set by Bicep) |

After Bicep deploy, set secrets:

```bash
az staticwebapp appsettings set \
  -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod \
  --setting-names DATAVERSE_MODE=live \
                  DATAVERSE_URL=https://your-org.crm.dynamics.com \
                  DATAVERSE_TENANT_ID=<guid> \
                  DATAVERSE_CLIENT_ID=<guid> \
                  DATAVERSE_CLIENT_SECRET=<secret>
# Or use Key Vault reference (recommended for prod):
# DATAVERSE_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/dv-client-secret/)
```

Validate locally with `api/local.settings.json` (copy from `api/local.settings.json.sample` — file is `.gitignore`d).

## Entra app registration (least-privilege) — manual steps

SWA Easy Auth handles **user** sign-in (`/.auth/login/aad`). The Dataverse **server-to-server** call uses a separate confidential client. Create it once per tenant:

1. **Azure Portal → Entra ID → App registrations → New registration**
   - Name: `dv-dashboard-dataverse-readonly`
   - Supported account types: **Single tenant** (your tenant).
   - Redirect URI: none needed for client credentials; if you later add on-behalf-of, add `https://<swa>.azurestaticapps.net/.auth/login/aad/callback`.
2. **Certificates & secrets → New client secret** (or upload certificate). Copy the value immediately — you won't see it again. Prefer certificate in production.
3. **API permissions → Add → Dynamics CRM → Delegated or Application**
   - For client credentials (service principal): `https://<org>.crm.dynamics.com/user_impersonation` or tenant-wide scope `https://<org>.crm.dynamics.com/.default`. Admin consent required.
   - Alternatively, grant via **Power Platform Admin Center → Environments → [env] → Settings → Users + permissions → Application users → New app user** — link the app ID and assign a **security role**.
4. **Least-privilege Dataverse role:** Create or clone a role scoped to **Read** only on the approved tables (e.g. `account`, `contact`, `opportunity` or the real entities). No Create/Write/Delete/Append unless explicitly required. Assign to the Application User (previous step).
5. **Expose `DATAVERSE_*` env vars** as above. Do **not** put them in `staticwebapp.config.json` or the frontend bundle — server-only.

Sovereign clouds: replace `crm.dynamics.com` with the cloud-specific domain (`crm4.dynamics.com`, `crm.dynamics.cn`, etc.) and adjust `DATAVERSE_URL` accordingly.

## Custom domain

In Azure Portal → Static Web App → **Custom domains** → Add → Enter `dashboard.example.com` → validate via DNS CNAME/TXT (`<swa>.azurestaticapps.net`). Alternatively via CLI:

```bash
az staticwebapp hostname set -n dv-dashboard-prod-swa -g rg-dv-dashboard-prod --hostname dashboard.example.com
```

After validation, update `docs/DEPLOYMENT.md` and any hardcoded origin references. TLS is auto-provisioned by SWA.

## Logs & health

- Health: `GET /api/health` → `{ status:"ok", version, mode, timestamp }` (see `docs/OPERATIONS.md`).
- Logs: Portal → Static Web App → **Functions** → Logs / Application Insights (if enabled). Local: `swa start` / `func start` output.
- App Insights: Bicep provisions it and wires `APPLICATIONINSIGHTS_CONNECTION_STRING`; remove the resource block if you prefer SWA-only diagnostics.

## Preview / teardown

Per brief Q6, do **not** create public previews without human approval.

```bash
# Preview (only when approved) — staging env isolates from prod
az staticwebapp create -n dv-dashboard-preview --sku Free -g rg-dv-dashboard-prod \
  --source https://github.com/exbald/dataverse-swa-dashboard --branch feat/dataverse-swa-dashboard \
  --app-location "/" --api-location "api" --output-location "dist"

# Teardown preview when QA completes
az staticwebapp delete -n dv-dashboard-preview -g rg-dv-dashboard-prod --yes
# or via Portal → Static Web App → Delete
```

For ephemeral mock QA, the same commands apply — keep `DATAVERSE_MODE=mock` so no tenant creds are needed.
