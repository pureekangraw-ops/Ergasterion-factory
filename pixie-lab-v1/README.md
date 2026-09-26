# PIXIE LAB V1

PIXIE LAB is the active project in this repository.

## Core behavior

- Real lifecycle gates: room cleanup uses `ARCHIVE → ZERO → STERILIZE → VERIFY_CLEAN → LOAD_CLEAN_SEED → READY`; cycle uses `ZERO → STERILIZE → TEST → DEBUG → IMPROVE → RETEST → CANNON → LEARN`; no direct `CLEAN` shortcut.
- Sterilization/cleanup adapter contract with evidence. Missing, failed, or unprovable proof becomes `UNKNOWN`/quarantined rather than a fake pass.
- Evidence trust is provider-injected and fail-closed.
- Door Guard exact match on `artifactId + logicId + version + target`, plus official seal status.
- Golden Case lifecycle and regression records.
- Full Matrix lifecycle; required `UNRUN`, `UNKNOWN`, `FAIL`, and `INCONCLUSIVE` rows cannot pass.
- Immutable TestRuns; reruns create a new run.
- Debug confidence moves through `SUSPECTED → SUPPORTED → CONFIRMED`.
- Candidate Passport is a read-only projection with `approval: NOT_AN_APPROVAL`.
- Persistence adapter seam and Board rebuild from canonical Lab state.
- PIXIE-01 self-test, cross-room checks, contradiction detection, and critical-unknown gate.
- Board is projection-only.
- Explicit guard against external write/delete/share/merge/deploy/production authority.

## Command surface

The owner/host command boundary is `pixie-lab/command.mjs`, with the CLI entrypoint at `cli.mjs`.

```bash
npm run pixie -- status
npm run pixie -- ask "มี unknown ไหม"
```

The command surface is an allowlist over the existing PixieLab service. It does not add external authority.

## Host adapters still required

The core is intentionally local and deterministic. A host application still needs to provide:

- A production persistence implementation when local JSON is not appropriate.
- Concrete cleanup/sterilization adapters and evidence stores.
- A stable EvidenceTrustProvider/signing key managed by the host.
- Production test runners for categories marked contract-only.
- A host scheduler/worker for long-running replay, regression, and cross-room checks.
- UI or API bindings when a remote control surface is desired.
- Human/GO owner-seal issuance and any external evidence transport.

No external write, delete, share, merge, deploy, or production-control authority is implemented here.

## Test

```bash
npm test
```
