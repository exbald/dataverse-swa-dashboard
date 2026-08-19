import { handleKpis } from "../dist/handlers/kpis.js";
export default async function (context, req) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) headers[k.toLowerCase()] = v;
  const result = await handleKpis({ headers, query: req.query || {}, method: req.method || "GET" });
  context.res = { status: result.status, headers: result.headers, body: result.body };
}
