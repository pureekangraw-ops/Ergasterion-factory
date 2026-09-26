# ROOM-D — PIXIE-D

This branch is the **room trunk** for ROOM-D. Treat it like the room's mini-main.

## Room role

- Role: `DEBUG`
- Purpose: Dedicated inspection/debug room for root-cause analysis and preparing governed handoff candidates without executing them.
- Guiding question: Where is the first break, what evidence proves it, and what is the smallest governed next action?

## Development rule

```
room/pixie-d
  ↑
feature/<room-task>
  ↑
local experiments
```

Feature work for this room should branch from `room/pixie-d` and merge back into `room/pixie-d`.
It does **not** promote to repository `main` automatically.

Promotion to `main` is a separate explicit decision.

## Local Pixie

This room owns a small Pixie logic layer under `pixie-lab-v1/room-trunk/`.

It accepts `PIXIE_ROOM_COMMAND_V1` and returns `PIXIE_ROOM_RESULT_V1`.

The room can plan, reason locally, preserve UNKNOWNs, and produce a candidate.
It cannot merge, deploy, write to production, widen authority, or mutate GO Hub.

`approval: NOT_AN_APPROVAL`
