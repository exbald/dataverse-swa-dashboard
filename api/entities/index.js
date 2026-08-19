import { handleEntities } from "../dist/handlers/entities.js";
export default async function (context, req) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) headers[k.toLowerCase()] = v;
  const result = await handleEntities({
    headers,
    query: req.query || {},
    params: req.params || {},
    method: req.method || "GET",
  });
  context.res = { status: result.status, headers: result.headers, body: result.body };
}
