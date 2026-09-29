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

The canonical working unit is **WORKBENCH**.

Current Workbench floor:

- **General / Idea Workbench**
- **Logic Workbench**
- **Visual Workbench**
- **Build / Test Workbench**
- **Debug / Inspection Workbench**
- **Production / Evidence Workbench**
- **Coding Workbench** — `HOST_DEPENDENT`; local/Actions hosts can provide real repository hands
- **Runtime Workbench** — `PARTIAL`

**ROOM-A / ROOM-B / ROOM-C** remain Experimental Labs for isolated experiments.  
**ROOM-D** remains only as a compatibility source while Debug capability migrates to the Debug / Inspection Workbench.

PIXIE is the Workshop Assistant across Workbenches. It does not own Work identity, Current acceptance, merge/deploy authority, or BIG final authority.

Older `lane`, `zone`, and ROOM-D surfaces remain only where compatibility requires them; they are not the target architecture.

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
- `workbench_open` — read-only detailed view of one Workbench using current state and existing capability inventory
- `checkpoint_dock` — read-only Work/Checkpoint resume projection; unknown next action stays `UNKNOWN`
- `reality_screen` — read-only Current/Test/Preview/Evidence/Artifact projection with provenance
- `big_view` — read-only owner Before/After + proof projection
- `intent_review` — read-only Requested Result coverage + known gap projection; excess stays `UNKNOWN` when scope diff is unavailable
- `coding_status` — inspect host executor availability and write/push capability
- `coding_list` / `coding_read` / `coding_search` / `coding_diff` — bounded repository inspection
- `coding_apply` — structured write → verification run → commit → optional branch push; no merge/deploy authority

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

`workbench_open` turns that floor into an inspectable table: General/Idea, Logic, Visual, Build/Test, Debug/Inspection, Production/Evidence, Coding gap, and Runtime partial state can be opened without creating a second state owner. Tool Rails are projections from the existing command/capability surface, not a new authority layer.

`checkpoint_dock` and `reality_screen` are also projections over the same state. They do not create Work, infer a next action, create truth, or grant authority; missing information remains `UNKNOWN`.

Phase 2 begins the canonical naming move without breaking callers: Logic now lives in `logic-workbench.mjs`, current Production/Evidence behavior lives in `production-evidence-workbench.mjs`, and Debug lifecycle behavior lives in `debug-inspection-workbench.mjs`. `lab-zones.mjs` and `production-lane.mjs` retain compatibility exports for older callers.

`big_view` and `intent_review` give BIG an owner-readable inspection surface. They can report known missing evidence/unknowns, but they do not invent scope-overrun conclusions when the required diff is not present in ERGASTERION state.

Phase 3 adds a host-backed Coding Workbench. The core Workbench contract remains runtime-neutral; the Node CLI injects a bounded local Git/filesystem executor. Read/search/diff are available whenever the host is a Git workspace. Write/commit/push require explicit host opt-in. Execution commands use structured argv rather than shell strings. Direct `main`/`master` writes are rejected, verification failure prevents commit/push, and the Workbench has no merge or deploy authority.

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
- `pixie-lab-v1/pixie-lab/logic-workbench.mjs`
- `pixie-lab-v1/pixie-lab/debug-inspection-workbench.mjs`
- `pixie-lab-v1/pixie-lab/production-evidence-workbench.mjs`
- `pixie-lab-v1/pixie-lab/workbench-floor.mjs`
- `pixie-lab-v1/pixie-lab/workbench-view.mjs`
- `pixie-lab-v1/pixie-lab/workbench-shared.mjs`
- `pixie-lab-v1/pixie-lab/owner-view.mjs`
- `pixie-lab-v1/pixie-lab/coding-workbench.mjs`
- `pixie-lab-v1/pixie-lab/coding-local-adapter.mjs`
- `pixie-lab-v1/pixie-lab/image-tool-adapter.mjs`
- `pixie-lab-v1/pixie-lab/production-lane.mjs`
- `pixie-lab-v1/pixie-lab/capabilities.mjs`
- `pixie-lab-v1/pixie-lab/service.mjs`
- `pixie-lab-v1/pixie-lab/command.mjs`
- `.github/workflows/pixie-lab-v1.yml`
