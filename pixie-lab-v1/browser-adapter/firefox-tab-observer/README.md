# ERGASTERION Factory Eye — Firefox Tab Observer

Neutral Firefox WebExtension for the Runtime Workbench.

## What it does

- inventories every open Firefox tab at tab level
- reports tab id, window id, URL, title, active/pinned/audible/status
- observes HTTP/HTTPS page structure through a neutral content observer
- captures the currently visible active-tab screenshot when Firefox allows it
- sends observations over HTTPS to the owner-paired GO Hub Factory Eye bridge
- keeps the remote bridge **eyes-only** in v0.2.2
- stores only the issued Factory Eye session id/token/expiry; the owner passcode is never stored
- reports stale/disconnected reality instead of pretending the eye is live

It contains **no site-specific profile**.

## Privacy boundary

The page observer reports structure and labels, not field values.

It does not capture:
- password values
- OTP values
- payment field values
- ordinary input/textarea/select values

Firefox privileged pages that normal extensions cannot inspect are reported as unsupported/partial rather than faked as observed.

## Remote Hub bridge — Firefox Android

v0.2.2 uses the dedicated neutral Factory Eye ingress:

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

Remote navigate/click/type/scroll are not declared available in v0.2.2.

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

AMO will not accept the same extension version twice. After a successful signing of `0.2.0`, remote-bridge source moved to `0.2.1`; every changed source that needs another AMO signing must continue to bump the manifest version.

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

Firefox for Android can suspend or kill idle extension background/event processes. Factory Eye v0.2.2 therefore does not treat background timers as the only liveness source.

When an ordinary HTTP/HTTPS page is visible, the content observer sends a sanitized foreground pulse every 8 seconds and immediately on `pageshow` / returning to `visible`. That message wakes the extension event page, which validates the sender tab and same-origin page summary before forwarding a fresh observation to GO Hub.

This pulse:
- never reads ordinary input values
- does not add click/type/navigation authority
- only runs for visible HTTP/HTTPS content
- retries naturally after Android suspends the background process
