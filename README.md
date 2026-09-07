# SafetyNett

[![CI](https://github.com/Ekin-Kahraman/safetynett/actions/workflows/ci.yml/badge.svg)](https://github.com/Ekin-Kahraman/safetynett/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://safetynett.lovable.app)
[![Built at](https://img.shields.io/badge/built%20at-OpenClaw%20Hackathon-orange)](https://clinicalhackathon.com)

**[Architecture](#architecture) | [Condition Templates](#condition-templates) | [Why This Matters](#why-this-matters) | [Roadmap](#post-hackathon-in-development) | [Tech Stack](#tech-stack) | [Team](#team)**

SafetyNett is a **hackathon prototype for patient follow-up and clinician alerts**.
It explores how follow-up records, patient responses and review requests could
be brought together in one dashboard.

The published backend uses keyword matching against condition-specific alert
phrases. It is not a validated clinical AI system, and a match or missing match
does not establish whether a patient is safe.

**Demo:** [safetynett.lovable.app](https://safetynett.lovable.app)

Built in 2.5 hours at the [OpenClaw Clinical Hackathon](https://clinicalhackathon.com) (28 March 2026, Accurx HQ, London).

*Not a deployed clinical device. Use synthetic demonstration data only, not real patient information or care decisions.*

The repository includes a React/TypeScript interface, a Supabase backend and
email follow-up functions. Automated checks cover code quality, types, builds
and the condition-template library; they do not establish clinical safety.

![SafetyNett Dashboard](screenshot.png)

## Architecture

```
Follow-up record → Due-record function → Email (when configured)
                                               │
                                        Response recorded
                                               │
                                         Keyword check
                                               │
                              Dashboard status and review alert
```

Email and scheduled execution depend on backend configuration. The current
matching rule can miss context and negation, and can produce false alerts.
The backend's `resolved` status means no keyword matched; it is **not** a
clinical assessment. Voice and model-based verification are proposed features.

## Condition Templates

The template library spans nine specialties. The team used NICE and NHS 111
materials as references, but this does not make the templates complete,
clinically validated or endorsed by those organisations.

| Specialty | Conditions |
|---|---|
| **Paediatrics** | Viral URTI, bronchiolitis, croup, febrile convulsion, meningitis |
| **Respiratory** | CAP, asthma exacerbation, PE, COPD exacerbation, suspected lung malignancy |
| **Cardiology** | ACS, heart failure, AF, pericarditis, aortic dissection |
| **Gastroenterology** | Appendicitis, pancreatitis, upper GI bleed, IBD flare |
| **Neurology** | Concussion, migraine, SAH, first seizure, TIA |
| **ENT** | Tonsillitis, peritonsillar abscess, otitis media, epiglottitis |
| **Mental Health** | Acute suicidal ideation, psychotic episode, acute anxiety |
| **Musculoskeletal** | Suspected fracture, septic arthritis, cauda equina syndrome |
| **Dermatology** | Cellulitis, allergic reaction, necrotising fasciitis |

Templates are demonstration content and need formal review before any clinical
use. Their presence in tests checks software structure, not medical correctness.

## Why This Matters

The design question is whether a shared record of follow-up requests and
responses could help clinicians review outstanding contacts. The prototype
demonstrates that workflow, rather than claiming to replace existing systems.

There is no clinical outcome study, comparison with existing products, or
evidence here that SafetyNett reduces missed deterioration or workload.

## Post-Hackathon: In Development

The following are proposed directions, not completed or clinically validated
capabilities of the published prototype.

### Response review

Explore model-assisted interpretation alongside human review, with tests for
missed concerns, false alerts, ambiguous language and delivery failures.
A second model alone would not establish safety.

### Accessible follow-up

Explore voice and language options with users, including people who cannot
reliably use email. Voice calls and transcription are not implemented here.

### Further Planned

- Integration with clinical records, subject to permissions and formal review
- Auditable records of communications and review decisions
- Multi-language patient communications
- GP-configurable custom red flag definitions

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, auth, edge functions)
- **Email:** OpenMail API
- **Deployment:** Lovable Cloud

## Project Structure

```
src/
├── components/       Dashboard, safety net cards, forms, navigation
├── hooks/            Auth, toast, mobile detection
├── integrations/     Supabase client and types
├── lib/              Clinical logic - conditions, red flags, timeframes
├── pages/            Dashboard, create safety net, login
supabase/
├── migrations/       Database schema
├── functions/        Edge functions (trigger-followup, process-response)
```

## Usage

The [demonstration interface](https://safetynett.lovable.app) uses a Supabase
backend. Local frontend development still requires backend configuration;
starting the frontend alone does not set up email delivery or scheduling.

For local development (modifying the frontend):

```bash
npm install
npm run dev
```

Requires `.env` with Supabase and OpenMail credentials pointing to the cloud instance - see `.env.example`.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

GitHub Actions runs the same checks on every push and pull request.

## Limitations

This is a software demonstration, not a clinical decision-support product.
Keyword matching has not been clinically validated. There is no claim of NHS
endorsement, regulatory approval, validated diagnostic performance or suitability
for patient care. Backend access, privacy, delivery reliability and clinical
governance would need formal assessment before any real-world use.

## Team

Built at the OpenClaw Clinical Hackathon by [Ekin Kahraman](https://github.com/Ekin-Kahraman) and [Simon Yip](https://github.com/SimonYip22), as part of a five-person team.

Clinical logic and safety-netting criteria were authored from NICE Clinical Knowledge Summaries and NHS 111 pathway documentation, with clinical review by Simon Yip.

## Licence

MIT
