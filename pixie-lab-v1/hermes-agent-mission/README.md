# HERMES — Agent Mission Lab

HERMES is the experimental mission-flow logic for the future Agent Mission room.

It lives only inside PIXIE LAB. It does not alter GO Hub production, Centre, Heimdall, Factory, PYRO, or any production runtime.

## Core flow

ENTER → FIND EXISTING CARD / REQUEST REAL CARD → SELECT CONTEXT → HEIMDALL FIRST-OPEN → WORK → RETURN REQUEST → READ BACK REAL CARD → EXIT

## Existing Hub card is canonical

HERMES does **not** invent a new Mission Card format.

The card stays in the existing GO Hub Work Card shape:

- `cardId` — e.g. `CARD:2609-H7HE`
- `workId`
- `jobCode`
- `status` — Work / Resume / Done / Cancel
- `sourceStatus`
- `destinations`
- `scope`
- `type`
- `title`
- `detail`
- `holder`
- `createdAt`
- `lastUpdated`
- optional `health` / `caution`

New cards are requested from the existing owner source (Centre). HERMES accepts the issued card only after validating this shape.

## Mission memory sidecar

The selected mission memory is stored separately and linked by the existing `cardId + workId`.

It contains only mission-specific context chosen by GO:
- mission intent
- requested result
- selected context
- notes
- LIGHT replies
- Heimdall first-open result
- latest return reality
- return history

Touching the card at another station can reveal the existing card plus this sidecar. The card itself does not create authority.

## Rules under test

1. No Board in Agent Mission.
2. Entrance is not an approval gate.
3. Existing/similar cards are shown before a new card is requested.
4. New-card identity comes from Centre, not HERMES.
5. Context candidates are not written until GO selects them.
6. LIGHT can supply candidate context but cannot silently mutate the card.
7. Heimdall is used for first-open only.
8. HERMES does not mutate Work truth directly.
9. No exit before Return Request **and** owner-source card readback.
10. Interrupted sessions use Recovery Return.
11. No production authority.
12. PYRO remains in the Factory forge and is not part of HERMES.

## Deliberately absent

- Board management
- Project dashboard
- Evidence verdicts
- Debug/test/CI diagnosis
- Production merge/deploy authority
- PYRO forge logic
