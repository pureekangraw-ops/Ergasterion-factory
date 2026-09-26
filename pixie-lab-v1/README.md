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


## Experiment Lab zones

PIXIE LAB now separates experimentation from investigation:

- `ROOM-A`, `ROOM-B`, `ROOM-C` — ordinary isolated experiment rooms.
- `ROOM-D` — dedicated inspection/debug room.
- **Logic Workbench** — creates Lab-owned drafts and safely edits the working copy with SET, DELETE, APPEND, TRIM_TEXT, and REPLACE_TEXT while preserving the source snapshot.
- **Example Zone** — reusable fixtures for healthy public entry, 404, false-green, recovered entry, and critical-unknown behavior.
- **Experiment-aware Master Gate** — evaluates the latest relevant cross-room result for the requested experiment/subject. Historical FAIL evidence is retained for learning but does not permanently poison a recovered experiment.
- **Debug → Factory handoff** — the Lab can simulate/prepare a handoff from ROOM-D, but the command is intentionally not exposed on PIXIE's owner/CLI allowlist. The real Factory path lives in GO Hub, which re-reads the live Centre Pass and accepts only ACTIVE `MAINTENANCE` or `EMERGENCY` Factory-scoped authority. A normal WORK/READ Pass is not sufficient.

PIXIE still has no direct merge, deploy, delete, share, or production-control authority. A debug handoff is `NOT_AN_APPROVAL` and host execution remains governed.


## Visual Workbench — GO image support desk

The Visual Workbench prepares visual work for GO without becoming an image generator or production authority.

Flow:

`SCAN → EDIT/LAYER → RENDER PACKET → VERIFY`

- Source references and the original visual spec are locked; edits affect only a Lab-owned working spec.
- SCAN stores observations, evidence refs, and UNKNOWNs. Missing evidence stays UNKNOWN instead of being guessed.
- EDIT/LAYER uses the same bounded draft operations as a controlled workbench: SET, DELETE, APPEND, TRIM_TEXT, and REPLACE_TEXT.
- RENDER PACKET collects intent, requested result, must-keep/remove items, copy, constraints, evidence refs, and unresolved UNKNOWNs for GO's external image tool.
- PIXIE never invokes image generation directly. Every render packet is `NOT_AN_APPROVAL`, has `externalExecutionRequired: true`, and carries no image-generation or production authority.
- VERIFY consumes explicit checks against the observed result. A claimed PASS without evidence is downgraded to UNKNOWN.

Commands:

- `visual_create`
- `visual_scan`
- `visual_edit`
- `visual_compare`
- `visual_render_packet`
- `visual_verify`


### Room controls: Archive and Clean are intentionally separate

- `archive_session` creates an Archive Zone snapshot of the session, room, and related cycles. It does **not** close the session and does **not** clean the room.
- `close_session` closes the session only and leaves the room `DIRTY` until an explicit clean.
- `clean_room` discards the room's active transient session/cycles and room report, runs the Lab-owned cleanup lifecycle `ZERO → STERILIZE → VERIFY_CLEAN → LOAD_CLEAN_SEED → READY`, and does **not** create an archive.
- Archive records survive later room cleaning. Clean runs keep only cleanup audit metadata; they are not hidden archives.
