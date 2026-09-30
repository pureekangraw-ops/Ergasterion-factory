# ERGASTERION Factory Eye — Firefox Tab Observer

Neutral Firefox WebExtension for the Runtime Workbench.

## What it does

- inventories every open Firefox tab at tab level
- reports tab id, window id, URL, title, active/pinned/audible/status
- observes HTTP/HTTPS page structure through a neutral content observer
- captures the currently visible active-tab screenshot when Firefox allows it
- sends observations over HTTPS to the owner-paired GO Hub Factory Eye bridge
- keeps the remote bridge **eyes-only** in v0.4.0
- stores only the issued Factory Eye session id/token/expiry; the owner passcode is never stored
- reports stale/disconnected reality instead of pretending the eye is live

It contains **no site-specific DOM profile**; dedicated watch mode uses only an explicit host allowlist.

## Privacy boundary

The page observer reports bounded structure and labels, not field values.

It does not capture:
- password, OTP, token, secret, or payment values
- ordinary input/textarea/select/contenteditable values
- unrestricted raw DOM or image bytes

Form/private-editor subtrees are excluded from semantic text, list, table, and image summaries. Visible text that matches common credential/card patterns is dropped. Firefox privileged pages that normal extensions cannot inspect are reported as unsupported/partial rather than faked as observed.

## Semantic page summary v2

The observer contract is `ERGASTERION_BROWSER_PAGE_SUMMARY_V2`. In addition to the existing tabs, URL/title, headings, buttons, links, fields, landmarks, screenshot, freshness, and Workbench evidence flow, it reports bounded:

- `sections` with role, label, heading, and parent-section relationships
- `textBlocks` for meaningful visible paragraphs and text blocks
- `lists` with ordered/unordered type and bounded item summaries
- `tables` with optional caption and bounded row/cell summaries
- `images` with alt, caption, decorative, and safe context metadata; image bytes and source URLs are not captured
- `states` plus button state for ARIA-selected, expanded, pressed, and current/active state
- `contentGeneration`, a stable semantic fingerprint excluding capture time
- `semanticDiff`, when a prior snapshot exists, for bounded text, section, state, URL/title, and meaningful structural changes

All collection limits are fixed in the content observer. Section and item IDs are snapshot-local; cross-observation continuity is represented by `contentGeneration`, not by raw DOM identity.

## Remote Hub bridge — Firefox Android

v0.4.0 uses the dedicated neutral Factory Eye ingress:

```text
https://go-hub.pureekangraw.workers.dev/hub/api/factory-eye/*
```

This route is separate from the legacy Browser Observer route. It does **not** use GO Hub `BROWSER_POLICY`, Gumroad host allowlists, or the old Gumroad observer session schema.

### Pair once

After install or update, Factory Eye opens its options page when no valid session exists.

1. Enter the existing **GO Hub owner passcode**.
2. Tap **Pair Factory Eye**.
3. The passcode is sent only to the Hub pairing endpoint.
4. Hub issues a random Factory Eye session id/token with an expiry.
5. The add-on stores only that session id/token/expiry and begins heartbeat + observation.

The bridge is currently **eyes-only**:
- tab inventory
- active tab URL/title/state
- neutral page summary
- active visible-tab screenshot when Firefox allows capture

Remote navigate/click/type/scroll are not declared available in v0.4.0.

### Readback

GO Hub's existing read surface stays canonical:

```text
go_hub_observer_latest
go_hub_observer_screenshot
```

When Factory Eye exists, readback returns `source=FACTORY_EYE` and `legacyBrowserPolicyUsed=false`. If Factory Eye has never been paired, the read surface may fall back to the legacy observer.

## Mozilla signing for Firefox Stable / Android

Firefox Stable requires Mozilla-signed extensions for normal installation.

**Signing ownership lives in GO Hub**, because the existing AMO credentials are already held there. ERGASTERION owns the Factory Eye source and package; Hub only signs that verified source.

Canonical signer workflow:

```text
pureekangraw-ops/prytaneion-workspace
.github/workflows/ergasterion-factory-eye-sign.yml
```

The Hub workflow:
1. runs manually with `workflow_dispatch`
2. uses the Hub's existing `AMO_SIGN_KEY` / `AMO_SIGN_SECRET`
3. checks out `pureekangraw-ops/Ergasterion-factory@main`
4. reads this manifest's extension ID + version
5. runs Mozilla `web-ext@10.7.0 lint`
6. builds the unsigned Factory Eye package
7. requests Mozilla AMO **unlisted** signing
8. writes signed provenance with Factory source SHA + signed XPI SHA-256
9. uploads the signed XPI + provenance as a GitHub Actions artifact

The signer does **not** use GO Hub Browser Policy, Gumroad allowlists, legacy browser routes, or Observer session policy.

### Version rule

AMO will not accept the same extension version twice. After a successful signing of `0.3.0`, dedicated watch mode source moved to `0.4.0`; every changed source that needs another AMO signing must continue to bump the manifest version.

### Acceptance boundary

A successful AMO signing proves only that Mozilla accepted and signed the package.

Factory Eye is accepted as the real Runtime eye only after physical Firefox testing proves:
- multiple different HTTP/HTTPS domains appear at tab level
- active-tab identity is correct
- page observation changes when the active tab changes
- Runtime Workbench reads the same current observation
- screenshot/readback reflects the active page
- unsupported Firefox pages remain UNKNOWN/UNSUPPORTED rather than fabricated PASS


## Firefox Android foreground wake

Firefox for Android can suspend or kill idle extension background/event processes. Factory Eye v0.4.0 therefore does not treat background timers as the only liveness source.

When an ordinary HTTP/HTTPS page is visible, the content observer sends a sanitized foreground pulse every 8 seconds and immediately on `pageshow` / returning to `visible`. That message wakes the extension event page, which validates the sender tab and same-origin page summary before forwarding a fresh observation to GO Hub.

This pulse:
- never reads ordinary input values
- does not add click/type/navigation authority
- only runs for visible HTTP/HTTPS content
- retries naturally after Android suspends the background process



## Dedicated watch mode — GitHub + Cloudflare

Factory Eye v0.4.0 adds an explicit, bounded watch set for the custom Android browser shell:

- `github.com/pureekangraw-ops/Ergasterion-factory`
- `dash.cloudflare.com`

The Android shell opens these as dedicated watch tabs after the built-in extension is installed. The observer keeps submitting bounded page summaries for matching tabs even when they are not active. Inactive watch observations do not include a screenshot and are not promoted to the current active view; they remain watch evidence for Runtime/Factory readback.

This is a host allowlist for dedicated watch tabs, not a site-specific DOM profile. The observer still captures no input values and declares no remote interaction authority.

## Fresh observation contract

Factory Eye v0.4.0 treats a visible-page heartbeat as a candidate observation, not proof by itself.

A web observation is accepted as current only when:
- the content script reports the same generation as the installed add-on
- the sender tab is still an actually active browser tab
- the page is visible
- the sanitized page summary declares that it captured no input values and creates no authority

The GO Hub side applies the final freshness barrier by checking the active tab, observation age, and script generation before reporting LIVE. Old evidence can remain available for audit, but it must not be represented as the current view.
