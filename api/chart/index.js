import { handleChart } from "../dist/handlers/chart.js";
export default async function (context, req) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) headers[k.toLowerCase()] = v;
  const result = await handleChart({ headers, query: req.query || {}, method: req.method || "GET" });
  context.res = { status: result.status, headers: result.headers, body: result.body };
}
