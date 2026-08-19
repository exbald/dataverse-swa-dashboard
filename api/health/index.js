import { handleHealth } from "../dist/handlers/health.js";
export default async function (context, req) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) headers[k.toLowerCase()] = v;
  const result = handleHealth({ headers, query: req.query || {}, method: req.method || "GET" });
  context.res = { status: result.status, headers: result.headers, body: result.body };
}
