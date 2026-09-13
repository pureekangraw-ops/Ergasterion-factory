# OWNER LOGIC SEAL V1 — Design Spec

Date: 2026-09-13
Status: Owner-approved design direction
Owner: BIG
Target: MIMIR mobile proof first

## Purpose
Prove that MIMIR can distinguish a capability record that merely exists from one whose critical logic provenance is trusted. The goal is not to hide common algorithms. The goal is to make copying code insufficient to impersonate the canonical system.

Core principle:
`Copy Code != Copy System`

Development principle:
`Prove the Core -> Seal the Logic -> Expand the Surface -> Orchestrate the Metropolis`

## Scope
V1 applies OWNER LOGIC SEAL only to the existing MIMIR mobile proof. It does not establish a universal protocol yet. A successful MIMIR proof may later be promoted into a shared YGGDRASIL standard through a separate Owner Gate.

## Responsibilities
MIMIR answers: what capability exists, where it is, whether the current surface can use it, and which route applies.

OWNER LOGIC SEAL answers: whether the critical logic/provenance presented to MIMIR is the canonical trusted lineage expected by the Owner.

Neither component becomes a second brain. GO remains the thinker and decision-maker.

## Trust Model
A sealed record carries a `logicSeal` object with:
- `ownerId` — canonical owner identifier for this proof
- `logicVersion` — version of the sealed logic contract
- `sourceCommit` — source revision associated with the proof
- `integrityDigest` — integrity claim for the sealed payload
- `signer` — identity/role asserting the proof
- `verificationState` — `VERIFIED`, `UNVERIFIED`, `MISMATCH`, or `UNKNOWN`
- `verifiedAt` — when the seal state was verified

V1 does not claim that a client-side JavaScript digest or metadata field is tamper-proof. These fields prove the contract and gate behavior first. Strong cryptographic signing, protected keys, remote authority, and build attestation are explicitly deferred.

## Gate Integration
Existing capability checks remain separate from seal checks.

Flow:
`Task -> MIMIR Query -> Registry -> Capability Gate -> Logic Seal Gate -> PASS/WAIT -> Route -> GO`

A route may PASS only when the existing capability gate passes and the logic seal gate returns trusted.

Minimum seal WAIT reasons:
- `SEAL_UNKNOWN` — seal state cannot be established
- `SEAL_UNVERIFIED` — seal exists but has not been verified
- `SEAL_MISMATCH` — presented lineage/integrity does not match the expected canonical claim
- `SEAL_MISSING` — decision-critical seal fields are absent

Fail closed: a missing, unknown, unverified, or mismatched seal must never silently become PASS.

## Canonical Proof Contract
For V1, `VERIFIED` means only that the static proof record contains the complete Owner-approved seal contract and matches the expected values embedded in the proof verifier. It does not mean cryptographic authenticity against a privileged attacker.

This distinction must be visible in the viewer so simulation/proof metadata cannot be mistaken for production security.

## Viewer
The mobile viewer adds a compact Owner Logic Seal section showing:
- owner
- logic version
- source commit
- integrity digest/claim
- signer
- verification state
- verified date

Query output evidence also exposes `logicSeal` and the exact seal WAIT reason when blocked.

## Mobile Proof Cases
The Owner must be able to exercise at least these cases on the phone:
1. Valid sealed GitHub capability -> `PASS` when capability/action/permission/availability also pass.
2. Existing capability with required action missing -> existing `WAIT: MISSING_CALLABLE_ACTION`; seal does not erase capability-gate semantics.
3. Matching capability with `UNVERIFIED` seal -> `WAIT: SEAL_UNVERIFIED`.
4. Matching capability with mismatched seal -> `WAIT: SEAL_MISMATCH`.
5. Unknown capability -> existing `WAIT: UNKNOWN`.

## Error and Epistemic Rules
- Unknown stays unknown.
- Capability, callable action, permission, availability, and seal verification remain separate facts.
- Runtime safety rejection is not automatically a seal failure.
- A seal failure is not automatically a permission failure.
- Evidence must show why a WAIT occurred.

## Out of Scope
Do not add in V1:
- private signing keys in browser code
- claims of anti-copy or anti-tamper security against privileged attackers
- server/backend/API
- Android APK signing pipeline
- remote attestation
- release/build provenance service
- universal cross-app protocol
- autonomous execution
- worker orchestration
- database

## Security Boundary
Client-side code can be copied or patched by a sufficiently privileged attacker. V1 therefore proves trust semantics and fail-closed routing, not unforgeable security. Strong authenticity later requires a trust anchor the modified client cannot forge, such as protected signing authority and verifiable build/release provenance.

## Success Criteria
V1 succeeds only when:
- MIMIR still preserves its existing PASS/WAIT semantics;
- seal state is visible separately from permission/availability/action;
- trusted seal permits routing only after all earlier gates pass;
- missing/unverified/mismatched seal fails closed with an explicit reason;
- BIG verifies the proof cases on the mobile viewer;
- no production-security claim is made from static metadata alone.

## Design Brakes
- Mobile = Core Proof Environment
- Desktop = Operational Expansion Environment
- MERGE BEFORE MULTIPLY
- API Last
- Context != Command
- Copy Code != Copy System
- architecture/authority changes require Owner Gate
- prove before promoting this into a shared YGGDRASIL standard
