# PIXIE Autonomy with GO Final Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let PIXIE autonomously continue Lab-owned work while requiring one explicit GO decision before any external-truth mutation.

**Architecture:** Add one focused decision-boundary module that classifies effects as LAB_LOCAL or EXTERNAL_TRUTH and defines durable GO Decision Packets. Existing PIXIE service/command/workbench projections reuse that contract; Lab-local learning remains autonomous, while external-impact learning and external-effect commands stop at PENDING_GO until an approved packet is supplied. Existing governed execution paths remain the only executors of external truth.

**Tech Stack:** Node.js >=20, ECMAScript modules, node:test, existing PIXIE durable persistence and command/workbench architecture.

**Spec:** `docs/superpowers/specs/2026-10-04-pixie-autonomy-go-final-authority-design.md`

## Global Constraints

- Inside PIXIE LAB: PIXIE decides.
- Outside PIXIE LAB / external truth: GO decides.
- LIGHT remains the Notion agent and is not PIXIE's supervisor.
- PIXIE never gains merge, deploy, owner, route, or production authority.
- Read-only observation of external truth is not an external-truth mutation.
- Tool errors produce FAILED/BLOCKED/UNKNOWN, never COMPLETE.
- External success requires destination readback or equivalent evidence.
- Work ID and Checkpoint ID remain stable across handoff and readback.
- UNKNOWN never revives a legacy executable path.
- Prefer existing PIXIE primitives over parallel authority systems.

## Review Focus

- Missing or malformed GO approval must block external execution without mutating Lab or external state.
- Expired/rejected/revise packets must never be treated as approval.
- Resume/retry with the same idempotency key must not duplicate an external side effect.
- A learning proposal incorrectly classified as LAB_LOCAL must not be able to change external routing/authority behavior.
- Read-only coding/runtime inspection must remain usable without creating a Decision Packet.

---

### Task 1: External Truth Decision Contract

**Files:**
- Create: `pixie-lab-v1/pixie-lab/decision-boundary.mjs`
- Test: `pixie-lab-v1/test/decision-boundary.test.mjs`

**Interfaces:**
- Produces:
  - `classifyPixieEffect({ command, target, effectKind, externalEffect }) -> 'LAB_LOCAL' | 'EXTERNAL_TRUTH'`
  - `createGoDecisionPacket(input) -> frozen packet`
  - `decideGoDecisionPacket(packet, decision) -> frozen packet`
  - `assertExternalExecutionApproved(packet, { now }) -> true | throws`
  - statuses: `PENDING_GO | APPROVED | REVISE | REJECTED | EXPIRED`

- [ ] **Step 1: Write failing contract tests**
  - Lab-local draft/debug/golden/self-test operations classify as `LAB_LOCAL`.
  - `coding_apply`, `runtime_action`, production handoff execution, and external-impact learning classify as `EXTERNAL_TRUTH`.
  - packet creation requires packetId, targetTruth, proposedChange, reason, expectedResult, observedLabResult, risk/unknowns, rollback/safeStop, and idempotencyKey when side effects are possible.
  - malformed/missing approval throws.
  - APPROVED passes; REVISE/REJECTED/EXPIRED/PENDING_GO block.

- [ ] **Step 2: Run the focused test**
  - Run: `cd pixie-lab-v1 && node --test test/decision-boundary.test.mjs`
  - Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal decision-boundary module**
  - Keep this module pure and dependency-light.
  - No execution side effects; it only classifies, creates/decides packets, and validates approval.

- [ ] **Step 4: Re-run the focused test**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: add PIXIE GO decision boundary contract`

### Task 2: Durable Decision Packets in PIXIE State

**Files:**
- Modify: `pixie-lab-v1/pixie-lab/service.mjs`
- Modify: `pixie-lab-v1/pixie-lab/core.mjs`
- Test: `pixie-lab-v1/test/current-contracts.test.mjs`
- Test: `pixie-lab-v1/test/failure-paths.test.mjs`

**Interfaces:**
- Consumes Task 1 packet functions.
- Produces:
  - durable state array `goDecisionPackets`
  - `PixieLab.prepareGoDecision(input)`
  - `PixieLab.decideGoDecision(packetId, input)`
  - `PixieLab.goDecision(packetId)`

- [ ] **Step 1: Write failing persistence and authority tests**
  - packet persists across `persist()/rebuildBoard()`.
  - PIXIE cannot mark its own packet APPROVED.
  - approval records GO as decider.
  - legacy persisted state without `goDecisionPackets` upgrades to an empty array.
  - REVISE returns the proposal to Lab work without external execution.

- [ ] **Step 2: Run focused tests**
  - Run: `cd pixie-lab-v1 && node --test test/current-contracts.test.mjs test/failure-paths.test.mjs`
  - Expected: FAIL on missing packet state/methods.

- [ ] **Step 3: Implement durable packet storage and service methods**
  - Add `goDecisionPackets` to `DURABLE_ARRAY_KEYS` and initial state.
  - Service methods delegate all decision semantics to Task 1.
  - Keep board/projection semantics authority-free.

- [ ] **Step 4: Re-run focused tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: persist PIXIE GO decision packets`

### Task 3: External-Effect Command Gate

**Files:**
- Modify: `pixie-lab-v1/pixie-lab/command.mjs`
- Test: `pixie-lab-v1/test/command.test.mjs`
- Test: `pixie-lab-v1/test/failure-paths.test.mjs`

**Interfaces:**
- Consumes:
  - `PixieLab.goDecision(packetId)`
  - `assertExternalExecutionApproved(packet, { now })`
- Produces:
  - external-effect commands accept `args.goDecisionPacketId`
  - blocked response exposes a stable reason such as `GO_DECISION_REQUIRED` or `GO_DECISION_NOT_APPROVED`

- [ ] **Step 1: Write failing command-seam tests**
  - `coding_apply` without approved packet is blocked before executor invocation.
  - `runtime_action` without approved packet is blocked before executor invocation.
  - REVISE/REJECTED/EXPIRED packets remain blocked.
  - APPROVED packet reaches the existing executor exactly once.
  - read-only commands (`coding_read`, `coding_search`, `runtime_view`) remain unaffected.

- [ ] **Step 2: Run command tests**
  - Run: `cd pixie-lab-v1 && node --test test/command.test.mjs test/failure-paths.test.mjs`
  - Expected: FAIL because external-effect commands do not consult GO packets.

- [ ] **Step 3: Gate only `EXTERNAL_EFFECT` commands**
  - Do not broaden the gate to all mutating commands.
  - Preserve existing executor, evidence, and command result behavior after approval.

- [ ] **Step 4: Re-run command tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: require GO approval for external PIXIE effects`

### Task 4: Split Lab-Local vs External-Impact Learning

**Files:**
- Modify: `pixie-lab-v1/pixie-lab/core.mjs`
- Modify: `pixie-lab-v1/pixie-lab/service.mjs`
- Test: `pixie-lab-v1/test/core.test.mjs`
- Test: `pixie-lab-v1/test/failure-paths.test.mjs`

**Interfaces:**
- Extend learning proposal with exact field:
  - `impactScope: 'LAB_LOCAL' | 'EXTERNAL_TRUTH'`
- `PixieLab.promoteLearning(proposalId, { goDecisionPacketId? })`

- [ ] **Step 1: Write failing learning tests**
  - LAB_LOCAL learning promotes to ACTIVE without GO.
  - EXTERNAL_TRUTH learning requires an APPROVED packet.
  - PIXIE cannot self-approve the packet used for learning.
  - missing/UNKNOWN impact scope defaults closed: no external activation.

- [ ] **Step 2: Run focused tests**
  - Run: `cd pixie-lab-v1 && node --test test/core.test.mjs test/failure-paths.test.mjs`
  - Expected: FAIL on missing impactScope behavior.

- [ ] **Step 3: Implement impact-aware learning promotion**
  - Preserve current Lab-local autonomous promotion.
  - Route external-impact promotion through Task 1 approval validation.

- [ ] **Step 4: Re-run focused tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: separate lab and external PIXIE learning`

### Task 5: Autonomous Lab Next-Action Projection

**Files:**
- Modify: `pixie-lab-v1/pixie-lab/workbench-floor.mjs`
- Modify: `pixie-lab-v1/pixie-lab/owner-view.mjs`
- Test: `pixie-lab-v1/test/workbench-floor.test.mjs`
- Test: `pixie-lab-v1/test/owner-view.test.mjs`

**Interfaces:**
- Produces projection fields:
  - `pixieActivity.current`
  - `pixieActivity.findings`
  - `pixieActivity.nextAction`
  - `pixieActivity.waitingForGo`
- These are projections only; they do not create authority.

- [ ] **Step 1: Write failing projection tests**
  - current activity comes from active session/cycle/debug/experiment state.
  - findings prefer current evidence/bug/regression facts.
  - nextAction uses the current cycle/session state, not a fabricated route.
  - waitingForGo lists only PENDING_GO Decision Packets.
  - UNKNOWN state remains UNKNOWN instead of selecting legacy ROOM-D/factory fallback.

- [ ] **Step 2: Run focused projection tests**
  - Run: `cd pixie-lab-v1 && node --test test/workbench-floor.test.mjs test/owner-view.test.mjs`
  - Expected: FAIL because `pixieActivity` does not exist.

- [ ] **Step 3: Implement projection only**
  - No scheduler or autonomous executor is introduced in this task.
  - Derive from durable Lab truth.

- [ ] **Step 4: Re-run focused tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: project PIXIE autonomous work state`

### Task 6: Operator UI for a Working Assistant

**Files:**
- Modify: `pixie-lab-v1/ui/index.html`
- Modify: `pixie-lab-v1/ui/app.js`
- Modify: `pixie-lab-v1/ui/styles.css`
- Test: `pixie-lab-v1/test/factory-shell.test.mjs`

**Interfaces:**
- Consumes `pixieActivity` from Task 5.
- Displays only:
  - doing now;
  - findings;
  - next action;
  - waiting for GO.

- [ ] **Step 1: Write failing UI contract tests**
  - shell contains no greeting/m mascot dependency.
  - activity projection renders the four required operator questions.
  - pending GO packet includes decision state and evidence count.
  - UI does not present PIXIE as merge/deploy approver.

- [ ] **Step 2: Run focused UI tests**
  - Run: `cd pixie-lab-v1 && node --test test/factory-shell.test.mjs`
  - Expected: FAIL on missing activity surface.

- [ ] **Step 3: Implement the minimal operator surface**
  - Replace/extend the current static PIXIE note with live activity data.
  - Do not add a greeting flow or mascot animation.

- [ ] **Step 4: Re-run UI tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: show PIXIE work state and GO queue`

### Task 7: Durable Resume and Idempotent External Execution

**Files:**
- Modify: `pixie-lab-v1/pixie-lab/command.mjs`
- Modify: `pixie-lab-v1/pixie-lab/service.mjs`
- Test: `pixie-lab-v1/test/command.test.mjs`
- Test: `pixie-lab-v1/test/failure-paths.test.mjs`

**Interfaces:**
- External-effect command attempts use the packet's `idempotencyKey`.
- Durable packet records execution state:
  - `NOT_EXECUTED | EXECUTING | EXECUTED | FAILED | UNKNOWN`
  - `executionEvidenceRefs`
  - `externalResultRef`

- [ ] **Step 1: Write failing resume/idempotency tests**
  - same approved packet/idempotency key cannot invoke executor twice after EXECUTED.
  - interrupted EXECUTING state resumes safely without blindly repeating a side effect.
  - executor/tool error records FAILED/UNKNOWN, never COMPLETE/EXECUTED.
  - EXECUTED requires readback/evidence or remains UNKNOWN.
  - Work ID/Checkpoint ID in the packet remain unchanged.

- [ ] **Step 2: Run focused tests**
  - Run: `cd pixie-lab-v1 && node --test test/command.test.mjs test/failure-paths.test.mjs`
  - Expected: FAIL on absent execution-state semantics.

- [ ] **Step 3: Implement durable external-attempt recording**
  - Reuse existing persistence.
  - Do not create a second external executor.

- [ ] **Step 4: Re-run focused tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: make approved PIXIE external effects resumable`

### Task 8: Full Regression and Contract Lock

**Files:**
- Modify if needed: `pixie-lab-v1/test/current-contracts.test.mjs`
- Modify if needed: `pixie-lab-v1/README.md`

**Interfaces:**
- No new runtime interface; locks the final contract.

- [ ] **Step 1: Add final contract assertions**
  - board remains projection-only.
  - merge/deploy commands remain unavailable.
  - LIGHT/Notion role is not introduced into PIXIE authority.
  - legacy ROOM-D remains compatibility-only and cannot satisfy GO approval.
  - Lab-local work still runs without GO.

- [ ] **Step 2: Run the complete suite**
  - Run: `cd pixie-lab-v1 && npm test`
  - Expected: all syntax checks and all `node --test test/*.test.mjs` pass.

- [ ] **Step 3: Inspect branch diff**
  - Confirm only the intended PIXIE Lab decision/autonomy surfaces changed.
  - Confirm no merge/deploy/owner authority was added.

- [ ] **Step 4: Commit final documentation/contract adjustments**
  - Commit message: `docs: lock PIXIE autonomy and GO authority contract`

- [ ] **Step 5: Open/update implementation PR and require exact-head CI**
  - Merge only after exact-head CI passes and review confirms GO remains the final external-truth authority.
