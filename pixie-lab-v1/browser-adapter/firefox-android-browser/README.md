# ERGASTERION Browser — Android GeckoView Shell

Android GeckoView shell for the ERGASTERION browser work. This app is the browser surface; **Factory Eye / Browser Observer remains the sibling Firefox WebExtension** at:

```text
pixie-lab-v1/browser-adapter/firefox-tab-observer/
```

Do not move the observer into LIGHTHOUSE. ERGASTERION owns the observer source and package; the GO Hub Factory Eye bridge remains the remote ingress/readback boundary.

## Gate 2 scope

- installs the sibling Factory Eye WebExtension with GeckoView `WebExtensionController.ensureBuiltIn`
- copies `../firefox-tab-observer/` into APK assets at build time; the observer source is not duplicated
- opens dedicated GitHub + Cloudflare watch tabs
- keeps the browser shell separate from pairing/session/readback authority

## Current scope

- GeckoView-backed Android browser shell
- URL/search bar
- back / forward / reload
- multiple GeckoSession tabs
- explicit separation between browser surface and observer source
- no remote navigation, click, type, or scroll authority

The Android shell now has the Gate 2 install path. Physical Android testing is still required to prove the extension starts, observes both dedicated watch tabs, and keeps observing the non-active tab. Until then, runtime acceptance remains `UNKNOWN`.

## Open

1. Open this directory in Android Studio.
2. Sync Gradle and install Android SDK 35 if needed.
3. Run on an Android emulator or device.
4. Tap **Watch** to open the dedicated GitHub and Cloudflare watch tabs.

## Key files

- `app/src/main/java/com/example/ergasterionbrowser/MainActivity.kt` — tab and navigation shell
- `app/src/main/res/layout/activity_main.xml` — tabs, URL bar, and GeckoView
- `app/build.gradle.kts` — GeckoView dependency and Android configuration

## Next governed step

Test on Android: extension installation, owner pairing, GitHub/Cloudflare watch tabs, inactive-tab observation, redirect URL readback, and GO Hub `source=FACTORY_EYE` evidence. Keep pairing, session tokens, observation freshness, and readback owned by the existing Factory Eye bridge; the Android shell must not duplicate that authority.
