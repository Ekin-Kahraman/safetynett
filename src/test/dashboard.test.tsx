import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../pages/Dashboard";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "demo-user" } }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [], isLoading: false, isError: true, refetch: vi.fn() }) }));

describe("dashboard failure state", () => {
  it("shows unavailable data as an error rather than reassuring the user that everyone is accounted for", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Dashboard /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("may be incomplete");
    expect(screen.getByText("Follow-up records are unavailable.")).toBeInTheDocument();
    expect(screen.queryByText(/patients are all accounted for/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });
});
