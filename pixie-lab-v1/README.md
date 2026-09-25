# Pixie Lab V1 Core

A thin, expandable Lab core for the `Go-Calalog-` repurpose. This branch continues the staged `pixie-lab-v1-core-complete.zip` implementation; it does not replace the repository's existing application files.

## Implemented in this branch

- Real lifecycle gates: room cleanup uses `ARCHIVE → ZERO → STERILIZE → VERIFY_CLEAN → LOAD_CLEAN_SEED → READY`; cycle uses `ZERO → STERILIZE → TEST → DEBUG → IMPROVE → RETEST → CANNON → LEARN`; no direct `CLEAN` shortcut.
- Sterilization/cleanup adapter contract with evidence. Missing, failed, or unprovable proof becomes `UNKNOWN`/quarantined rather than a fake pass.
- Evidence trust is provider-injected and fail-closed: caller observations are unverified, trusted adapters/stores hold the signer, PixieLab can receive a verifier-only view, and persistence re-verifies durable records after restart.
- Door Guard exact match on `artifactId + logicId + version + target`, plus official seal status.
- Golden Case lifecycle: `GOLDEN_CANDIDATE → VERIFY_REPLAY → GOLDEN_ACTIVE → REGRESSION_CASE`, with replay count and regression records.
- Full Matrix lifecycle: `READY_TO_RUN → RUNNING → TRIAGE → TEST_PASS/TEST_FAIL/INCONCLUSIVE/READY_CANDIDATE/NEEDS_FIX`; required `UNRUN`, `UNKNOWN`, `FAIL`, and `INCONCLUSIVE` rows cannot pass.
- Immutable TestRuns. Rerun creates a new run with `rerunOf`; existing runs are never edited.
- Test Type Registry runner interface. Contract-only or unsupported runners return `UNKNOWN`, never fake `PASS`.
- Debug flow that records reproduction, regression-run, and golden-case references with `SUSPECTED → SUPPORTED → CONFIRMED` confidence.
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
- A stable EvidenceTrustProvider/signing key managed by the host; the core contains no generated or embedded production trust secret.
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
