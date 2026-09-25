# Pixie Lab V1 Core

A thin, expandable Lab core for the `Go-Calalog-` repurpose. This branch continues the staged `pixie-lab-v1-core-complete.zip` implementation; it does not replace the repository's existing application files.

## Implemented in this branch

- Real lifecycle gate: `ZERO → STERILIZE → TEST → DEBUG → IMPROVE → RETEST → CANNON → LEARN`; no direct `CLEAN` shortcut.
- Sterilization/cleanup adapter contract with evidence. Missing, failed, or unprovable proof becomes `UNKNOWN`/quarantined rather than a fake pass.
- Door Guard exact match on `artifactId + logicId + version + target`, plus official seal status.
- Golden Case lifecycle, replay count, mismatch detection, and `REGRESSION_ALERT` records.
- Full Matrix lifecycle. Required `UNRUN`, `UNKNOWN`, `FAIL`, and `INCONCLUSIVE` rows cannot produce overall `PASS`.
- Immutable TestRuns. Rerun creates a new run with `rerunOf`; existing runs are never edited.
- Test Type Registry runner interface. Contract-only or unsupported runners return `UNKNOWN`, never fake `PASS`.
- Debug flow that records reproduction, regression-run, and golden-case references.
- Candidate Passport as a read-only projection with `approval: NOT_AN_APPROVAL`.
- Persistence adapter seam and Board rebuild from canonical Lab state.
- PIXIE-01 self-test, cross-room checks, contradiction detection, and critical-unknown gate.
- Board is projection-only.
- Explicit guard against external write/delete/share/merge/deploy/production authority.
- Failure-path regression tests covering the above boundaries.

## Host adapters still required

The core is intentionally local and deterministic. A host application still needs to provide:

- A real persistence implementation (the included memory adapter is only a seam/test double).
- Concrete cleanup/sterilization adapters and evidence stores.
- Production test runners for categories marked contract-only.
- A host scheduler/worker for long-running replay, regression, and cross-room checks.
- UI or API bindings for Room Reports, Board projections, and Candidate Passports.
- Human/GO owner-seal issuance and any external evidence transport.

No external write, delete, share, merge, deploy, or production-control authority is implemented here.

## Test

```bash
npm test
```

The suite includes the original core coverage, failure-path tests in `test/failure-paths.test.mjs`, and adapter tests in `test/adapters.test.mjs`.
