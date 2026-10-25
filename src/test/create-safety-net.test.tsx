import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import CreateSafetyNet from "../pages/CreateSafetyNet";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "demo-user" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

it("rejects whitespace-only names and malformed addresses before saving", () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><QueryClientProvider client={new QueryClient()}><CreateSafetyNet /></QueryClientProvider></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Patient name"), { target: { value: "   " } });
  fireEvent.change(screen.getByLabelText("Patient email"), { target: { value: "invalid" } });
  fireEvent.change(screen.getByLabelText("GP name"), { target: { value: "Demo clinician" } });
  fireEvent.click(screen.getByRole("button", { name: "Other" }));
  fireEvent.change(screen.getByPlaceholderText("Enter condition…"), { target: { value: "Demo condition" } });
  expect(screen.getByRole("button", { name: "Save Follow-up" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Patient name"), { target: { value: "Demo Person" } });
  fireEvent.change(screen.getByLabelText("Patient email"), { target: { value: "demo@example.test" } });
  expect(screen.getByRole("button", { name: "Save Follow-up" })).toBeEnabled();
  expect(screen.getByRole("button", { name: /Phone Call/ })).toBeDisabled();
});
