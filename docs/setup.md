# Setup and deployment

[SafetyNett](../README.md) · [Engineering](engineering.md) · [Demo guide](demo.md)

Run commands from the repository root.

## Frontend

Use **Node.js 20** and npm, with a disposable Supabase project and synthetic data:

```sh
npm ci
cp .env.example .env
# Set the public Supabase URL and publishable/anon key in .env
npm run dev
```

Apply the committed schema and functions as described below. Keep Claude and OpenMail
credentials in backend secrets, never in a browser-facing `VITE_` variable.

## Backend and endpoint contracts

Apply the migrations in `supabase/migrations/`, including
[Claude assessment and review states](../supabase/migrations/20261101191010_claude_response_review.sql),
then deploy both functions using the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
Set `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OPENMAIL_API_KEY` and
`OPENMAIL_INBOX_ID` as function secrets; see
[the backend environment example](../supabase/functions/.env.example).
Supabase supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY` at runtime.

Keep JWT verification enabled. Both functions require a signed-in user's bearer
token and operate within that user's row-level permissions. They are not
anonymous patient-response webhooks or global administrator jobs.

| Endpoint | Request | Behaviour |
| --- | --- | --- |
| `trigger-followup` | `POST {"safety_net_id":"<UUID>"}` | Attempts one pending record belonging to the caller. |
| `trigger-followup` | `POST {}` | Attempts up to 100 of the caller's pending records whose follow-up time has passed. |
| `process-response` | `POST {"safety_net_id":"<UUID>","response_text":"..."}` | Calls Claude, validates its output and atomically saves the response and assessment; reports notification acceptance/failure separately. |
| `process-response` | Add `"simulation":true` | Runs Claude and saves the demonstration assessment without sending a notification. |

Email requests use the provider's inbox endpoint and a stable idempotency key.
Provider acceptance does not confirm recipient delivery. Email and the database
cannot share one transaction: if recording fails after provider acceptance, review
the failure before retrying. The provider documents a
[24-hour idempotency window](https://docs.openmail.sh/best-practices/idempotency).

Connect a scheduler to the authenticated due-follow-up endpoint and an inbox
adapter to the authenticated response endpoint to run the loop unattended.
Scheduling and inbound email routing require deployment configuration; enabling
`pg_cron` alone does not schedule a job. Automated
phone calls are not implemented and are disabled in the maintained creation form.
Each function pins its Supabase dependency in `deno.json`; CI checks the Deno
entry points against dependencies installed from `package-lock.json`.

[Authentication](https://supabase.com/docs/guides/functions/auth) ·
[Function dependencies](https://supabase.com/docs/guides/functions/dependencies) ·
[OpenMail](https://openmail.sh/)

## Claude configuration and evaluation

[`assess-response.ts`](../supabase/functions/_shared/assess-response.ts) makes one
server-side `POST /v1/messages` request. The prompt receives only the condition,
selected concerns and response text. Patient-name, contact-detail and GP-identifier
fields are not added to the request. Reply text is treated as untrusted data.

Structured output contains `outcome`, `summary` and exact `evidence` quotes.
Local validation rejects malformed, truncated or refused output and unsupported
quotes. The saved assessment includes the returned model, prompt version, time,
provider HTTP status, request ID and any failure reason. No keyword matcher or fallback is used, and no response
is automatically marked resolved. Missing configuration and provider failures
create priority manual-review records.

Configure `ANTHROPIC_MODEL` explicitly; the environment example uses
`claude-sonnet-5-5`. The versioned prompt and model are recorded with each result.

```sh
# Export ANTHROPIC_API_KEY and ANTHROPIC_MODEL in your shell first.
npm run eval:claude
```

This opt-in evaluation makes three billed Claude requests using synthetic
paraphrase, negation and embedded-instruction cases. Normal tests mock the API
and make no external requests. These cases probe behaviour, not clinical accuracy.
