# ROOM-C — PIXIE-C

This branch is the **room trunk** for ROOM-C. Treat it like the room's mini-main.

## Room role

- Role: `VERIFY`
- Purpose: Ordinary isolated experiment room for independent verification, contradiction checks, and false-green detection.
- Guiding question: Does independent evidence agree with the claimed result, or is this a false green?

## Development rule

```
room/pixie-c
  ↑
feature/<room-task>
  ↑
local experiments
```

Feature work for this room should branch from `room/pixie-c` and merge back into `room/pixie-c`.
It does **not** promote to repository `main` automatically.

Promotion to `main` is a separate explicit decision.

## Local Pixie

This room owns a small Pixie logic layer under `pixie-lab-v1/room-trunk/`.

It accepts `PIXIE_ROOM_COMMAND_V1` and returns `PIXIE_ROOM_RESULT_V1`.

The room can plan, reason locally, preserve UNKNOWNs, and produce a candidate.
It cannot merge, deploy, write to production, widen authority, or mutate GO Hub.

`approval: NOT_AN_APPROVAL`
