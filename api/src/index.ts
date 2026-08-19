/**
 * Azure Functions entry points — one file per function for SWA managed API.
 * Each folder under api/ with function.json is a function; we also expose
 * index.ts that re-exports for local import.
 *
 * For SWA managed functions (Node 20, v4 programming model), the runtime
 * loads from api/dist. Keep function.json alongside.
 */

// Re-export for programmatic use
export { handleHealth } from "./handlers/health.js";
export { handleKpis } from "./handlers/kpis.js";
export { handleEntities } from "./handlers/entities.js";
export { createDataverseService } from "./dataverse/factory.js";
export * from "./contracts.js";
