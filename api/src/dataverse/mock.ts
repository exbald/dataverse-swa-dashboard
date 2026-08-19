/**
 * MockDataverseService — deterministic fixtures for local dev / tests.
 * PLACEHOLDER entities: accounts, contacts, opportunities.
 * Replace with real Dataverse schema when supplied.
 */

import type { DataverseService, ListEntitiesOptions } from "./interface.js";
import type { EntityRecord, KpisResponse, PaginatedResponse, SupportedEntity } from "../contracts.js";

function seededRecords(entity: SupportedEntity, count = 50): EntityRecord[] {
  const statuses = ["active", "inactive", "pending", "won", "lost"];
  const owners = ["alice@example.com", "bob@example.com", "carol@example.com"];
  return Array.from({ length: count }, (_, i) => ({
    id: `${entity}-${String(i + 1).padStart(4, "0")}`,
    name: `${entity} ${i + 1}`,
    status: statuses[i % statuses.length]!,
    owner: owners[i % owners.length]!,
    createdOn: new Date(Date.UTC(2025, 0, 1 + (i % 28), 10, 0, 0)).toISOString(),
    amount: entity === "opportunities" ? 1000 * (i + 1) + (i % 3) * 500 : undefined,
  }));
}

const FIXTURES: Record<SupportedEntity, EntityRecord[]> = {
  accounts: seededRecords("accounts", 50),
  contacts: seededRecords("contacts", 42),
  opportunities: seededRecords("opportunities", 36),
};

function paginate(
  records: EntityRecord[],
  pageSize: number,
  pageToken?: string
): PaginatedResponse<EntityRecord> {
  const offset = pageToken ? parseInt(pageToken, 10) || 0 : 0;
  const slice = records.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  return {
    data: slice,
    nextPageToken: nextOffset < records.length ? String(nextOffset) : undefined,
    totalCount: records.length,
  };
}

export class MockDataverseService implements DataverseService {
  async listEntities(
    entity: SupportedEntity,
    options: ListEntitiesOptions
  ): Promise<PaginatedResponse<EntityRecord>> {
    let records = [...FIXTURES[entity]];

    // Search: q matches name/status/owner (case-insensitive)
    if (options.q) {
      const q = options.q.toLowerCase();
      records = records.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q)
      );
    }

    // Filter: simple "status eq 'active'" or "owner eq '...'" — placeholder parser
    if (options.filter) {
      const m = options.filter.match(/(\w+)\s+eq\s+'([^']+)'/i);
      if (m) {
        const [, field, value] = m;
        records = records.filter((r) => String((r as unknown as Record<string, unknown>)[field!]) === value);
      }
    }

    // Sort: "field asc|desc"
    if (options.sort) {
      const [field, dir = "asc"] = options.sort.split(/\s+/);
      const f = field as keyof EntityRecord;
      records.sort((a, b) => {
        const av = a[f] ?? "";
        const bv = b[f] ?? "";
        const cmp = String(av).localeCompare(String(bv));
        return dir.toLowerCase() === "desc" ? -cmp : cmp;
      });
    }

    const pageSize = options.pageSize ?? 25;
    return paginate(records, pageSize, options.pageToken);
  }

  async getChartData(entity?: string): Promise<{ breakdown: { status: string; count: number }[]; trend: { date: string; count: number; amount?: number }[] }> {
    const records = FIXTURES[(entity as SupportedEntity) ?? "accounts"] ?? FIXTURES.accounts;
    const counts = new Map<string, number>();
    for (const r of records) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    const breakdown = [...counts.entries()].map(([status, count]) => ({ status, count }));
    // Last 14 days trend from createdOn histogram (mock: derive from record dates)
    const trendMap = new Map<string, number>();
    for (const r of records) {
      const day = r.createdOn.slice(0, 10);
      trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
    }
    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({ date, count }));
    // Pad to 14 if needed
    while (trend.length < 7) {
      const last = trend[trend.length - 1]?.date ?? "2025-01-01";
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      const iso = d.toISOString().slice(0, 10);
      if (!trend.find((t) => t.date === iso)) trend.push({ date: iso, count: 0 });
      else break;
    }
    return { breakdown, trend };
  }

  async getKpis(): Promise<KpisResponse> {
    const totalAccounts = FIXTURES.accounts.length;
    const totalContacts = FIXTURES.contacts.length;
    const totalOpportunities = FIXTURES.opportunities.length;
    const totalAmount = FIXTURES.opportunities.reduce((s, r) => s + (r.amount ?? 0), 0);
    const activeCount = FIXTURES.accounts.filter((r) => r.status === "active").length;

    return {
      kpis: [
        { id: "total-accounts", label: "Total Accounts", value: totalAccounts, trend: "up", delta: 4 },
        { id: "total-contacts", label: "Total Contacts", value: totalContacts, trend: "up", delta: 2 },
        { id: "total-opportunities", label: "Opportunities", value: totalOpportunities, trend: "flat" },
        { id: "total-amount", label: "Pipeline Value", value: totalAmount, trend: "up", delta: 12 },
        { id: "active-accounts", label: "Active Accounts", value: activeCount, trend: "up", delta: 1 },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}
