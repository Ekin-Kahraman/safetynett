// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { assessResponse, needsPriorityReview } from "../supabase/functions/_shared/assess-response";

const input = { condition: "Synthetic condition", warning_signs: ["Breathing difficulty"], patient_response: "I cannot catch my breath." };
const valid = { outcome: "priority_review", summary: "Synthetic concern for clinician review.", evidence: ["cannot catch my breath"] };
function harness(output: unknown = valid, options: { status?: number; stop?: string; missing?: string; throws?: string; content?: unknown } = {}) {
  const fetch = vi.fn(async () => {
    if (options.throws) throw new DOMException("Synthetic failure", options.throws);
    return new Response(JSON.stringify({ model: "claude-resolved-model", stop_reason: options.stop ?? "end_turn", content: options.content ?? [{ type: "text", text: JSON.stringify(output) }] }), { status: options.status ?? 200, headers: { "request-id": "req_synthetic" } });
  });
  const env = (name: string) => options.missing === name ? undefined : ({ ANTHROPIC_API_KEY: "synthetic-server-secret", ANTHROPIC_MODEL: "claude-configured-model" })[name];
  return { fetch, deps: { env, fetch: fetch as typeof globalThis.fetch, now: () => new Date("2026-11-01T12:00:00Z") } };
}

describe("Claude response assessment contract", () => {
  it("uses the Messages API with a strict schema and sends only assessment context", async () => {
    const h = harness();
    const result = await assessResponse(h.deps, input);
    expect(result).toMatchObject({ ...valid, status: "completed", model: "claude-resolved-model", prompt_version: "response-review-v1", assessed_at: "2026-11-01T12:00:00.000Z", failure_reason: null, provider_status: 200, request_id: "req_synthetic" });
    expect(needsPriorityReview(result)).toBe(true);
    const [url, init] = h.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(new Headers(init.headers).get("x-api-key")).toBe("synthetic-server-secret");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-configured-model");
    expect(body.output_config.format).toMatchObject({ type: "json_schema", schema: { additionalProperties: false, required: ["outcome", "summary", "evidence"] } });
    expect(JSON.parse(body.messages[0].content)).toEqual(input);
    expect(body.system).toContain("untrusted data");
    expect(body.system).toContain("negation");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(String(init.body)).not.toContain("synthetic-server-secret");
  });

  it.each(["routine_review", "uncertain"])("accepts %s without turning it into a safety assurance", async outcome => {
    const h = harness({ ...valid, outcome, evidence: [] });
    const result = await assessResponse(h.deps, input);
    expect(result.status).toBe("completed");
    expect(result.outcome).toBe(outcome);
    expect(needsPriorityReview(result)).toBe(outcome !== "routine_review");
  });
  it("normalises casing of a supported enum without accepting unknown outcomes", async () => {
    const h = harness({ ...valid, outcome: "Routine_Review", evidence: [] });
    expect(await assessResponse(h.deps, input)).toMatchObject({ status: "completed", outcome: "routine_review" });
  });

  it.each(["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"])("requires %s without making a provider request", async missing => {
    const h = harness(valid, { missing });
    const result = await assessResponse(h.deps, input);
    expect(result).toMatchObject({ status: "unavailable", outcome: "uncertain", failure_reason: "configuration" });
    expect(needsPriorityReview(result)).toBe(true);
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])("routes HTTP %s to review without leaking provider data", async status => {
    const h = harness({ error: "synthetic-server-secret" }, { status });
    const result = await assessResponse(h.deps, input);
    expect(result).toMatchObject({ status: "unavailable", failure_reason: "provider", provider_status: status, request_id: "req_synthetic" });
    expect(JSON.stringify(result)).not.toContain("synthetic-server-secret");
    expect(needsPriorityReview(result)).toBe(true);
  });

  it.each(["AbortError", "TimeoutError", "TypeError"])("routes transport failure %s to review", async throws => {
    const h = harness(valid, { throws });
    const result = await assessResponse(h.deps, input);
    expect(result.status).toBe("unavailable");
    expect(result.failure_reason).toBe(throws === "TypeError" ? "provider" : "timeout");
    expect(needsPriorityReview(result)).toBe(true);
  });
  it("also handles a timeout while reading the provider response body", async () => {
    const h = harness();
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => { throw new DOMException("Synthetic timeout", "TimeoutError"); } } as Response);
    expect(await assessResponse(h.deps, input)).toMatchObject({ status: "unavailable", failure_reason: "timeout" });
  });

  it.each(["max_tokens", "refusal", "tool_use"])("rejects an incomplete or refused answer: %s", async stop => {
    const h = harness(valid, { stop });
    expect(await assessResponse(h.deps, input)).toMatchObject({ status: "unavailable", failure_reason: "invalid_output" });
  });

  it.each([
    null, [], { ...valid, outcome: "safe" }, { ...valid, outcome: true },
    { ...valid, summary: "" }, { ...valid, summary: "x".repeat(1501) },
    { ...valid, evidence: [] }, { ...valid, evidence: ["fabricated quote"] },
    { ...valid, evidence: [42] }, { ...valid, evidence: Array(6).fill("breath") },
    { ...valid, extra: "ignore validation" },
  ])("rejects malformed output or unsupported evidence: %j", async output => {
    const h = harness(output);
    const result = await assessResponse(h.deps, input);
    expect(result).toMatchObject({ status: "unavailable", outcome: "uncertain", failure_reason: "invalid_output" });
    expect(needsPriorityReview(result)).toBe(true);
  });

  it.each([{ content: [{ type: "text", text: "not JSON" }] }, { content: [{ type: "text", text: JSON.stringify(valid) }, { type: "text", text: "extra" }] }, { content: [] }])("rejects invalid content blocks", async ({ content }) => {
    const h = harness(valid, { content });
    expect(await assessResponse(h.deps, input)).toMatchObject({ status: "unavailable", failure_reason: "invalid_output" });
  });
});
