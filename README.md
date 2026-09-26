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
