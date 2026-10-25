# Contributing

Contributions are welcome when they improve clinical safety, product robustness, accessibility, tests, or documentation.

## Development setup

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
```

Local frontend development requires public Supabase configuration in `.env`. Email-provider credentials belong only in Supabase function secrets; never use a `VITE_` variable for them. Tests use synthetic data and mocked delivery. Apply the committed database migrations before running the edge functions.

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
