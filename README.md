# ERGASTERION

ERGASTERION is the **Idea Workspace App** in YGGDRASIL and is separate from PRYTANEION.

PRYTANEION keeps Work identity and continuity. ERGASTERION receives intent/context for creation or experimentation and returns candidate, artifact, result, and evidence.

## Internal shape

- **PIXIE LAB** — the ratified idea/experiment department. PIXIE is its assistant.
- **Visual capability lane** — reference, composition, edit, render preparation, compare, verify.
- **Production/evidence capability lane** — build, test, debug, QA, evidence, artifact, regression, handoff preparation.

The capability lanes are internal to ERGASTERION; they are not separate top-level apps.

## Current implementation

The active code remains under `pixie-lab-v1/` as a compatibility path while callers, persisted state, and CI remain stable.

This implementation now provides:
- Idea → Experiment → Variant → Candidate contracts
- App prototype / preview experiments
- Visual render packet → stable `GO_IMAGE_TOOL` action → artifact/receipt readback
- A canonical ERGASTERION capability manifest
- A separated production-handoff module

The compatibility path is intentionally **not renamed yet**. Physical normalization should happen only after compatibility tests and runtime readback pass.

## Core laws

- `PRYTANEION != ERGASTERION`
- `ERGASTERION != PIXIE_LAB`
- `HANDOFF != AUTHORITY`
- `ARTIFACT != VERIFIED`
- `DO != DONE`
- Missing evidence remains `UNKNOWN`

## Commands

```bash
npm test
npm run pixie -- status
npm run pixie -- capabilities
```

## Image path

```text
Visual draft
-> render packet
-> GO_IMAGE_TOOL action request
-> GO image generation engine
-> artifact + receipt
-> visual verification
```

## Key files

- `pixie-lab-v1/pixie-lab/idea-workspace.mjs`
- `pixie-lab-v1/pixie-lab/visual-workbench.mjs`
- `pixie-lab-v1/pixie-lab/image-tool-adapter.mjs`
- `pixie-lab-v1/pixie-lab/production-lane.mjs`
- `pixie-lab-v1/pixie-lab/capabilities.mjs`
- `pixie-lab-v1/pixie-lab/service.mjs`
- `pixie-lab-v1/pixie-lab/command.mjs`
