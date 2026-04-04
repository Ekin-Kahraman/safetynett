# SafetyNett

Automated clinical safety netting for NHS primary care.

Replaces verbal "come back if not better" instructions with tracked, automated patient follow-up. When a patient's response triggers condition-specific red flags, the GP is escalated immediately.

**Live:** [safetynett.lovable.app](https://safetynett.lovable.app)

Built in 6 hours at the OpenClaw Clinical Hackathon (28 March 2026, Accurx HQ, London).

## How It Works

1. **GP creates a safety net** — selects patient, condition, timeframe (24h–7d), and red flags from a clinically validated library
2. **Automated follow-up** — the system emails the patient after the set interval asking about specific symptoms
3. **Red flag detection** — patient responses are matched against condition-specific red flags using fuzzy keyword analysis with plain-English aliases
4. **Escalation** — if thresholds are met, the GP is notified with severity scoring and the patient's verbatim response
5. **Dashboard** — all active safety nets in one view, filterable by status

Non-response is treated as clinically significant. A patient who doesn't reply triggers automatic escalation for manual review.

## Clinical Coverage

40+ conditions across 9 specialties. Red flag definitions sourced from NICE Clinical Knowledge Summaries and NHS 111 pathway documentation.

| Specialty | Conditions |
|---|---|
| Paediatrics | Viral URTI, bronchiolitis, croup, febrile convulsion, meningitis |
| Respiratory | CAP, asthma exacerbation, PE, COPD exacerbation, suspected lung malignancy |
| Cardiology | ACS, heart failure, AF, pericarditis, aortic dissection |
| Gastroenterology | Appendicitis, pancreatitis, upper GI bleed, IBD flare |
| Neurology | Concussion, migraine, SAH, first seizure, TIA |
| ENT | Tonsillitis, peritonsillar abscess, otitis media, epiglottitis |
| Mental Health | Acute suicidal ideation, psychotic episode, acute anxiety |
| Musculoskeletal | Suspected fracture, septic arthritis, cauda equina syndrome |
| Dermatology | Cellulitis, allergic reaction, necrotising fasciitis |

## Red Flag Engine

The matching engine uses fuzzy keyword analysis with condition-specific aliases. A parent saying *"she won't drink anything and she's really floppy"* triggers both **Not drinking fluids** and **Drowsy or floppy** for a febrile child. Severity scales with matched flag count (low / medium / high).

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, auth, edge functions)
- **Email:** OpenMail API for automated patient follow-ups
- **Deployment:** Lovable Cloud

## Post-Hackathon Roadmap

### AI Verification Layer (Regulatory Compliance)

The primary feedback from clinical judges: NHS is a highly regulated environment. Automated systems contacting patients about clinical symptoms carry risk. The fix is not removing AI — it's adding a **verification layer**.

**Planned:** A dedicated verification model that reviews every automated communication before it reaches the patient. This model checks:
- Clinical accuracy of the red flag matching against the patient's actual words
- Appropriate severity classification
- Whether escalation thresholds are correctly applied
- Flagging edge cases for human-in-the-loop review before sending

This creates an auditable, defensible pipeline: automated triage → AI verification → human override where needed. Designed to satisfy MHRA software-as-medical-device (SaMD) and NHS Digital clinical safety standards (DCB0129/DCB0160).

### Voice Follow-Up (ElevenLabs)

Not every patient reads email. Older patients, patients with visual impairments, and patients with low digital literacy are systematically excluded by text-only follow-up.

**Planned:** ElevenLabs voice synthesis to deliver follow-ups as automated phone calls, running simultaneously with email. The patient responds verbally; speech-to-text feeds into the same red flag engine. Same clinical logic, different delivery channel. Accessibility by default, not as an afterthought.

### Further Planned

- FHIR integration for NHS spine connectivity (PDS patient lookup, GP Connect)
- Structured audit logging for CQC inspection readiness
- Multi-language support for patient communications
- GP-configurable custom red flag definitions beyond the preset library

## Project Structure

```
src/
├── components/       Dashboard cards, forms, navigation
├── hooks/            Auth, toast notifications, mobile detection
├── integrations/     Supabase client and generated types
├── lib/              Clinical logic — conditions, red flags, timeframes
├── pages/            Dashboard, create safety net, login
supabase/
├── migrations/       Database schema (safety_nets, check_ins)
├── functions/        Edge functions (trigger-followup, process-response)
```

## Running Locally

```bash
npm install
npm run dev
```

Requires a `.env` file — see `.env.example` for required variables.

## Limitations

Hackathon prototype. Supports clinical decision-making — does not replace clinical judgement. Not validated for production clinical use. Verification layer and regulatory compliance work are in progress.

## Team

Built by a multidisciplinary team at the OpenClaw Clinical Hackathon. Clinical logic authored from NICE Clinical Knowledge Summaries and NHS 111 pathway documentation.

## Licence

MIT
