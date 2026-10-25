import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SafetyNetCard from "../components/SafetyNetCard";
import type { Tables } from "../integrations/supabase/types";

const { invoke, toast } = vi.hoisted(() => ({ invoke: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const net: Tables<"safety_nets"> = {
  id: "00000000-0000-4000-8000-000000000001", user_id: "demo-user", patient_name: "Demo Person",
  patient_email: "demo@example.test", patient_dob: null, nhs_number: null, condition: "Demo condition",
  gp_name: "Demo clinician", timeframe_hours: 48, follow_up_method: "email", red_flags: ["Breathing difficulty"],
  notes: null, status: "pending", follow_up_at: "2026-10-26T00:00:00Z", created_at: "2026-10-24T00:00:00Z",
};
const renderCard = (data = net, checkIns: Tables<"check_ins">[] = []) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <SafetyNetCard safetyNet={data} checkIns={checkIns} />
  </QueryClientProvider>,
);

beforeEach(() => { invoke.mockReset(); toast.mockReset(); });

describe("follow-up card", () => {
  it("requests delivery through the authenticated backend and surfaces failure", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Not configured") });
    renderCard();
    fireEvent.click(screen.getByText("Demo Person"));
    fireEvent.click(screen.getByRole("button", { name: "Send Follow-up Now" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("trigger-followup", { body: { safety_net_id: net.id } }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Email failed" })));
  });
  it("makes simulated responses explicitly non-notifying", async () => {
    invoke.mockResolvedValue({ data: { status: "escalated" }, error: null });
    renderCard();
    fireEvent.click(screen.getByText("Demo Person"));
    fireEvent.click(screen.getByRole("button", { name: /Simulate/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Breathing difficulty" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Response" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("process-response", { body: { safety_net_id: net.id, response_text: "Breathing difficulty", simulation: true } }));
  });
  it("displays the latest response even if the query supplied unsorted check-ins", () => {
    const checkIn = { safety_net_id: net.id, red_flags_triggered: true, escalated: true };
    renderCard({ ...net, status: "escalated" }, [
      { ...checkIn, id: "old", sent_at: "2026-10-23T00:00:00Z", patient_response: "Earlier demo response" },
      { ...checkIn, id: "new", sent_at: "2026-10-24T00:00:00Z", patient_response: "Latest demo response" },
    ]);
    expect(screen.getByText('"Latest demo response"')).toBeInTheDocument();
    expect(screen.queryByText(/GP notification sent/)).not.toBeInTheDocument();
  });
  it("does not offer an email-send action for an unsupported phone record", () => {
    renderCard({ ...net, follow_up_method: "phone" });
    fireEvent.click(screen.getByText("Demo Person"));
    expect(screen.queryByRole("button", { name: "Send Follow-up Now" })).not.toBeInTheDocument();
  });
});
