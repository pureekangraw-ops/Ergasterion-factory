# MIMIR Static Mobile Deviation

Date: 2026-09-13
Owner: BIG
Status: APPROVED

BIG approved a mobile-first deviation from the Node-first implementation plan.

V1 proof will be one self-contained static HTML app with one embedded structured capability registry. The viewer and PASS/WAIT gate must read the same registry data. No backend, database, framework, remote API, queue, or autonomous agent.

Manual mobile verification by BIG replaces automated runtime verification for this proof only. V1 must not be called verified until BIG confirms: app opens; GitHub record appears; search works; update_file probe returns PASS with route/evidence; star_repository probe returns WAIT/MISSING_CALLABLE_ACTION; capability, callable action, permission, and availability remain visibly separate.

Automated Node/TDD hardening is deferred until an execution runtime is available. The approved design spec remains binding for product behavior.
