# Secrets — Dataverse SWA Dashboard

> **Rule: never commit secrets.** `.env`, `api/local.settings.json`, `*.pem` are `.gitignore`d. CI scans `dist/` for leakage.

## Secrets inventory

| Secret / var | Where it lives | Owner | Rotation |
|---|---|---|---|
| `DATAVERSE_CLIENT_SECRET` (or cert) | SWA App Settings / Key Vault | Entra app registration | 90 days or on leak |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | GitHub Actions secret | SWA deployment token | On demand (rotate via `az staticwebapp secrets list` + reset) |
| `DATAVERSE_TENANT_ID`, `DATAVERSE_CLIENT_ID` | App Settings (non-secret GUIDs) | Entra app registration | Stable |
| Entra app registration secret/cert | Entra Portal → Certificates & secrets | Tenant admin | Per org policy |

`DATAVERSE_*` are **server-only** (Functions). Frontend never sees them.

## Initial setup

See `infra/README.md` → Entra app registration (least-privilege read-only role) and `docs/DEPLOYMENT.md` → App Settings.

```bash
# Plain (acceptable for small tenants)
az staticwebapp appsettings set -n <swa> -g <rg> \
  --setting-names DATAVERSE_CLIENT_SECRET=<value>

# Recommended (prod): Key Vault reference
az keyvault secret set --vault-name <vault> -n dv-client-secret --value <value>
az staticwebapp appsettings set -n <swa> -g <rg> \
  --setting-names DATAVERSE_CLIENT_SECRET=@Microsoft.KeyVault\(SecretUri=https://<vault>.vault.azure.net/secrets/dv-client-secret/\)
# Grant SWA managed identity access to the vault (Portal → Vault → Access policies).
```

Local dev needs no real secret: keep `DATAVERSE_MODE=mock` and `DATAVERSE_CLIENT_SECRET=` empty.

## Rotation procedure

### 1) Dataverse client secret

1. Entra Portal → App registrations → `dv-dashboard-dataverse-readonly` → Certificates & secrets → **New client secret** (or upload new cert). Copy the new value.
2. Update the backing store:
   ```bash
   # Key Vault path
   az keyvault secret set --vault-name <vault> -n dv-client-secret --value <new-secret>
   # Or direct App Settings
   az staticwebapp appsettings set -n <swa> -g <rg> --setting-names DATAVERSE_CLIENT_SECRET=<new-secret>
   ```
3. Verify: `curl https://<swa>.azurestaticapps.net/api/health` then an authenticated `GET /api/kpis` (expect 200, not 500/401).
4. Entra Portal → delete the **old** secret only after the new one is confirmed live.
5. Notify in Kanban comment / team channel: "Dataverse client secret rotated (vault: <vault>, <date>)."

### 2) SWA deployment token (`AZURE_STATIC_WEB_APPS_API_TOKEN`)

1. Retrieve / reset:
   ```bash
   az staticwebapp secrets list -n <swa> -g <rg> --query "properties.apiKey" -o tsv   # read current
   az staticwebapp reset-token -n <swa> -g <rg>                                         # rotate (invalidates old)
   az staticwebapp secrets list -n <swa> -g <rg> --query "properties.apiKey" -o tsv   # new value
   ```
2. GitHub → Settings → Secrets and variables → Actions → edit `AZURE_STATIC_WEB_APPS_API_TOKEN` with the new value.
3. Re-run the SWA workflow to verify (push empty commit or `workflow_dispatch`).

### 3) Local dev secret (leak response)

If `.env` or `api/local.settings.json` is accidentally committed:

1. `git rm --cached api/local.settings.json .env` + commit + force-push branch (never push secrets to `main`).
2. Rotate the leaked secret in Entra / Key Vault immediately.
3. Scan history: `git log --all --oneline -- api/local.settings.json .env` and `git show <sha>:api/local.settings.json` to assess exposure.

## Key Vault hardening (prod)

- Vault in same region as SWA; firewall / private endpoint if required by policy.
- SWA managed identity → Vault **Get** on secrets only (least-privilege).
- Reference syntax: `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/<name>/<version>/)` — omit version to always get latest after rotation.
- Audit: Vault → Diagnostics / Log Analytics; alert on `SecretGet` failures.

## What NOT to do

- Do not put `DATAVERSE_CLIENT_SECRET` in `staticwebapp.config.json`, `dist/`, `azure.yaml`, or any committed JSON.
- Do not echo secrets in CI logs (`set -x` leaks). GitHub Actions redacts secrets, but avoid `echo ${{ secrets.* }}`.
- Do not share secrets in Kanban comments — use `az` / Key Vault / GitHub Secrets UI.

## Audit checklist

- [ ] `git grep -i DATAVERSE_CLIENT_SECRET` — only in `.env.example` placeholder, never a real value
- [ ] `api/local.settings.json` is gitignored and absent from `git ls-files`
- [ ] SWA App Settings shows `DATAVERSE_CLIENT_SECRET` as Key Vault reference (prod) or masked value
- [ ] CI bundle scan (`ci.yml`) passes — no secret in `dist/`
- [ ] Rotation calendar entry exists (90-day cadence)
