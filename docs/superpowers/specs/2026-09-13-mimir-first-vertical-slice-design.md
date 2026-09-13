# MIMIR First Vertical Slice — Design Spec

Date: 2026-09-13
Status: Owner-approved design direction; implementation not started
Owner: BIG

## Purpose
Build the smallest real MIMIR / GO Catalog slice that proves one shared capability registry can serve both GO and a thin human-visible viewer.

MIMIR is not a second brain. It retrieves, filters, exposes current capability state, and routes GO toward an actually usable capability. GO remains the thinker and decision-maker.

## Requested Result
Given a task intent, GO can ask MIMIR and receive an answer to these questions:
- what relevant capability exists?
- where is it available?
- is it currently usable?
- what callable action is exposed?
- is permission sufficient?
- if blocked or unclear, why?
- what route should GO use next?

BIG must be able to inspect the same underlying record/result through a thin viewer. There must not be a separate UI truth and backend truth.

## Architecture
One shared registry is the source of truth.

Flow:
`Task -> MIMIR Query -> Registry -> Gate -> PASS/WAIT -> Route -> GO`

The viewer reads the same registry and renders the same state. Rendering belongs to the viewer; retrieval/gating/routing belongs to MIMIR.

## Core Record
Each capability record in V1 must support:
- `name`
- `type`
- `capability`
- `surface`
- `installationState`
- `permission`
- `callableActions`
- `availability`
- `constraints`
- `route`
- `blockReason`
- `verifiedAt`
- `modifiedAt`
- `source`

These concepts must remain separate:
- Capability = can it do or know how?
- Callable Action = does an executable action exist on the current surface?
- Permission = is GO authorized to execute it?
- Availability = is it connected and usable now?

Never collapse these into one permanent can/cannot boolean.

## 5W + IF + WAIT
Interpret the task using the project primitives:
- WHAT = requested capability/object
- WHERE = source, surface, location, route
- WHEN = current, verified, modified, stale/version state
- WHO = principal/authority context when relevant
- WHY = intent and requested result

Then apply:
`5W -> IF -> WAIT/Pass -> Route`

WAIT is an explicit routed state, not a crash and not a dead end.

Minimum WAIT reasons:
- `UNKNOWN`
- `CONFLICT`
- `NEED_AUTHORITY`
- `NEED_SOURCE`
- `MISSING_DECISION_CRITICAL_FIELD`
- `UNAVAILABLE`
- `MISSING_CALLABLE_ACTION`
- `BLOCKED`

Unknown stays unknown. Permission, authority, availability, and callable exposure must never be inferred from labels or names.

## Query Contract
V1 input should carry at least:
- `intent`
- `requestedResult`
- optional `requiredAction`
- optional current `surface`
- optional authority context

V1 output should carry at least:
- matched capability record(s)
- gate status: `PASS` or `WAIT`
- WAIT reason when relevant
- selected route
- evidence/source metadata needed for verification

No autonomous execution is added in this slice.

## First Real Proof Record
Use GitHub as the first real capability record because current connector reality is already observable.

Current facts for the first proof include:
- target repository: `pureekangraw-ops/Go-Calalog-`
- current ChatGPT GitHub connector surface
- repository permissions observed: admin, maintain, pull, push, triage
- callable actions must include only actions actually exposed on the current surface
- Star/Unstar was not exposed at the last verification
- verified date: 2026-09-13

All of these are time-sensitive facts. They must be stored with verification time and must not become eternal truth in code.

## Gate Behavior
Gate before preference or rating.

A candidate must not win if the required action is missing, the capability is unavailable, or permission is insufficient.

Examples:
- capability exists + required callable action exists + permission sufficient + available -> `PASS`
- capability exists + action missing -> `WAIT: MISSING_CALLABLE_ACTION`
- capability exists + surface disconnected -> `WAIT: UNAVAILABLE`
- action exists + authority required but not established -> `WAIT: NEED_AUTHORITY`
- evidence conflicts -> `WAIT: CONFLICT`

## Thin Viewer
Viewer V1 only needs:
- list/search registry records
- detail view for one record
- visible availability
- visible permission
- visible callable actions
- route
- verified date
- modified date
- source
- block/wait reason
- inspection of one sample MIMIR query result

The viewer must not duplicate business logic or maintain a separate schema.

## Verification Flow
The first real end-to-end proof is:
1. submit a task intent that requires GitHub repository interaction
2. MIMIR finds the GitHub capability record
3. gate evaluates current availability, required action, and permission
4. MIMIR returns `PASS + route` or `WAIT + explicit reason`
5. GO can inspect the result
6. BIG can inspect the same underlying record/result in the viewer
7. no second source of truth is introduced

Success is claimed only after this flow is actually exercised.

## Out of Scope
Do not build in this slice:
- autonomous agent execution
- queue/worker system
- giant approval engine
- Memory engine
- Continuity engine
- five stores as separate subsystems
- rating/history/review subsystem beyond compatibility fields
- speculative API layer
- large visual UI
- speculative schema expansion

## Reuse Rule
Use existing/local capability first:
`Intent -> Requested Result -> Existing Capability? -> Reuse -> Missing Capability -> New Thing/API`

API remains last resort.

## V1 Success Criteria
GO must be able to answer from the system rather than memory:
- what does this task require?
- do we already have a capability for it?
- where is it?
- can the current surface call the required action?
- is permission/authority sufficient?
- if not, why exactly?
- what route should GO use next?

## Design Brakes
- MERGE BEFORE MULTIPLY
- API Last
- Context != Command
- capability / callable action / permission / availability remain separate
- WAIT must be explicit
- architecture, requirement, or authority changes require Owner Gate
- do not claim success before a real flow is verified
