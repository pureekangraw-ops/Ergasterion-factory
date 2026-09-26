# PIXIE LAB

This repository is now dedicated to **PIXIE LAB**.

Legacy MIMIR / GO Catalog proof files were retired after PIXIE became the active project. PIXIE keeps its original safety boundary: it can inspect, test, debug, learn, project status, and produce candidate evidence, but it does **not** gain external write/delete/share/merge/deploy or production-control authority.

## Command PIXIE

From the repository root:

```bash
npm test
npm run pixie -- status
npm run pixie -- ask "มี unknown ไหม"
npm run pixie -- start_session '{"roomId":"ROOM-A","sessionId":"S-1","purpose":"check","activityType":"CHECK"}'
```

You can also send one JSON command:

```bash
npm run pixie -- '{"command":"status"}'
```

State is persisted locally at `.pixie/state.json` by default. Set `PIXIE_STATE_FILE` to use another host-managed path.

The command layer is an explicit allowlist over the existing `PixieLab` service. Unknown or external-authority commands fail closed with `COMMAND_NOT_ALLOWED`.

## Project layout

- `pixie-lab-v1/pixie-lab/core.mjs` — immutable contracts and gates.
- `pixie-lab-v1/pixie-lab/service.mjs` — PIXIE LAB service.
- `pixie-lab-v1/pixie-lab/adapters.mjs` — persistence, evidence, runner and replay seams.
- `pixie-lab-v1/pixie-lab/command.mjs` — owner/host command boundary.
- `pixie-lab-v1/cli.mjs` — local command entrypoint.
- `pixie-lab-v1/test/` — core, adapter, failure-path and command tests.

## Reality boundary

The included CLI is a host/local command surface. It does not itself create a remote transport into GO Hub and it does not bypass PIXIE authority boundaries.


## Experiment Lab zones

PIXIE LAB now separates experimentation from investigation:

- `ROOM-A`, `ROOM-B`, `ROOM-C` — ordinary isolated experiment rooms.
- `ROOM-D` — dedicated inspection/debug room.
- **Logic Workbench** — creates Lab-owned drafts and safely edits the working copy with SET, DELETE, APPEND, TRIM_TEXT, and REPLACE_TEXT while preserving the source snapshot.
- **Example Zone** — reusable fixtures for healthy public entry, 404, false-green, recovered entry, and critical-unknown behavior.
- **Experiment-aware Master Gate** — evaluates the latest relevant cross-room result for the requested experiment/subject. Historical FAIL evidence is retained for learning but does not permanently poison a recovered experiment.
- **Debug → Factory handoff** — the Lab can simulate/prepare a handoff from ROOM-D, but the command is intentionally not exposed on PIXIE's owner/CLI allowlist. The real Factory path lives in GO Hub, which re-reads the live Centre Pass and accepts only ACTIVE `MAINTENANCE` or `EMERGENCY` Factory-scoped authority. A normal WORK/READ Pass is not sufficient.

PIXIE still has no direct merge, deploy, delete, share, or production-control authority. A debug handoff is `NOT_AN_APPROVAL` and host execution remains governed.


### Room controls: Archive and Clean are intentionally separate

- `archive_session` creates an Archive Zone snapshot of the session, room, and related cycles. It does **not** close the session and does **not** clean the room.
- `close_session` closes the session only and leaves the room `DIRTY` until an explicit clean.
- `clean_room` discards the room's active transient session/cycles and room report, runs the Lab-owned cleanup lifecycle `ZERO → STERILIZE → VERIFY_CLEAN → LOAD_CLEAN_SEED → READY`, and does **not** create an archive.
- Archive records survive later room cleaning. Clean runs keep only cleanup audit metadata; they are not hidden archives.
