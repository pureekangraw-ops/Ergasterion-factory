# PIXIE Autonomy with GO Final Authority — Design

Date: 2026-10-04
Status: DESIGN FOR REVIEW
Repository: pureekangraw-ops/Go-Calalog-
Work ID: WORK-PIXIE-AUTONOMY-GO-FINAL-AUTHORITY-20261004-20261004-001
Checkpoint ID: CP-WORK-PIXIE-AUTONOMY-GO-FINAL-AUTHORITY-20261004-20261004-001

## 1. Intent

PIXIE should behave like a capable lab assistant that knows how to continue work without waiting for step-by-step commands.

Inside PIXIE LAB, PIXIE is autonomous: it may observe, plan, branch experiments, edit lab-owned drafts, debug, create and replay Golden Cases, run self-tests, learn from evidence, select the next lab action, and refine its own lab methods.

PIXIE does not own final external truth. When a proposed result would leave PIXIE LAB and change an external system, PIXIE must stop at one explicit GO decision boundary. GO is the final authority for that external truth change.

This design intentionally avoids many small permission gates. The boundary is simple:

> Inside the Lab: PIXIE decides.
> Outside the Lab: GO decides.

## 2. Role separation

### PIXIE
PIXIE owns experimental reasoning and lab execution:
- autonomous planning within Lab scope;
- experiments, variants, logic drafts, debug sessions, Golden Cases, regression checks;
- lab-owned coding/runtime simulations and reversible workbench state;
- self-test and learning proposals;
- deciding what lab action to try next;
- assembling evidence-backed proposals for external change.

### GO
GO owns the final decision when a change would alter truth outside PIXIE LAB:
- approve;
- request revision;
- reject.

GO is not required to supervise every internal PIXIE step.

### LIGHT
LIGHT remains the Notion agent. LIGHT is not PIXIE's supervisor and its Notion-oriented copilot behavior is not copied wholesale into PIXIE.

Useful discipline from the LIGHT learning work may be reused where it is generic:
- resume from persisted state rather than restart;
- explicit state transitions;
- tool errors are not completion;
- evidence/readback before declaring success;
- Work ID and Checkpoint continuity.

## 3. Lab-owned space

PIXIE may act without GO approval while effects remain Lab-owned.

Examples:
- create/edit/delete experiment drafts;
- create variants;
- create/debug logic drafts;
- create or replay Golden Cases;
- create bug capsules;
- run self-tests;
- branch lab experiments;
- update lab memory candidates;
- change lab-local prioritization or next-action selection;
- refine internal methods and heuristics;
- manipulate sandbox or simulation state that is not external truth.

Lab autonomy must not silently gain external authority.

## 4. External Truth

A change crosses the boundary when it would alter state relied on outside PIXIE LAB.

External Truth includes at minimum:
- source code or repository state outside lab-owned experimental state;
- production or deployed runtime state;
- GO Hub / Centre durable Work state;
- ownership, holder, lease, authority or permission state;
- routes, gates, connector configuration or canonical registry state;
- merge or deploy state;
- external communication or third-party side effects;
- canonical learning or policy that changes how external systems act.

Read-only observation of external truth is not itself an external truth mutation.

## 5. Single decision boundary

PIXIE must not ask GO before every mutation. Internal Lab mutations are autonomous.

PIXIE asks GO only when it has a proposed external change.

The boundary is represented by a GO Decision Packet.

### GO Decision Packet

A packet must contain:
- packetId;
- source Work ID and Checkpoint ID when available;
- target system / target truth;
- proposed change;
- reason;
- evidence references;
- expected result;
- observed lab result;
- diff or equivalent change description;
- risk / unknowns;
- rollback or safe-stop strategy;
- Golden Case / regression references when relevant;
- idempotency key when external side effects are possible.

Decision states:
- PENDING_GO;
- APPROVED;
- REVISE;
- REJECTED;
- EXPIRED.

No external mutation may execute from PENDING_GO, REVISE, REJECTED or EXPIRED.

## 6. Autonomous Lab Loop

The default loop is:

1. OBSERVE
2. PLAN
3. EXPERIMENT
4. DEBUG / TEST
5. REPLAY GOLDEN
6. SELF-TEST
7. LEARN
8. SELECT NEXT LAB ACTION

PIXIE repeats this loop autonomously while it remains Lab-owned.

When PIXIE believes an external change is ready:

9. PREPARE GO DECISION PACKET
10. WAIT FOR GO
11. If APPROVED: hand the approved external action to the governed execution path.
12. If REVISE: return to the Lab loop with GO feedback.
13. If REJECTED: archive the proposal and continue other Lab work.

Approval of one packet does not grant standing external authority.

## 7. Learning model

PIXIE may learn autonomously inside the Lab.

Learning has two layers:

### Lab Learning
May become active inside PIXIE LAB without GO approval when it changes only Lab-local methods.

Examples:
- test ordering;
- experiment selection heuristics;
- debug strategy;
- evidence grouping;
- Golden Case selection;
- local workbench workflow.

### External-impact Learning
If a learned rule would change external behavior, canonical routing, production decisions, authority, or external mutation policy, it must become a GO Decision Packet before activation outside the Lab.

The current behavior where PIXIE can promote Lab-wide learning directly should be preserved only for genuinely Lab-local learning. External-impact promotion must require GO final decision.

## 8. Durable execution and evidence discipline

PIXIE autonomous work must be resumable.

Requirements:
- durable session/debug/experiment identity;
- resume from the last persisted step after interruption;
- no repeated external side effect on resume;
- idempotency key for external-effect attempts;
- tool errors produce FAILED/BLOCKED/UNKNOWN, never COMPLETE;
- Work ID and Checkpoint ID remain stable across handoff and readback;
- external success requires destination readback or equivalent evidence;
- expected and observed outcomes remain distinct.

## 9. Existing primitives to reuse

The design should compose existing PIXIE primitives rather than create a second authority stack.

Current useful primitives include:
- Debug / Inspection workbench;
- Coding workbench;
- Runtime workbench;
- Golden Cases and replay;
- bug capsules;
- GO Attention;
- learning proposals;
- production handoff;
- owner decision projection;
- door guard;
- external-effect distinction for coding_apply and runtime_action;
- no-external-authority assertions.

Implementation should prefer extending these primitives over introducing parallel replacements.

## 10. UI / operator view

PIXIE should not behave like a greeting mascot.

The operator surface should answer four questions:
- What is PIXIE doing now?
- What did PIXIE find?
- What will PIXIE do next?
- What is waiting for GO?

The GO queue should show Decision Packets, not every internal Lab action.

## 11. Failure and safety behavior

- UNKNOWN never falls back to legacy executable behavior.
- A failed tool call is not success.
- Missing evidence lowers confidence; it does not fabricate truth.
- External mutation without APPROVED packet is blocked.
- Approved packet execution must use the normal governed external path.
- PIXIE cannot approve its own external Decision Packet.
- Approval does not transfer merge/deploy/owner authority to PIXIE.
- Historical evidence may remain readable without becoming executable authority.

## 12. Initial implementation seams

Likely existing seams to extend:
- pixie-lab-v1/pixie-lab/core.mjs
- pixie-lab-v1/pixie-lab/service.mjs
- pixie-lab-v1/pixie-lab/command.mjs
- pixie-lab-v1/pixie-lab/owner-view.mjs
- pixie-lab-v1/pixie-lab/workbench-floor.mjs
- pixie-lab-v1/ui/app.js
- related contract, command, workbench and failure-path tests

Implementation details are intentionally deferred until the implementation plan stage.

## 13. Acceptance criteria

The design is satisfied when:

1. PIXIE can continue a Lab task without GO choosing every next step.
2. Lab-only changes do not require GO approval.
3. Any external truth mutation requires one explicit GO Decision Packet approval.
4. PIXIE cannot self-approve that packet.
5. External execution uses the existing governed path and preserves Work/Checkpoint continuity.
6. Resume does not repeat completed external side effects.
7. Tool errors cannot be reported as completion.
8. External success requires readback/evidence.
9. Lab-local learning can evolve autonomously.
10. Learning that affects external truth cannot activate externally without GO approval.
11. LIGHT remains the Notion agent and no duplicate LIGHT/PIXIE authority is created.
12. UI surfaces current activity, findings, next action and pending GO decisions without requiring a greeting flow.

## 14. Non-goals

This design does not:
- grant PIXIE merge or deploy authority;
- make PIXIE owner of GO Hub, Centre, Notion, or Factory truth;
- require GO approval for every internal mutation;
- replace LIGHT;
- create a new supervisor agent;
- make historical/legacy paths executable again;
- define implementation code before the plan is reviewed.

## 15. Design principle

PIXIE should be free enough to become better at its job, but it must know when its work stops being an experiment and starts becoming somebody else's truth.

That moment is the GO boundary.
