# HERMES — Agent Mission Lab

HERMES is the experimental mission-flow logic for the future Agent Mission room.

This implementation lives only inside PIXIE LAB. It does not alter GO Hub, Centre, Heimdall, Factory, PYRO, or production runtime.

## Purpose

HERMES is the lightweight entrance/exit logic for an agent mission:

ENTER → RESOLVE CARD → SELECT CONTEXT → FIRST-OPEN HANDOFF → WORK → RETURN CARD → UPDATE REALITY → EXIT

## Rules under test

1. **No board in Agent Mission.**
   HERMES may rank similar Mission Cards, but it does not expose or manage a project Board.

2. **Entrance is not a gate.**
   Entering creates a mission session. HERMES does not approve the agent.

3. **Reuse before create.**
   HERMES ranks similar cards first so an agent can continue an existing mission instead of duplicating work.

4. **Context is explicit.**
   Candidate context can be loaded, but only context selected by GO is written into the Mission Card.

5. **LIGHT is context support only.**
   HERMES can create a LIGHT request and receive candidate context. LIGHT cannot silently mutate the card or open a workspace.

6. **Heimdall is first-open only.**
   HERMES creates a first-open request when the mission needs a destination/workspace. The card creates no authority.

7. **Mission Card is portable memory.**
   Touching the card at another station reveals only the selected mission context, notes, route, and latest reality.

8. **No exit without return.**
   Every session must return its card with an updated Reality revision before HERMES allows EXIT.

9. **Interrupted sessions use Recovery Return.**
   A crashed/abandoned session is returned with WAIT + SESSION_INTERRUPTED so the next room sees the latest known state.

10. **No production authority.**
    This is a lab prototype and does not merge, deploy, mutate GO Hub, or replace Heimdall.

## Deliberately absent

- Board management
- Project management UI
- Evidence verdicts
- Debug/test/CI diagnosis
- Production merge/deploy authority
- PYRO forge logic
