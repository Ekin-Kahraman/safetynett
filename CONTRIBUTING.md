# Contributing

Contributions are welcome when they improve clinical safety, product robustness, accessibility, tests, or documentation.

## Development setup

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm test
```

Local development requires Supabase and email-provider credentials in `.env`. Do not commit real secrets.

## Pull request checklist

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm test` passes.
- Clinical logic changes include the source or guideline basis.
- No real patient data, credentials, or production identifiers are committed.

## Clinical safety

SafetyNett is a prototype. Any change to red-flag logic, escalation routing, patient communication, or verification flow should be reviewed as a clinical-safety change and documented in the pull request.

## Licence

By contributing, you agree that your contributions are licensed under the MIT licence.
