# ROOM-B — PIXIE-B

This branch is the **room trunk** for ROOM-B. Treat it like the room's mini-main.

## Room role

- Role: `STRESS`
- Purpose: Ordinary isolated experiment room for breaking assumptions, exercising failure paths, and exposing weak contracts.
- Guiding question: How can this fail, lie, go stale, or cross a boundary it should not cross?

## Development rule

```
room/pixie-b
  ↑
feature/<room-task>
  ↑
local experiments
```

Feature work for this room should branch from `room/pixie-b` and merge back into `room/pixie-b`.
It does **not** promote to repository `main` automatically.

Promotion to `main` is a separate explicit decision.

## Local Pixie

This room owns a small Pixie logic layer under `pixie-lab-v1/room-trunk/`.

It accepts `PIXIE_ROOM_COMMAND_V1` and returns `PIXIE_ROOM_RESULT_V1`.

The room can plan, reason locally, preserve UNKNOWNs, and produce a candidate.
It cannot merge, deploy, write to production, widen authority, or mutate GO Hub.

`approval: NOT_AN_APPROVAL`
