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
