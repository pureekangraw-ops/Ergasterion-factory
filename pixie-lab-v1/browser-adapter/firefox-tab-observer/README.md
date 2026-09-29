# ERGASTERION Factory Eye — Firefox Tab Observer

Neutral Firefox WebExtension for the Runtime Workbench.

## What it does

- inventories every open Firefox tab at tab level
- reports tab id, window id, URL, title, active/pinned/audible/status
- observes HTTP/HTTPS page structure through a neutral content observer
- captures the currently visible active-tab screenshot when Firefox allows it
- sends observations to the local Factory bridge
- receives queued Runtime actions from the Factory
- currently executes only:
  - `activate_tab`
  - `navigate`
  - `observe_tab`
- records receipts and follows execution with a fresh observation when possible

It contains **no site-specific profile**.

## Privacy boundary

The page observer reports structure and labels, not field values.

It does not capture:
- password values
- OTP values
- payment field values
- ordinary input/textarea/select values

Firefox privileged pages that normal extensions cannot inspect are reported as unsupported/partial rather than faked as observed.

## Local bridge

Default Factory endpoint:

```text
http://127.0.0.1:4317
```

Start the Factory first:

```bash
cd pixie-lab-v1
npm run factory
```

## Temporary Firefox test

On Firefox desktop:

1. Open `about:debugging`
2. Choose **This Firefox**
3. Choose **Load Temporary Add-on**
4. Select this directory's `manifest.json`
5. Open any ordinary HTTP/HTTPS website
6. Open a second website on a different domain
7. Open the ERGASTERION Runtime Workbench

Acceptance for the first neutral-eye test:

- both tabs appear in **FIREFOX TABS**
- the active tab is identified correctly
- its URL/title are current
- page summary comes from the active tab
- a screenshot appears when Firefox permits capture
- switching tabs creates a new observation without changing extension code
- `runtime_view` reads the observation written by the browser bridge

A website-specific helper may be added later as an optional profile layer, but it must not change this core observer contract.


## Mozilla signing for Firefox Stable / Android

Firefox Stable requires Mozilla-signed extensions for normal installation.

ERGASTERION uses a manual GitHub Actions workflow:

```text
.github/workflows/factory-eye-sign.yml
```

The workflow signs **only from `main`** and always uses the AMO **unlisted** channel. It does not publish Factory Eye as a public AMO listing.

### One-time repository setup

Create Mozilla Add-ons API credentials for the account that owns this extension ID, then add these GitHub Actions repository secrets:

```text
FIREFOX_JWT_ISSUER
FIREFOX_JWT_SECRET
```

Never commit either value to the repository.

### Sign

Run the GitHub Actions workflow:

```text
Firefox Factory Eye — AMO Sign
```

Select `main` and run it manually.

The workflow:
1. refuses non-main refs
2. reads the extension ID + version from `manifest.json`
3. checks the AMO secrets exist
4. runs Mozilla `web-ext@10.7.0 lint`
5. requests AMO v5 **unlisted** signing
6. downloads the Mozilla-signed XPI
7. writes `factory-eye-signed-provenance.json`
8. uploads both files as a GitHub Actions artifact

Expected artifact name:

```text
ergasterion-factory-eye-v<version>-signed
```

### Version rule

AMO will not accept the same extension version twice. After a successful signing of `0.2.0`, any changed source that needs another signing must first bump the manifest version.

### Acceptance boundary

A successful AMO signing proves only that Mozilla accepted and signed the package.

Factory Eye is accepted as the real Runtime eye only after physical Firefox testing proves:
- multiple different HTTP/HTTPS domains appear at tab level
- active-tab identity is correct
- page observation changes when the active tab changes
- Runtime Workbench reads the same current observation
- screenshot/readback reflects the active page
- unsupported Firefox pages remain UNKNOWN/UNSUPPORTED rather than fabricated PASS
