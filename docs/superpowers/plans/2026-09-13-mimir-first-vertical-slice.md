# MIMIR First Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest real MIMIR / GO Catalog slice that lets GO query one shared capability registry, returns PASS or WAIT with a reason, routes to GitHub when valid, and lets BIG inspect the same data through a thin viewer.

**Architecture:** One checked-in JSON registry is the V1 source of truth. Node modules load/validate it, query/gate it, expose a CLI for GO, and generate a self-contained viewer from the same registry plus a sample query result. No framework, database, remote API, queue, autonomous agent, or duplicated UI schema.

**Tech Stack:** Node.js 20+, ESM, built-in `node:test`, JSON, plain HTML/CSS/JS. No third-party runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-13-mimir-first-vertical-slice-design.md`

## Global Constraints
- MERGE BEFORE MULTIPLY.
- API Last.
- Context != Command.
- Capability, callable action, permission, and availability remain separate.
- Unknown remains unknown.
- WAIT is explicit and carries a reason.
- Architecture/requirement/authority changes require Owner Gate.
- Do not claim success until the real proof flow is exercised.

## File Map
- `package.json` — ESM and scripts.
- `data/capabilities.json` — single registry source of truth.
- `src/registry.js` — load + validate records.
- `src/query.js` — match + gate into PASS/WAIT.
- `src/cli.js` — GO-facing query surface.
- `src/build-viewer.js` — generates thin viewer from same registry.
- `viewer/index.html` — generated inspection artifact.
- `test/registry.test.js` — schema tests.
- `test/query.test.js` — gate tests.
- `test/e2e.test.js` — real vertical-slice proof.
- `docs/verification/2026-09-13-mimir-v1-proof.md` — final evidence.

---

### Task 1: Shared Registry Contract

**Files:** Create `package.json`, `data/capabilities.json`, `src/registry.js`, `test/registry.test.js`.

**Interfaces:**
- `validateRecord(record) -> { ok, errors }`
- `loadRegistry(path?) -> Promise<CapabilityRecord[]>`
- Required record fields: `id`, `name`, `type`, `capability`, `surface`, `installationState`, `permission`, `callableActions`, `availability`, `constraints`, `route`, `blockReason`, `verifiedAt`, `modifiedAt`, `source`.

- [ ] Write failing tests that accept a complete GitHub record and reject records missing `permission`, `callableActions`, `availability`, or `verifiedAt`.
- [ ] Run `node --test test/registry.test.js`; expect failure because implementation does not exist.
- [ ] Implement `src/registry.js` with required-field validation and array validation for `callableActions`.
- [ ] Seed one GitHub record in `data/capabilities.json` using only currently verified facts for `pureekangraw-ops/Go-Calalog-` on the ChatGPT GitHub connector surface. Do not include Star/Unstar unless re-verified.
- [ ] Run `node --test test/registry.test.js`; expect PASS.
- [ ] Commit: `feat: add shared MIMIR capability registry`.

`package.json` must be:
```json
{
  "name": "go-catalog-mimir",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "query": "node src/cli.js",
    "build:viewer": "node src/build-viewer.js"
  },
  "engines": { "node": ">=20" }
}
```

---

### Task 2: Query Matching + Gate

**Files:** Create `src/query.js`, `test/query.test.js`.

**Interface:**
`queryMimir({ intent, requestedResult, requiredAction?, surface?, authority? }, records) -> { matches, status, waitReason, route, evidence }`

- [ ] Write failing tests for five cases: PASS, missing action, unavailable, authority needed, no match.
- [ ] Run `node --test test/query.test.js`; expect failure.
- [ ] Implement deterministic case-insensitive matching across `name`, `type`, `capability`, and `route`; prefer exact `surface` when supplied. No embeddings or remote search.
- [ ] Apply gate order exactly: no match -> `WAIT/UNKNOWN`; unavailable -> `WAIT/UNAVAILABLE`; required action absent -> `WAIT/MISSING_CALLABLE_ACTION`; permission blocked -> `WAIT/BLOCKED`; approval required without authority -> `WAIT/NEED_AUTHORITY`; otherwise -> `PASS`.
- [ ] Include `verifiedAt` and `source` in `evidence`.
- [ ] Run tests; expect PASS.
- [ ] Commit: `feat: add MIMIR query gates`.

---

### Task 3: GO-facing CLI + Real PASS/WAIT Proof

**Files:** Create `src/cli.js`, `test/e2e.test.js`.

**CLI contract:** one JSON string in `process.argv[2]`; one JSON result on stdout. PASS and WAIT both exit 0. Malformed input or invalid registry exits non-zero.

- [ ] Write failing E2E test for:
```json
{"intent":"modify repository file","requestedResult":"update a file in Go-Calalog-","requiredAction":"update_file","surface":"ChatGPT GitHub connector"}
```
Expected: GitHub selected, `status: "PASS"`, route present, evidence present.
- [ ] Add a WAIT case with `requiredAction: "star_repository"`; expect `WAIT/MISSING_CALLABLE_ACTION` unless current live verification proves that action now exists.
- [ ] Run `node --test test/e2e.test.js`; expect failure.
- [ ] Implement CLI parsing, registry loading, query call, pretty JSON output, concise stderr on malformed input.
- [ ] Run both CLI probes manually with `npm run query -- '<json>'`.
- [ ] Run `npm test`; expect all tests PASS.
- [ ] Commit: `feat: add GO-facing MIMIR query CLI`.

---

### Task 4: Thin Viewer from the Same Registry

**Files:** Create `src/build-viewer.js`, `viewer/index.html`; modify `test/e2e.test.js`.

**Rule:** browser code renders only. It must not duplicate gate logic or maintain a second schema.

- [ ] Add a failing test that builds the viewer and asserts generated HTML contains `GitHub`, `PASS`, `update_file`, `verifiedAt`, and record id `github-chatgpt-connector`.
- [ ] Run E2E test; expect failure because builder does not exist.
- [ ] Implement `src/build-viewer.js` to load the registry, run the same PASS sample query through `queryMimir`, and generate one self-contained HTML file.
- [ ] Viewer must provide client-side search over name/type/capability, a record detail panel, availability, permission, callable actions, route, verified/modified dates, source, block reason, and the sample MIMIR result.
- [ ] Run `npm run build:viewer` then `npm test`; expect success.
- [ ] Commit: `feat: add thin MIMIR registry viewer`.

---

### Task 5: Reality Check + Verification Record

**Files:** Create `docs/verification/2026-09-13-mimir-v1-proof.md`; update registry/viewer only if live reality changed.

- [ ] Re-verify GitHub callable exposure before final proof, especially `update_file`. If live reality differs, update the registry first; do not preserve stale data to keep tests green.
- [ ] Run `npm test`; require all PASS.
- [ ] Run PASS query for `update_file` and WAIT query for Star/Unstar unless newly verified.
- [ ] Run `npm run build:viewer` and inspect generated output.
- [ ] Write verification record with exact commands, PASS output summary, WAIT output summary, verification timestamp/source, remaining Unknown/Conflict, and confirmation that no autonomous execution or second registry source was introduced.
- [ ] Confirm: GO answers from system data; capability/action/permission/availability remain distinct; PASS has route; WAIT has reason; CLI and viewer derive from same registry; no new remote API/subsystem exists.
- [ ] Commit: `docs: verify MIMIR first vertical slice`.

## Completion Gate
Do not call V1 complete until Task 5 is verified against live GitHub reality. If a requirement or architecture change is discovered during implementation, stop and raise an Owner Gate instead of silently expanding scope.
