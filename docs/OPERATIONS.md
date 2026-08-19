# Operations — Dataverse SWA Dashboard

## Health

- **Endpoint:** `GET /api/health` — **no auth required** (use for probes, monitors, CI smoke checks).
- **Response:**
  ```json
  { "status": "ok", "version": "0.1.0", "mode": "mock|live", "timestamp": "2026-..." }
  ```
- **Probes:**
  ```bash
  curl -s https://<swa>.azurestaticapps.net/api/health | jq
  curl -s http://localhost:7071/api/health | jq   # local func host
  curl -s http://localhost:4280/api/health | jq   # swa cli proxy
  ```
- **Monitoring:** Add `/api/health` as Availability test in App Insights (ping every 5 min from 3+ locations). Alert on `status != ok` or non-200.

## Logs

### Local

- `swa start dist --api-location api` or `swa start http://localhost:5173 --api-location http://localhost:7071` — unified stdout.
- `npm --prefix api start` (`func start --port 7071`) — Functions host logs.
- Correlation ID: every request returns `x-correlation-id` header + `error.correlationId` in error bodies; grep logs by this value.

### Deployed (SWA)

- **Portal → Static Web App → Functions → Logs** (live log stream).
- **Application Insights** (provisioned by `infra/main.bicep`):
  - **Failures / Performance / Logs** blades; Kusto in Log Analytics workspace `<base>-logs`.
  - Query examples:
    ```kusto
    // Recent errors
    traces | where severityLevel >= 3 | sort by timestamp desc | take 20
    // Requests by result
    requests | summarize count() by resultCode | render barchart
    // Correlate by correlationId (if logged as custom dimension)
    traces | where customDimensions.correlationId == "<id>"
    ```
- **SWA Diagnostics** (without App Insights): Portal → Static Web App → **Deployments** / **Functions** → invocation counts and errors.

## Polling / caching

- API default `API_CACHE_TTL=60` (seconds, in-memory LRU per instance; no PII on disk). `Cache-Control` header is advisory; SWA may add its own.
- Frontend polls every 60s (configurable) + manual **Refresh** button; uses `staleTime`/SWR pattern when available.
- Tune `API_CACHE_TTL` lower for fresher data, higher for lower Dataverse load. Dataverse 429s trigger server-side retry with backoff.

## Scaling & limits

- **SWA Free:** bandwidth caps, no SLA; fine for internal dashboards with mock/dev. **Standard:** required for SLA + enterprise CDN. See `infra/README.md` for SKU guidance.
- **Cold start:** Managed Functions cold-start is brief (Node 20) but visible after idle; health probes keep warm if needed.
- **Dataverse limits:** OData paging via `$top`/`skiptoken`; respect 429 throttling headers.

## Runbook (on-call lite)

1. **Symptom:** `/api/health` non-200 → check `az staticwebapp show` / Portal → Deployments for failed release; rollback via Portal → Deployments → Promote prior.
2. **Symptom:** `/api/kpis` 500 → read `x-correlation-id` from response, search App Insights traces by that ID, check `DATAVERSE_MODE` + `DATAVERSE_*` App Settings, then `docs/TROUBLESHOOTING.md` §4.
3. **Symptom:** 401 on `/api/*` in prod → verify SWA Authentication (Entra ID) is enabled and user is in allowed tenant/role.
4. **Symptom:** No App Insights data → verify `APPLICATIONINSIGHTS_CONNECTION_STRING` in App Settings (re-apply Bicep output if rotated).

## Checklist — after each deploy

- [ ] `GET /api/health` returns `status:ok` and expected `mode`
- [ ] Authenticated `GET /api/kpis` and `GET /api/entities/accounts?pageSize=5` return 200 with paginated JSON
- [ ] No secret in browser bundle (`grep -R DATAVERSE dist/` empty — CI also checks)
- [ ] App Insights availability test green (if provisioned)
