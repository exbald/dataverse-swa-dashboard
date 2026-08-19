# Troubleshooting — Dataverse SWA Dashboard

## Diagnosing

Start with: `GET /api/health` (no auth), then authenticated `GET /api/kpis`, then browser console/network.

## Common issues

### 1) `staticwebapp.config.json` validation fails (CI or `swa start`)

- **Symptom:** CI job "Validate JSON configs" fails, or `swa` reports `Invalid staticwebapp.config.json`.
- **Fix:** Validate locally:
  ```bash
  node -e "JSON.parse(require('fs').readFileSync('staticwebapp.config.json','utf8')); console.log('OK')"
  ```
  Check: no trailing commas, `navigationFallback` and `routes` match SWA schema. Our config uses `allowedRoles:["authenticated"]` on `/api/*` and `responseOverrides.401` → `/.auth/login/aad`. Compare with `staticwebapp.config.json` in repo.

### 2) `api/host.json` errors / Functions not discovered

- **Symptom:** `/api/health` 404, or `func start` prints "No job functions found".
- **Fix:** Confirm `api/host.json` has `extensions.http.routePrefix: "api"` and `api/dist/` exists after `npm --prefix api run build`. Handlers must export a named function with `app.http(...)` (Functions v4) or `module.exports` (v3) — check `api/src/` after backend track lands.

### 3) 401 on `/api/*` (SWA Easy Auth)

- **Symptom:** `/api/kpis` returns 401, redirects to `/.auth/login/aad`.
- **Cases:**
  - **Expected in prod with auth enabled** — sign in via `/.auth/login/aad` then retry. Verify SWA → Authentication is configured for Entra ID.
  - **Unexpected locally:** Local `swa` CLI may not inject `x-ms-client-principal`; in `DATAVERSE_MODE=mock` the API returns a stub principal and should **not** 401. Check `api/src/auth.ts` mock branch: `validatePrincipal` returns `authenticated:true` when `DATAVERSE_MODE=mock` and header is absent. If you see 401 locally, ensure `DATAVERSE_MODE=mock` and restart `swa`/`func`.
  - **Tenant allowlist rejection:** If `ENTRA_ALLOWED_TENANT_IDS` is set and the principal's `tid` is not in the list, API returns 403/401 with `Tenant ... not allowed`. Clear or correct `ENTRA_ALLOWED_TENANT_IDS`.

### 4) 500 from Dataverse (live mode)

- **Symptom:** `GET /api/entities/accounts` → 500 `{ error:{ code:"DATAVERSE_ERROR", correlationId } }`.
- **Causes & fixes:**
  - **Missing env:** Check `requireLiveEnv()` — in `DATAVERSE_MODE=live`, `DATAVERSE_URL`, `DATAVERSE_TENANT_ID`, `DATAVERSE_CLIENT_ID`, `DATAVERSE_CLIENT_SECRET` are required. App Settings or `api/local.settings.json` must have them.
  - **Bad tenant/client:** 401 from Entra (MSAL) — verify app registration IDs, secret expiry (Portal → Certificates & secrets), and that admin consent was granted.
  - **Scope / role:** 403 from Dataverse — app user lacks security role on the table. Power Platform Admin → Application Users → assign Read-only role on approved tables.
  - **OData syntax:** 400 from Dataverse — `$filter`/`$select` malformed. Check API validation (Zod) and paging params. See `api/src/dataverse/live.ts` (backend track) for OData construction.
  - **429 / 5xx:** Dataverse throttling or transient failure. API retries with backoff; check `x-correlation-id` in response header and correlate with App Insights / SWA logs.

### 5) Empty / stale data

- **Symptom:** Dashboard shows "No records" or old numbers.
- **Checks:** Verify `?filter=&sort=&q=` params in network tab; test `GET /api/entities/accounts?pageSize=5` directly; check `API_CACHE_TTL` (short LRU); hard refresh vs polling interval (default 60s).

### 6) Build / typecheck failures

- **Symptom:** `npm run build` or `npx tsc --noEmit` fails in CI or locally.
- **Fix:** `npm --prefix api ci && npm --prefix api run typecheck`, `npm ci && npm run typecheck` (when frontend lands). Common: missing `@types/node`, `module: NodeNext` mismatch — see `api/tsconfig.json`.

### 7) SWA deployment fails (`Azure/static-web-apps-deploy@v1`)

- **Symptom:** Workflow `azure-static-web-apps.yml` fails with `Invalid token` or `Deployment failed`.
- **Fix:**
  ```bash
  az staticwebapp secrets list -n <swa> -g <rg> --query "properties.apiKey" -o tsv
  # reset if needed: az staticwebapp reset-token -n <swa> -g <rg>
  ```
  Update GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN` with the fresh value. Confirm workflow `app_location`, `api_location`, `output_location` match repo (`/`, `api`, `dist`).

### 8) CORS / mixed content

- **Symptom:** Browser console shows CORS error calling `/api/*`.
- **Fix:** Frontend must use **same-origin** `VITE_API_BASE=/api` (no `https://<org>.crm.dynamics.com` in browser). Dataverse is called server-side only. `staticwebapp.config.json` handles `/api` proxy; do not add wildcard CORS.

### 9) App Insights not receiving data

- **Symptom:** No telemetry after Bicep deploy.
- **Fix:** Confirm `APPLICATIONINSIGHTS_CONNECTION_STRING` in SWA App Settings (set by Bicep output). Check Log Analytics workspace exists (`<base>-logs`). Remove `samplingSettings.isEnabled` override if you need full ingestion during debugging.

## Gathering evidence

- **Correlation ID:** Every API response includes `x-correlation-id` header and `error.correlationId` body — include in bug reports.
- **Logs:** Local: `swa start` / `func start` stdout. Deployed: Portal → Static Web App → Functions → Logs / App Insights → Failures / Logs (Log Analytics).
- **Config dump (safe):** `node -e "console.log(JSON.parse(require('fs').readFileSync('staticwebapp.config.json','utf8')))"` — never log secrets.

## Still stuck?

Open a task comment with: failing endpoint + HTTP status + `correlationId` + `DATAVERSE_MODE` + `swa` vs deployed + relevant log snippet (redact secrets).
