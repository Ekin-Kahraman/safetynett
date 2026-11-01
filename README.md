<h1 align="center">SafetyNett</h1>

<p align="center">
  <strong>Automated patient follow-up for NHS general practice, powered by Claude.</strong>
</p>

SafetyNett targets the **manual follow-up backlog in NHS general practice**:
contacting patients, reviewing replies and preparing escalation messages. It
connects these steps in one tracked loop, designed to reduce outstanding
administrative work, shorten review handoffs and free clinician time for care.

<p align="center">
  <a href="https://safetynett.lovable.app">UI demo</a> ·
  <a href="docs/setup.md">Setup</a> ·
  <a href="docs/engineering.md">Architecture &amp; verification</a> ·
  <a href="docs/demo.md">Walkthrough &amp; scope</a>
</p>

<p align="center">
  <a href="https://github.com/Ekin-Kahraman/safetynett/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Ekin-Kahraman/safetynett/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
</p>

**Hackathon finalist**, co-built in **2.5 hours** at the
[OpenClaw Clinical Hackathon](https://clinicalhackathon.com).

## Automation loop

**GP plan → OpenMail check-in → Patient reply → Claude assessment → GP alert + dashboard → Clinician review**

The GP selects the condition, concerns and timing. With scheduling and inbox
routing configured, the backend connects the communication and review steps:

- **Reduce the communication backlog:** schedule the GP's check-in once; the backend sends the message with the selected concerns, removing individual email preparation from the follow-up task list.
- **Shorten reply-to-review handoffs:** Claude prepares a summary, priority and supporting quotes, so the GP receives review context without a separate manual summarisation step.
- **Focus clinical attention:** priority or uncertain replies trigger a GP email; routine replies remain visible for clinician review in the dashboard.
- **Keep outstanding work visible:** pending contacts, unanswered check-ins and replies awaiting review share a status history, making the next follow-up action easier to identify.

## Claude integration

One server-side [Anthropic Messages API](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
request receives the **reply, condition and selected concerns**. It returns
**review priority, exact evidence quotes and a concise GP summary**. The same
assessment powers the dashboard and notification email, avoiding a second
model request to draft the summary.

The [shared assessment module](supabase/functions/_shared/assess-response.ts)
uses structured output and local validation, with no clinical keyword rules or
fallback matcher. Model and prompt provenance are saved; ambiguous, invalid or
failed assessments remain flagged for manual review. Every reply stays open for
a clinician's decision.

![Synthetic dashboard showing pending check-ins, unanswered messages and replies awaiting clinician review](docs/screenshots/dashboard.jpg)

*Synthetic records and mocked Claude outputs. [Inspect a reply and its assessment](docs/demo.md#try-the-workflow).*

## Engineering

- **Consistent records:** response, assessment and review status commit in one database transaction.
- **Scoped access:** authenticated functions enforce record ownership; API credentials stay on the server.
- **Explicit delivery state:** stable idempotency keys support retries; a follow-up is marked sent only after provider acceptance.

[Source map, test coverage and verification commands](docs/engineering.md).

## Team

Co-built by [Ekin Kahraman](https://github.com/Ekin-Kahraman) and
[Simon Yip](https://github.com/SimonYip22) within a five-person team at Accurx HQ,
London, **28 March 2026**. Subsequent engineering adds structured Claude output,
transactional records and failure handling to the demonstrated hackathon workflow.

*Unvalidated clinical prototype. The hosted UI is a separate deployment;
its email connection needs reconfiguration and this branch's Claude changes await
deployment. [Demo status and scope](docs/demo.md#deployment-status-and-screenshot-provenance).*

[MIT licence](LICENSE) · [Citation metadata](CITATION.cff) · [Contributing](CONTRIBUTING.md)
