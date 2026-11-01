// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createFollowupHandler } from "../supabase/functions/trigger-followup/handler";
import { createResponseHandler } from "../supabase/functions/process-response/handler";
import type { Dependencies } from "../supabase/functions/_shared/runtime";

const userId = "00000000-0000-4000-8000-000000000001";
const netId = "00000000-0000-4000-8000-000000000002";
const net = { id: netId, user_id: userId, patient_name: "Demo Person", patient_email: "demo@example.test", condition: "Demo condition", gp_name: "Demo clinician", follow_up_at: "2026-01-01T00:00:00Z", follow_up_method: "email", status: "pending", red_flags: ["Breathing difficulty"] };
const request = (body: unknown = {}, auth = true) => new Request("http://localhost/test", { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer test-session" } : {}) }, body: JSON.stringify(body) });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function harness(options: { method?: string; providerStatus?: number; recordFails?: boolean; noRecord?: boolean; configured?: boolean; authenticated?: boolean; aiConfigured?: boolean; aiOutcome?: string; aiEvidence?: string[] } = {}) {
  const dbCalls: { url: URL; body?: Record<string, unknown>; headers: Headers }[] = [];
  const dbFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    dbCalls.push({ url, body, headers });
    if (url.pathname === "/auth/v1/user") return options.authenticated === false ? response({ message: "expired" }, 401) : response({ id: userId, email: "clinician@example.test" });
    if (url.pathname === "/rest/v1/safety_nets") {
      const result = { ...net, follow_up_method: options.method ?? "email" };
      return response(options.noRecord ? [] : [result]);
    }
    if (url.pathname.includes("/rpc/")) return options.recordFails ? response({ message: "DB unavailable", code: "XX000" }, 500) : response(url.pathname.endsWith("record_followup_sent") ? true : "check-in-id");
    throw new Error(`Unexpected database request ${url}`);
  });
  const mailFetch = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => response({ id: "message-id" }, options.providerStatus ?? 200));
  const aiFetch = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => response({ model: "claude-test-model", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ outcome: options.aiOutcome ?? "priority_review", summary: "Synthetic response requires clinician review.", evidence: options.aiEvidence ?? ["Breathing difficulty"] }) }] }));
  const env: Record<string, string> = { SUPABASE_URL: "https://supabase.example.test", SUPABASE_ANON_KEY: "public-test-key", ...(options.aiConfigured === false ? {} : { ANTHROPIC_API_KEY: "synthetic-api-key", ANTHROPIC_MODEL: "claude-test-model" }), ...(options.configured === false ? {} : { OPENMAIL_API_KEY: "server-test-key", OPENMAIL_INBOX_ID: "demo-inbox" }) };
  const deps: Dependencies = {
    createClient: (url, key, config) => createClient(url, key, { ...config, global: { ...config?.global, fetch: dbFetch } }),
    env: name => env[name], fetch: ((input, init) => String(input) === "https://api.anthropic.com/v1/messages" ? aiFetch(input, init) : mailFetch(input, init)) as typeof fetch, now: () => new Date("2026-10-25T00:00:00Z"),
  };
  return { deps, dbCalls, dbFetch, mailFetch, aiFetch };
}

beforeEach(() => vi.restoreAllMocks());

describe("follow-up delivery", () => {
  it.each([401, 429, 500])("keeps records pending when the provider returns %s", async providerStatus => {
    const h = harness({ providerStatus });
    const res = await createFollowupHandler(h.deps)(request({ safety_net_id: netId }));
    expect(res.status).toBe(502);
    expect((await res.json()).processed).toBe(0);
    expect(h.dbCalls.some(c => c.url.pathname.includes("/rpc/"))).toBe(false);
  });
  it.each([{ configured: false }, { method: "phone" }])("does not mark skipped delivery sent: %j", async options => {
    const h = harness(options);
    const res = await createFollowupHandler(h.deps)(request({ safety_net_id: netId }));
    expect(res.status).toBe(502);
    expect(h.mailFetch).not.toHaveBeenCalled();
    expect(h.dbCalls.some(c => c.url.pathname.includes("/rpc/"))).toBe(false);
  });
  it("scopes reads to the authenticated owner and atomically records accepted email", async () => {
    const h = harness();
    const handler = createFollowupHandler(h.deps);
    const res = await handler(request({ safety_net_id: netId }));
    expect(await res.json()).toEqual({ processed: 1, failed: [] });
    const query = h.dbCalls.find(c => c.url.pathname === "/rest/v1/safety_nets")!;
    expect(query.url.searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(query.headers.get("Authorization")).toBe("Bearer test-session");
    expect(h.dbCalls.find(c => c.url.pathname.endsWith("record_followup_sent"))?.body).toEqual({ p_safety_net_id: netId });
    const mail = h.mailFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(mail[0]).toBe("https://api.openmail.sh/v1/inboxes/demo-inbox/send");
    expect(new Headers(mail[1].headers).get("Idempotency-Key")).toBe(`followup-${netId}-${net.follow_up_at}`);
    await handler(request({ safety_net_id: netId }));
    const retry = h.mailFetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(new Headers(retry[1].headers).get("Idempotency-Key")).toBe(new Headers(mail[1].headers).get("Idempotency-Key"));
  });
  it("reports recording failures instead of claiming delivery completed", async () => {
    const h = harness({ recordFails: true });
    const res = await createFollowupHandler(h.deps)(request({ safety_net_id: netId }));
    expect(res.status).toBe(502);
    expect((await res.json()).processed).toBe(0);
  });
  it("only selects due records when no individual ID is supplied", async () => {
    const h = harness();
    await createFollowupHandler(h.deps)(request());
    expect(h.dbCalls.find(c => c.url.pathname === "/rest/v1/safety_nets")!.url.searchParams.get("follow_up_at")).toBe("lte.2026-10-25T00:00:00.000Z");
  });
});

describe("response processing", () => {
  it("keeps a routine Claude assessment open for review even when warning words occur in a negated sentence", async () => {
    const h = harness({ aiOutcome: "routine_review", aiEvidence: [] });
    const res = await createResponseHandler(h.deps)(request({ safety_net_id: netId, response_text: "I have no breathing difficulty." }));
    expect(await res.json()).toMatchObject({ status: "review_required", assessment: { outcome: "routine_review" }, notification: "not_required" });
    expect(h.mailFetch).not.toHaveBeenCalled();
    const rpc = h.dbCalls.find(c => c.url.pathname.endsWith("record_safety_net_response"))!;
    expect(rpc.body).toMatchObject({ p_assessment: { outcome: "routine_review" } });
    expect(rpc.body).not.toHaveProperty("p_escalated");
  });
  it("accepts a paraphrased concern through Claude instead of requiring an exact phrase", async () => {
    const h = harness({ aiEvidence: ["cannot catch my breath"] });
    const res = await createResponseHandler(h.deps)(request({ safety_net_id: netId, response_text: "I cannot catch my breath.", simulation: true }));
    expect(await res.json()).toMatchObject({ status: "escalated", assessment: { evidence: ["cannot catch my breath"] } });
  });
  it("saves unavailable assessments as priority review without a keyword fallback", async () => {
    const h = harness({ aiConfigured: false });
    const res = await createResponseHandler(h.deps)(request({ safety_net_id: netId, response_text: "All fine.", simulation: true }));
    expect(await res.json()).toMatchObject({ status: "escalated", assessment: { status: "unavailable", outcome: "uncertain", failure_reason: "configuration" } });
    expect(h.aiFetch).not.toHaveBeenCalled();
    expect(h.dbCalls.find(c => c.url.pathname.endsWith("record_safety_net_response"))?.body).toMatchObject({ p_response: "All fine.", p_assessment: { status: "unavailable" } });
  });
  it.each([null, 42, "", " ", "x".repeat(5001)])("rejects malformed response text", async response_text => {
    const h = harness();
    const res = await createResponseHandler(h.deps)(request({ safety_net_id: netId, response_text }));
    expect(res.status).toBe(400);
    expect(h.dbCalls.filter(c => c.url.pathname.startsWith("/rest/"))).toHaveLength(0);
  });
  it("records a simulation without sending any notification", async () => {
    const h = harness();
    const res = await createResponseHandler(h.deps)(request({ safety_net_id: netId, response_text: "Breathing difficulty", simulation: true }));
    expect(await res.json()).toMatchObject({ status: "escalated", assessment: { status: "completed", outcome: "priority_review", model: "claude-test-model" }, notification: "simulation" });
    expect(h.aiFetch).toHaveBeenCalledOnce();
    expect(h.mailFetch).not.toHaveBeenCalled();
    expect(h.dbCalls.find(c => c.url.pathname.endsWith("record_safety_net_response"))?.body).toMatchObject({ p_response: "Breathing difficulty", p_assessment: { outcome: "priority_review", prompt_version: "response-review-v1" } });
  });
  it("reports a failed notification separately from the saved response", async () => {
    const h = harness({ providerStatus: 503 });
    const res = await createResponseHandler(h.deps)(request({ safety_net_id: netId, response_text: "Breathing difficulty" }));
    expect(res.status).toBe(200);
    expect((await res.json()).notification).toBe("failed");
  });
  it("reuses one Claude assessment and summary for the stored record and GP notification", async () => {
    const h = harness();
    const res = await createResponseHandler(h.deps)(request({ safety_net_id: netId, response_text: "Breathing difficulty" }));
    const result = await res.json();
    expect(result.notification).toBe("accepted");
    expect(h.aiFetch).toHaveBeenCalledOnce();
    expect(h.mailFetch).toHaveBeenCalledOnce();
    const stored = h.dbCalls.find(c => c.url.pathname.endsWith("record_safety_net_response"))!.body!.p_assessment;
    expect(stored).toEqual(result.assessment);
    const [, init] = h.mailFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ to: "clinician@example.test", body: expect.stringContaining(result.assessment.summary) });
  });
  it("does not notify or return success when response recording fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({ recordFails: true });
    const res = await createResponseHandler(h.deps)(request({ safety_net_id: netId, response_text: "Breathing difficulty" }));
    expect(res.status).toBe(500);
    expect(h.mailFetch).not.toHaveBeenCalled();
  });
});

describe.each([createFollowupHandler, createResponseHandler])("authenticated endpoints", createHandler => {
  it("accepts browser preflight metadata without authenticating or accessing records", async () => {
    const h = harness();
    const res = await createHandler(h.deps)(new Request("http://localhost/test", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("x-supabase-client-platform");
    expect(h.dbFetch).not.toHaveBeenCalled();
    expect(h.aiFetch).not.toHaveBeenCalled();
  });
  it("rejects missing sessions before accessing records or sending email", async () => {
    const h = harness();
    expect((await createHandler(h.deps)(request({}, false))).status).toBe(401);
    expect(h.dbFetch).not.toHaveBeenCalled();
    expect(h.mailFetch).not.toHaveBeenCalled();
  });
  it("rejects invalid sessions", async () => {
    const h = harness({ authenticated: false });
    expect((await createHandler(h.deps)(request())).status).toBe(401);
    expect(h.dbCalls).toHaveLength(1);
  });
  it("rejects unsupported methods", async () => {
    const h = harness();
    expect((await createHandler(h.deps)(new Request("http://localhost/test"))).status).toBe(405);
    expect(h.dbFetch).not.toHaveBeenCalled();
  });
});
