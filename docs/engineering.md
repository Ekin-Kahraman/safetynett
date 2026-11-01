# Architecture and verification

[SafetyNett](../README.md) · [Setup](setup.md) · [Demo guide](demo.md)

This document describes the maintained repository implementation.

## Architecture

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
| `src/lib/conditions.ts` | Condition templates and selectable concerns |
| `src/integrations/supabase/` | Browser client and database types |
| `supabase/functions/` | Authenticated OpenMail delivery and Claude response assessment |
| `supabase/migrations/` | Schema, ownership policies and transactional writes |
| `tests/`, `src/test/` | Handler, database and frontend tests |
| `.github/workflows/ci.yml` | Repeatable verification on pushes and pull requests |

## Reliability and verification

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

[Dashboard](../src/pages/Dashboard.tsx) ·
[Follow-up handler](../supabase/functions/trigger-followup/handler.ts) ·
[Response handler](../supabase/functions/process-response/handler.ts) ·
[Transactional writes](../supabase/migrations/20261025120000_atomic_followup_records.sql)

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
