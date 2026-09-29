# ERGASTERION

ERGASTERION is the **Idea Workspace App** in YGGDRASIL and is separate from PRYTANEION.

PRYTANEION keeps Work identity and continuity. ERGASTERION receives intent/context for creation or experimentation and returns candidate, artifact, result, and evidence.

## System boundary

Canonical cross-app flow:

```text
PRYTANEION
  -> intent / context / Work ID / Checkpoint
ERGASTERION
  -> idea / experiment / create-edit / compare / test / evaluate
  -> candidate / artifact / evidence
PRYTANEION
```

The handoff preserves `workId` and `checkpointId`. It does **not** transfer Work ownership or create route/production authority.

The GO Hub connection remains an upstream PRYTANEION capability. ERGASTERION consumes the handoff contract; it does not absorb GO Hub.

## Internal shape

- **PIXIE LAB** — ratified idea/experiment department. PIXIE is its assistant.
- **Visual capability lane** — reference, composition, edit, render preparation, compare, verify.
- **Production/evidence capability lane** — build, test, debug, QA, evidence, artifact, regression, handoff preparation.

The capability lanes are internal to ERGASTERION; they are not separate top-level apps.

## Current implementation

Current main includes the ERGASTERION Idea Workspace migration delivered through PRs #25–#28.

Implemented:

- Idea → Experiment → Variant → Candidate
- Logic and Visual work linked to Experiment / Variant identity
- App prototype / preview experiments
- App prototype comparison
- Visual render packet → stable `GO_IMAGE_TOOL` action → artifact/receipt readback
- Canonical ERGASTERION capability manifest
- Current Production/Evidence handoff
- Runtime state schema `ERGASTERION_STATE_V2`
- Compatibility migration for older persisted Lab state
- PIXIE as the Lab assistant identity; no separate Gnome assistant identity

The active physical path remains under `pixie-lab-v1/` for compatibility with existing callers, persisted state, and workflow references. The path name is not the product boundary.

## Hub and handoff status

The current handoff keeps the original Work identity:

```text
workId + checkpointId
        |
        v
ERGASTERION experiment/candidate work
        |
        v
artifact / result / evidence
        |
        v
PRYTANEION readback
```

Rules:

- `HANDOFF != OWNERSHIP_TRANSFER`
- `HANDOFF != AUTHORITY`
- `ARTIFACT != VERIFIED`
- `DO != DONE`
- Missing evidence remains `UNKNOWN`

## Legacy Factory route

The old Debug → Factory route is **not exposed on the normal command/runtime surface**.

Current command:

```text
production_handoff_prepare
```

There is no public `factory_handoff` command.

Legacy `prepareFactoryHandoff()` compatibility code is still retained inside the source so older persisted/runtime assumptions do not break unexpectedly. It is marked legacy and is **not the CURRENT ERGASTERION flow**.

The CURRENT Production/Evidence handoff:

- preserves Experiment / Variant / Work / Checkpoint context
- creates no route authority
- transfers no authority
- returns `NOT_AN_APPROVAL`

## Image path

ERGASTERION does not implement a second image-generation engine.

```text
Visual draft
-> render packet
-> GO_IMAGE_TOOL action request
-> GO image generation engine
-> artifact + receipt
-> visual verification
```

PIXIE prepares, compares, and verifies visual work; GO Image Generation remains the executor.

## Commands

```bash
npm test
npm run pixie -- status
npm run pixie -- capabilities
```

Important current commands include:

- `idea_create`
- `experiment_create`
- `variant_create`
- `variant_evaluate`
- `experiment_select`
- `app_prototype_create`
- `app_preview_record`
- `app_compare`
- `logic_create` / `logic_edit` / `logic_compare`
- `visual_create` / `visual_scan` / `visual_edit` / `visual_compare`
- `visual_render_packet` / `visual_verify`
- `image_request` / `image_result`
- `production_handoff_prepare`
- `workbench_floor` — read-only Workbench/Lab/Reality projection from current state

The command surface does not expose merge, deploy, release, system-CURRENT acceptance, direct image generation, or the legacy `factory_handoff` route.

## Dream Factory migration surface

Phase 1 begins by surfacing existing state without changing core behavior. The read-only `workbench_floor` command projects:

- A/B/C as Experimental Labs
- ROOM-D as compatibility-only debug room pending migration
- existing Idea / Logic / Visual / Build-Test / Production-Evidence capability surfaces
- Coding as `GAP`
- Runtime as `PARTIAL`
- shared PIXIE / Evidence / Checkpoint / Reality summaries

The projection creates no authority, transfers no authority, and does not persist or mutate state.

## Verification status

On the current ERGASTERION migration:

- repository tests: **PASS**
- persisted CLI smoke path: **PASS**
- Cloudflare `Workers Builds: go-calalog`: **PASS** on the verified migration main
- production `workflow_dispatch → pixie-runtime-state` round-trip: **UNKNOWN** until an explicit production dispatch is observed and read back

Do not interpret a skipped workflow-dispatch command job on push/PR as failure; that job is intentionally dispatch-only.

## Key files

- `pixie-lab-v1/pixie-lab/idea-workspace.mjs`
- `pixie-lab-v1/pixie-lab/visual-workbench.mjs`
- `pixie-lab-v1/pixie-lab/image-tool-adapter.mjs`
- `pixie-lab-v1/pixie-lab/production-lane.mjs`
- `pixie-lab-v1/pixie-lab/capabilities.mjs`
- `pixie-lab-v1/pixie-lab/service.mjs`
- `pixie-lab-v1/pixie-lab/command.mjs`
- `.github/workflows/pixie-lab-v1.yml`
