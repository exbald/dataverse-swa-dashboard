import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KpiGrid } from "../components/KpiGrid";
import { FilterBar } from "../components/FilterBar";
import { DataTable } from "../components/DataTable";

describe("KpiGrid", () => {
  it("renders skeletons while loading with no data", () => {
    render(<KpiGrid kpis={null} loading={true} error={null} />);
    const grid = screen.getByLabelText("Key metrics");
    expect(grid).toBeInTheDocument();
  });

  it("renders KPI cards", () => {
    const kpis = [
      { id: "total", label: "Total Records", value: 1234, delta: 5, deltaLabel: "vs last month", trend: "up" as const },
      { id: "active", label: "Active", value: 890, delta: null, deltaLabel: null },
      { id: "pending", label: "Pending", value: 120, delta: -2, deltaLabel: "vs last week", trend: "down" as const },
      { id: "revenue", label: "Revenue", value: 45600, delta: 12, deltaLabel: "vs last quarter", trend: "up" as const },
    ];
    render(<KpiGrid kpis={kpis} loading={false} error={null} />);
    expect(screen.getByText("Total Records")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders error with retry and correlationId", () => {
    const err = Object.assign(new Error("fetch failed"), { correlationId: "abc-123" });
    render(<KpiGrid kpis={null} loading={false} error={err} onRetry={vi.fn()} />);
    expect(screen.getByText(/Couldn.t load KPIs/)).toBeInTheDocument();
    expect(screen.getByText(/Correlation ID: abc-123/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  it("renders search, status, owner, date inputs and Clear button", async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        value={{ q: "", status: "", owner: "", dateFrom: "", dateTo: "" }}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Search by name…")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by owner")).toBeInTheDocument();
    expect(screen.getByLabelText("From date")).toBeInTheDocument();
    expect(screen.getByLabelText("To date")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("calls onChange when typing in search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBar
        value={{ q: "", status: "", owner: "", dateFrom: "", dateTo: "" }}
        onChange={onChange}
      />,
    );
    const input = screen.getByPlaceholderText("Search by name…");
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("calls onReset when Clear is clicked", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <FilterBar
        value={{ q: "hello", status: "active", owner: "", dateFrom: "", dateTo: "" }}
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("DataTable", () => {
  const rows = [
    { id: "1", name: "Acme Corp", status: "active", owner: "Alex Rivera", createdOn: "2026-01-15T10:00:00Z", amount: 12000 },
    { id: "2", name: "Beta LLC", status: "pending", owner: "Jordan Lee", createdOn: "2026-02-01T10:00:00Z", amount: 5000 },
  ];

  it("renders empty state when no rows and not loading", () => {
    render(
      <DataTable
        rows={[]}
        loading={false}
        error={null}
        hasNext={false}
        hasPrev={false}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        pageSize={25}
      />,
    );
    expect(screen.getByText("No records — adjust filters")).toBeInTheDocument();
  });

  it("renders error with retry and correlationId", () => {
    const err = Object.assign(new Error("server error"), { correlationId: "corr-xyz" });
    render(
      <DataTable
        rows={[]}
        loading={false}
        error={err}
        hasNext={false}
        hasPrev={false}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onRetry={vi.fn()}
        pageSize={25}
      />,
    );
    expect(screen.getByText(/Couldn.t load records/)).toBeInTheDocument();
    expect(screen.getByText(/Correlation ID: corr-xyz/)).toBeInTheDocument();
  });

  it("renders 401 auth state with sign-in link", () => {
    const err = Object.assign(new Error("Not authenticated"), { status: 401 });
    render(
      <DataTable
        rows={[]}
        loading={false}
        error={err}
        hasNext={false}
        hasPrev={false}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        pageSize={25}
      />,
    );
    expect(screen.getByText("Sign in required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/.auth/login/aad");
  });

  it("renders rows and supports pagination", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onRowClick = vi.fn();
    render(
      <DataTable
        rows={rows}
        loading={false}
        error={null}
        hasNext={true}
        hasPrev={true}
        onNext={onNext}
        onPrev={onPrev}
        onRowClick={onRowClick}
        pageSize={25}
      />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPrev).toHaveBeenCalledOnce();

    await user.click(screen.getByText("Acme Corp"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("calls onSort when clicking sortable header", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <DataTable
        rows={rows}
        loading={false}
        error={null}
        hasNext={false}
        hasPrev={false}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSort={onSort}
        sortField="name"
        sortDir="asc"
        pageSize={25}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("disables pagination buttons correctly", () => {
    render(
      <DataTable
        rows={rows}
        loading={false}
        error={null}
        hasNext={false}
        hasPrev={false}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        pageSize={25}
      />,
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });
});
