# dataverse-swa-dashboard — API

SWA managed API (`/api`) that fronts Microsoft Dataverse.

## Contracts

- **Pagination:** `{ data: T[], nextPageToken?: string, totalCount?: number }`
- **Error:** `{ error: { code, message, correlationId } }`
- **Entities (placeholder):** `accounts`, `contacts`, `opportunities` — each record has `id, name, status, owner, createdOn, amount?`. Replace with real Dataverse logical names when supplied.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | none | Health + mode |
| GET | `/api/kpis` | SWA principal or mock stub | KPI cards |
| GET | `/api/entities/:entity?pageSize=&pageToken=&filter=&sort=&q=` | SWA principal or mock stub | Paginated entity list |

Query params are Zod-validated. All responses include `x-correlation-id`.

## Auth

- Production: SWA Easy Auth injects `x-ms-client-principal` (base64 JSON). API validates it; rejects 401 if missing/invalid.
- Mock mode (`DATAVERSE_MODE=mock`, default): stub principal so local dev needs no SWA auth.
- Never log secrets. MSAL confidential client is server-only.

## Dataverse modes

- `DATAVERSE_MODE=mock` — deterministic fixtures, no credentials.
- `DATAVERSE_MODE=live` — Dataverse Web API via `@azure/msal-node` confidential client; requires `DATAVERSE_URL`, `DATAVERSE_TENANT_ID`, `DATAVERSE_CLIENT_ID`, `DATAVERSE_CLIENT_SECRET`. Token cached server-side, OData `$select/$filter/$top/$skiptoken`, retry on 429/5xx with backoff.

## Local dev

```bash
cd api
cp local.settings.json.sample local.settings.json  # fill in if live
npm ci
npm test
npm run build
# then: swa start ../dist --api-location api  (or func start)
```
