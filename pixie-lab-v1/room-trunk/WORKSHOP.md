# PIXIE Workshop Toolkit

A/B/C are the free-play workshop for GO + PIXIE.

This toolkit is intentionally implemented from a clean contract, not copied from Factory behavior.

## Built-in capabilities

- inspect repository
- read file
- compare refs/diffs
- create feature branch
- write file
- delete file
- run tests
- read CI
- read failure evidence
- open PR
- merge inside A/B/C
- snapshot
- rollback
- record lessons
- emit evidence
- extension hooks for future room tools

## Boundary

Anything under `room/pixie-a|b|c` and `feature/room-a|b|c-*` is workshop space.
`main`, production, deploy, secrets, and external authority are not workshop tools.

Inside A/B/C the toolkit carries no Factory gate/policy semantics. The host only supplies concrete I/O.
