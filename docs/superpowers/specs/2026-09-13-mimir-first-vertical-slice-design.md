# MIMIR First Vertical Slice — Design Spec

Date: 2026-09-13
Status: Owner-approved design direction
Owner: BIG

## Purpose
Build the smallest real MIMIR / GO Catalog slice using one shared capability registry for GO and a thin viewer.

## Flow
`Task -> MIMIR Query -> Registry -> Gate -> PASS/WAIT -> Route -> GO`

## Required record concepts
- name
- type
- capability
- surface
- installation state
- permission
- callable actions
- availability
- constraints
- route
- block reason
- verified date
- modified date
- source

Capability, callable action, permission, and availability must remain separate.

## Gate
Interpret task with 5W, then apply IF gate. If a decision-critical condition is missing or blocked, return WAIT with an explicit reason instead of guessing.

Minimum WAIT reasons: UNKNOWN, CONFLICT, NEED_AUTHORITY, NEED_SOURCE, MISSING_DECISION_CRITICAL_FIELD, UNAVAILABLE, MISSING_CALLABLE_ACTION, BLOCKED.

## First proof record
Use GitHub as the first real capability record. Current verified target repo: `pureekangraw-ops/Go-Calalog-`. Current surface facts must be time-stamped and must not be treated as permanent truth.

## Thin viewer
The viewer reads the same registry. It only needs list/search, record detail, status fields, and inspection of a sample query result. It owns rendering, not routing logic.

## Out of scope
No autonomous execution, queue/worker system, memory engine, continuity engine, five independent stores, rating/history subsystem, speculative API layer, or large UI.

## Success
A real GitHub task intent is queried; MIMIR finds the capability record; gate checks availability, required action, and permission; returns PASS+route or WAIT+reason; GO and BIG inspect the same underlying record/result.

## Brakes
MERGE BEFORE MULTIPLY. API Last. Context != Command. Unknown remains unknown. Architecture/requirements/authority changes require Owner Gate. Do not claim success before a real flow is verified.
