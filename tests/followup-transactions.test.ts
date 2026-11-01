// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
let db: PGlite;
let legacy: { status: string; patient_response: string; assessment: unknown };
const assessment = (outcome = "priority_review", status = "completed") => JSON.stringify({
  status, outcome, summary: "Synthetic summary for review.", evidence: [], model: "claude-test-model",
  prompt_version: "response-review-v1", assessed_at: "2026-11-01T12:00:00Z", failure_reason: status === "completed" ? null : "provider",
});
const record = (text: string, outcome = "priority_review", status = "completed") => db.query(
  "SELECT public.record_safety_net_response($1,$2,$3::jsonb)", [id, text, assessment(outcome, status)],
);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  for (const file of ["20260328124141_0aab9c5d-a052-46f4-b6a9-826c73115561.sql", "20261025120000_atomic_followup_records.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await db.exec(`GRANT USAGE ON SCHEMA public TO authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    INSERT INTO auth.users (id) VALUES ('${owner}'), ('${other}');
    INSERT INTO public.safety_nets (id,user_id,patient_name,patient_email,condition,gp_name,follow_up_at,status)
      VALUES ('${id}','${owner}','Demo','demo@example.test','Demo','Demo clinician',now(),'resolved');
    INSERT INTO public.check_ins(safety_net_id,patient_response) VALUES ('${id}','Preserved legacy reply');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261101191010_claude_response_review.sql', import.meta.url), 'utf8'));
  legacy = (await db.query<{ status: string; patient_response: string; assessment: unknown }>(
    'SELECT s.status,c.patient_response,c.assessment FROM public.safety_nets s JOIN public.check_ins c ON c.safety_net_id=s.id',
  )).rows[0];
}, 20_000);

afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec(`RESET ROLE; DELETE FROM public.check_ins; DELETE FROM public.safety_nets;
    DROP TRIGGER IF EXISTS fail_check_in ON public.check_ins;
    INSERT INTO public.safety_nets (id,user_id,patient_name,patient_email,condition,gp_name,follow_up_at)
    VALUES ('${id}','${owner}','Demo','demo@example.test','Demo','Demo clinician',now());
    SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}';`);
});

async function status() { return (await db.query<{ status: string }>("SELECT status FROM public.safety_nets")).rows[0]?.status; }
async function count() { return (await db.query<{ count: number }>("SELECT count(*)::int AS count FROM public.check_ins")).rows[0].count; }

describe("database transactions under row-level security", () => {
  it("reopens legacy resolved records without discarding their responses", () => {
    expect(legacy).toEqual({ status: "review_required", patient_response: "Preserved legacy reply", assessment: null });
  });
  it("stores assessment provenance atomically and routes unavailable assessments to priority review", async () => {
    await record("Ambiguous synthetic reply", "uncertain", "unavailable");
    expect(await status()).toBe("escalated");
    const row = (await db.query<{ assessment: { status: string; model: string; prompt_version: string } }>('SELECT assessment FROM public.check_ins')).rows[0];
    expect(row.assessment).toMatchObject({ status: "unavailable", model: "claude-test-model", prompt_version: "response-review-v1" });
  });
  it("removes the old boolean-only response function", async () => {
    const result = await db.query<{ removed: boolean }>("SELECT to_regprocedure('public.record_safety_net_response(uuid,text,boolean)') IS NULL AS removed");
    expect(result.rows[0].removed).toBe(true);
  });
  it.each([null, {}, { status: "completed", outcome: "safe" }, { ...JSON.parse(assessment()), model: "" }])("rejects incomplete assessment metadata", async value => {
    await expect(db.query("SELECT public.record_safety_net_response($1,$2,$3::jsonb)", [id, "Synthetic response", value === null ? null : JSON.stringify(value)])).rejects.toThrow("Invalid response assessment");
    expect(await status()).toBe("pending"); expect(await count()).toBe(0);
  });
  it("records delivery once without duplicating check-ins on retry", async () => {
    expect((await db.query<{ result: boolean }>(`SELECT public.record_followup_sent('${id}') AS result`)).rows[0].result).toBe(true);
    expect(await status()).toBe("sent"); expect(await count()).toBe(1);
    expect((await db.query<{ result: boolean }>(`SELECT public.record_followup_sent('${id}') AS result`)).rows[0].result).toBe(false);
    expect(await count()).toBe(1);
  });
  it("preserves both prior response history and the current status", async () => {
    await record("First demo response", "routine_review");
    expect(await status()).toBe("review_required");
    await record("Second demo response");
    expect(await status()).toBe("escalated"); expect(await count()).toBe(2);
    expect((await db.query<{ patient_response: string }>("SELECT patient_response FROM public.check_ins ORDER BY sent_at")).rows.map(r => r.patient_response)).toEqual(["First demo response", "Second demo response"]);
  });
  it("fills the unanswered check-in without making a duplicate", async () => {
    await db.query(`SELECT public.record_followup_sent('${id}')`);
    await record("Demo response");
    expect(await count()).toBe(1); expect(await status()).toBe("escalated");
  });
  it("preserves a sent check-in and status when saving its assessment fails", async () => {
    await db.query(`SELECT public.record_followup_sent('${id}')`);
    await db.exec(`RESET ROLE;
      CREATE OR REPLACE FUNCTION public.reject_demo_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated assessment failure'; END $$;
      CREATE TRIGGER fail_check_in BEFORE UPDATE ON public.check_ins FOR EACH ROW EXECUTE FUNCTION public.reject_demo_update();
      SET ROLE authenticated;`);
    await expect(record("Synthetic reply")).rejects.toThrow("simulated assessment failure");
    expect(await status()).toBe("sent");
    expect((await db.query<{ patient_response: string | null; assessment: unknown }>("SELECT patient_response, assessment FROM public.check_ins")).rows[0]).toEqual({ patient_response: null, assessment: null });
  });
  it("cannot modify another account's follow-up", async () => {
    await db.exec(`SET request.jwt.claim.sub = '${other}'`);
    await expect(db.query(`SELECT public.record_followup_sent('${id}')`)).rejects.toThrow("Follow-up not found");
    await expect(record("Demo")).rejects.toThrow("Follow-up not found");
    await db.exec(`SET request.jwt.claim.sub = '${owner}'`);
    expect(await status()).toBe("pending"); expect(await count()).toBe(0);
  });
  it("rolls back status changes when a check-in write fails", async () => {
    await db.exec(`RESET ROLE;
      CREATE OR REPLACE FUNCTION public.reject_demo_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated write failure'; END $$;
      CREATE TRIGGER fail_check_in BEFORE INSERT ON public.check_ins FOR EACH ROW EXECUTE FUNCTION public.reject_demo_insert();
      SET ROLE authenticated;`);
    await expect(db.query(`SELECT public.record_followup_sent('${id}')`)).rejects.toThrow("simulated write failure");
    expect(await status()).toBe("pending"); expect(await count()).toBe(0);
    await expect(record("Demo")).rejects.toThrow("simulated write failure");
    expect(await status()).toBe("pending"); expect(await count()).toBe(0);
  });
  it.each(["", " ", "x".repeat(5001)])("rejects invalid response bodies in the database too", async value => {
    await expect(record(value)).rejects.toThrow("Invalid response");
    expect(await status()).toBe("pending"); expect(await count()).toBe(0);
  });
});
