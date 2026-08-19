import { MockDataverseService } from "./mock.js";
import { LiveDataverseService } from "./live.js";
import type { DataverseService } from "./interface.js";
import { getEnv, requireLiveEnv } from "../env.js";

export function createDataverseService(correlationId?: string): DataverseService {
  const env = getEnv();
  if (env.DATAVERSE_MODE === "live") {
    requireLiveEnv(env);
    return new LiveDataverseService({
      dataverseUrl: env.DATAVERSE_URL!,
      tenantId: env.DATAVERSE_TENANT_ID!,
      clientId: env.DATAVERSE_CLIENT_ID!,
      clientSecret: env.DATAVERSE_CLIENT_SECRET!,
      correlationId,
    });
  }
  return new MockDataverseService();
}
