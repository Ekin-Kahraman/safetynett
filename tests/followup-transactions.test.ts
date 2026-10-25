// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
let db: PGlite;

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
    INSERT INTO auth.users (id) VALUES ('${owner}'), ('${other}');`);
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
  it("records delivery once without duplicating check-ins on retry", async () => {
    expect((await db.query<{ result: boolean }>(`SELECT public.record_followup_sent('${id}') AS result`)).rows[0].result).toBe(true);
    expect(await status()).toBe("sent"); expect(await count()).toBe(1);
    expect((await db.query<{ result: boolean }>(`SELECT public.record_followup_sent('${id}') AS result`)).rows[0].result).toBe(false);
    expect(await count()).toBe(1);
  });
  it("preserves both prior response history and the current status", async () => {
    await db.query(`SELECT public.record_safety_net_response('${id}', 'First demo response', false)`);
    expect(await status()).toBe("resolved");
    await db.query(`SELECT public.record_safety_net_response('${id}', 'Second demo response', true)`);
    expect(await status()).toBe("escalated"); expect(await count()).toBe(2);
    expect((await db.query<{ patient_response: string }>("SELECT patient_response FROM public.check_ins ORDER BY sent_at")).rows.map(r => r.patient_response)).toEqual(["First demo response", "Second demo response"]);
  });
  it("fills the unanswered check-in without making a duplicate", async () => {
    await db.query(`SELECT public.record_followup_sent('${id}')`);
    await db.query(`SELECT public.record_safety_net_response('${id}', 'Demo response', true)`);
    expect(await count()).toBe(1); expect(await status()).toBe("escalated");
  });
  it("cannot modify another account's follow-up", async () => {
    await db.exec(`SET request.jwt.claim.sub = '${other}'`);
    await expect(db.query(`SELECT public.record_followup_sent('${id}')`)).rejects.toThrow("Follow-up not found");
    await expect(db.query(`SELECT public.record_safety_net_response('${id}', 'Demo', true)`)).rejects.toThrow("Follow-up not found");
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
    await expect(db.query(`SELECT public.record_safety_net_response('${id}', 'Demo', true)`)).rejects.toThrow("simulated write failure");
    expect(await status()).toBe("pending"); expect(await count()).toBe(0);
  });
  it.each(["", " ", "x".repeat(5001)])("rejects invalid response bodies in the database too", async value => {
    await expect(db.query("SELECT public.record_safety_net_response($1,$2,false)", [id, value])).rejects.toThrow("Invalid response");
    expect(await status()).toBe("pending"); expect(await count()).toBe(0);
  });
});
