import type { createClient } from "@supabase/supabase-js";

export interface Dependencies {
  createClient: typeof createClient;
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  now?: () => Date;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response | undefined {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST for this endpoint" }, 405);
}

export function failure(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Do not return database details or provider responses to the browser.
  console.error("Follow-up operation failed", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "The operation could not be completed. Please retry." }, 500);
}

export async function authenticate(req: Request, deps: Dependencies) {
  const authorization = req.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sign in before using this endpoint");
  const url = deps.env("SUPABASE_URL");
  const key = deps.env("SUPABASE_ANON_KEY") ?? deps.env("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new HttpError(503, "Backend configuration is incomplete");
  const client = deps.createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session could not be verified");
  return { client, user: data.user };
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 12_000) throw new HttpError(413, "Request is too large");
  try {
    const value: unknown = text ? JSON.parse(text) : {};
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new HttpError(400, "Request must contain a JSON object"); }
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function sendMail(
  deps: Dependencies,
  message: { to: string; subject: string; body: string; idempotencyKey: string },
): Promise<void> {
  const key = deps.env("OPENMAIL_API_KEY");
  const inbox = deps.env("OPENMAIL_INBOX_ID");
  if (!key || !inbox) throw new HttpError(503, "Email delivery is not configured");
  const response = await deps.fetch(`https://api.openmail.sh/v1/inboxes/${encodeURIComponent(inbox)}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({ to: message.to, subject: message.subject, body: message.body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new HttpError(502, "The email provider did not accept the message");
}
