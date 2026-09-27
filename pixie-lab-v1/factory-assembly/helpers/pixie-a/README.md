# ROOM-A — PIXIE-A

This branch is the **room trunk** for ROOM-A. Treat it like the room's mini-main.

## Room role

- Role: `EXPLORE`
- Purpose: Ordinary isolated experiment room for exploring an idea, intent, or command before any production route exists.
- Guiding question: What is this trying to become, and what can we learn safely inside the room?

## Development rule

```
room/pixie-a
  ↑
feature/<room-task>
  ↑
local experiments
```

Feature work for this room should branch from `room/pixie-a` and merge back into `room/pixie-a`.
It does **not** promote to repository `main` automatically.

Promotion to `main` is a separate explicit decision.

## Local Pixie

This room owns a small Pixie logic layer under `pixie-lab-v1/room-trunk/`.

It accepts `PIXIE_ROOM_COMMAND_V1` and returns `PIXIE_ROOM_RESULT_V1`.

The room can plan, reason locally, preserve UNKNOWNs, and produce a candidate.
It cannot merge, deploy, write to production, widen authority, or mutate GO Hub.

`approval: NOT_AN_APPROVAL`
