<h1 align="center">SafetyNett</h1>

<p align="center">
  <strong>Automate GP follow-up, from patient check-in to clinician review.</strong>
</p>

SafetyNett connects email check-ins, patient replies, **Claude API assessment**,
record updates and GP alerts in one workflow. The GP defines the follow-up plan;
the backend handles communication and assessment, bringing manual follow-up steps
into one tracked process.

<p align="center">
  <a href="https://github.com/Ekin-Kahraman/safetynett/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Ekin-Kahraman/safetynett/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://safetynett.lovable.app"><img alt="Hosted demo" src="https://img.shields.io/badge/demo-Lovable-blue"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
</p>

<p align="center">
  <a href="https://safetynett.lovable.app">Try the demo</a> ·
  <a href="#try-the-workflow">Walkthrough</a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="#scope">Scope</a> ·
  <a href="#team">Team</a>
</p>

- **One Claude call** returns review priority, evidence quotes and a clinician summary reused in the dashboard and GP email.
- **Traceable records:** assessment, model, prompt version and response history are saved together. Failed or uncertain assessments stay flagged for review.
- **Hackathon finalist**, co-built in **2.5 hours** at the [OpenClaw Clinical Hackathon](https://clinicalhackathon.com).

*Synthetic demonstration data only. Unvalidated prototype.*

## Automation loop

**GP plan → Email check-in → Patient reply → Claude assessment + summary → GP alert + dashboard**

**Where Claude adds value:** the [response handler](supabase/functions/process-response/handler.ts)
sends the reply, condition and selected concerns to the
[Anthropic Messages API](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
It interprets free text in context and returns a structured assessment with
supporting quotes and a concise clinician summary. The backend records the result
and requests a GP email for priority review, uncertainty or assessment failure.

[![Synthetic automation dashboard: pending and unanswered check-ins, a priority Claude assessment and a response awaiting clinician review](docs/screenshots/dashboard.jpg)](https://safetynett.lovable.app)

*Maintained interface with synthetic records and mocked Claude outputs. The hosted hackathon demo may differ.*

## Try the workflow

[Open the hosted demo](https://safetynett.lovable.app), sign in and choose
**New Safety Net** to explore condition templates and follow-up times.

For the complete workflow in the maintained app:

1. **Plan:** create a synthetic follow-up, choose a condition, select its concerns and set a check-in time.
2. **Assess:** expand a pending or awaiting-response card and choose **Simulate Response (Demo)**. Submit a synthetic reply; the configured Claude API assesses it without sending a notification email.
3. **Review:** open the card to see the summary, supporting quotes, model, prompt version and check-in history. Every response stays **Escalated** or **Awaiting Review**; model output never closes a follow-up.

<details>
<summary>See a flagged reply and its check-in history</summary>

![Synthetic priority-review record showing the response, Claude summary, evidence quotes and assessment provenance](docs/screenshots/follow-up-detail.jpg)

</details>

<details>
<summary>Templates and follow-up options</summary>

Record patient details, the responsible GP and optional notes. Choose a template
and untick warning signs that do not apply, or enter a custom condition and
concerns. Templates span nine specialties; follow-up intervals are 24 hours,
48 hours, 72 hours or 7 days. Dashboard filters show pending contacts, unanswered
check-ins, priority replies and responses awaiting clinician review; escalations appear first.

| Specialty | Example conditions |
| --- | --- |
| Paediatrics | Viral URTI, bronchiolitis, croup, febrile convulsion, meningitis |
| Respiratory | Pneumonia, asthma exacerbation, pulmonary embolism, COPD exacerbation |
| Cardiology | Acute coronary syndrome, heart failure, atrial fibrillation, pericarditis |
| Gastroenterology | Appendicitis, pancreatitis, gastroenteritis, upper GI bleed |
| Neurology | Concussion, migraine, subarachnoid haemorrhage, first seizure |
| ENT | Tonsillitis, peritonsillar abscess, otitis media, epiglottitis |
| Mental Health | Acute suicidal ideation, psychotic episode, acute anxiety |
| Musculoskeletal | Suspected fracture, septic arthritis, cauda equina syndrome |
| Dermatology | Cellulitis, allergic reaction, necrotising fasciitis |

The [template library](src/lib/conditions.ts) was authored with reference to
[NICE Clinical Knowledge Summaries](https://cks.nice.org.uk/) and
[NHS 111](https://111.nhs.uk/), with clinical review by Simon Yip during the
hackathon. These are demonstration templates, not complete, validated or
endorsed clinical pathways.

</details>

<br>

## Run locally

Use **Node.js 20** and npm, with a disposable Supabase project and synthetic data:

```sh
npm ci
cp .env.example .env
# Set the public Supabase URL and publishable/anon key in .env
npm run dev
```

Apply the committed schema and functions using the setup below. Keep Claude and OpenMail
credentials in backend secrets, never in a browser-facing `VITE_` variable.

<details>
<summary>Backend setup and endpoint contracts</summary>

Apply the migrations in `supabase/migrations/`, including
[Claude assessment and review states](supabase/migrations/20261101191010_claude_response_review.sql),
then deploy both functions using the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
Set `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OPENMAIL_API_KEY` and
`OPENMAIL_INBOX_ID` as function secrets; see
[the backend environment example](supabase/functions/.env.example).
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

</details>

<details>
<summary>Claude request contract and evaluation</summary>

[`assess-response.ts`](supabase/functions/_shared/assess-response.ts) makes one
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

</details>

<details>
<summary>Engineering and verification</summary>

The maintained version makes delivery failures visible and keeps response
history consistent with dashboard status:

- **Checked delivery:** a follow-up is recorded as sent only after the email
  provider accepts it. Rejected delivery and unsupported phone calls stay pending.
- **Consistent records:** response, assessment and dashboard status commit in one
  database transaction. Failed writes cannot leave them out of sync.
- **One assessment, two uses:** the same Claude summary is stored and emailed;
  flagged replies do not need a second model request to draft the notification.
- **Authenticated operations:** backend functions verify the signed-in user and
  use their row-level permissions. Email credentials stay on the server.

[Dashboard](src/pages/Dashboard.tsx) ·
[Follow-up handler](supabase/functions/trigger-followup/handler.ts) ·
[Response handler](supabase/functions/process-response/handler.ts) ·
[Transactional writes](supabase/migrations/20261025120000_atomic_followup_records.sql)

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests use synthetic records, mocked delivery and embedded PostgreSQL
([PGlite](https://pglite.dev/)). No external emails are sent or provider credentials
required. Dependencies are locked for repeatable checks.

| Layer | Checks |
| --- | --- |
| Templates | Specialty coverage, unique condition names and non-empty definitions |
| Request handlers | Authentication, owner-scoped queries, Claude request contract, output validation, timeouts, provider rejection, recording failures and simulation without email |
| Database | Row ownership, atomic assessment/history writes, rollback, repeat delivery recording and preservation of legacy responses |
| Build | Frontend/backend TypeScript, Deno entry points, lint and production compilation |

An earlier frontend audit introduced lazy-loaded pages. In that local Vite
5.4.19 production build (Node 25.9.0), the main
JavaScript chunk fell from **605.54 kB to 476.07 kB**, **21% smaller** before
compression. This measures the main chunk, not total app size or page-load latency.

</details>

<details>
<summary>Architecture and repository map</summary>

```text
React interface → authenticated Supabase function → user-scoped records
                              │
                   OpenMail / Claude assessment
                              │
                   Assessment + status + history
                              │
                          Dashboard
```

React, TypeScript, Tailwind CSS and shadcn/ui provide the interface. Supabase
provides PostgreSQL, authentication and Deno edge functions. OpenMail handles
email from the backend; Lovable Cloud hosts the demonstration.

| Location | Purpose |
| --- | --- |
| `src/pages/`, `src/components/` | Dashboard, forms and status views |
| `src/lib/conditions.ts` | Condition templates and alert phrases |
| `src/integrations/supabase/` | Browser client and database types |
| `supabase/functions/` | Authenticated OpenMail delivery and Claude response assessment |
| `supabase/migrations/` | Schema, ownership policies and transactional writes |
| `tests/`, `src/test/` | Handler, database and frontend tests |
| `.github/workflows/ci.yml` | Repeatable verification on pushes and pull requests |

</details>

<details>
<summary>Hosted demo and screenshot notes</summary>

The hosted demo is a separate hackathon deployment. Repository changes do not
automatically update its frontend, functions or database. The maintained code now
uses structured Claude assessment and open review states. Deploy the migration,
functions, frontend and server secrets together to enable that implementation.

Both screenshots were captured from the maintained interface with local synthetic
fixtures and mocked Claude outputs: Demo Patients A–D, a demo GP and `example.com`
email addresses. No live records were created, model requests made or emails sent.
They illustrate interface states, not clinical validation or confirmed delivery.

</details>

## Scope

Claude supports clinician review; it does not diagnose or automatically resolve
follow-ups. This is an unvalidated prototype, with no clinical outcome study,
NHS endorsement or proven reduction in deterioration or clinician workload.

<details>
<summary>Clinical scope and future work</summary>

Software checks and hackathon clinical review do not establish clinical safety
or accuracy. Use in care would require formal clinical, privacy, access,
delivery-reliability and governance assessment. The legacy database value
`resolved` is migrated to `review_required`; existing response history is preserved.

Voice and language options, clinical-record integration and clinician completion
controls remain proposed work. Voice calls and transcription are not implemented
in this repository.

</details>

## Team

Co-built by [Ekin Kahraman](https://github.com/Ekin-Kahraman) and
[Simon Yip](https://github.com/SimonYip22), as part of a five-person team at the
OpenClaw Clinical Hackathon, Accurx HQ, London, **28 March 2026**. Subsequent
engineering work covers delivery handling, response consistency and verification.

[MIT licence](LICENSE) · [Citation metadata](CITATION.cff) · [Contributing](CONTRIBUTING.md)
