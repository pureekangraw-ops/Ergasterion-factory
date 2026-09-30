# ERGASTERION Browser — Android GeckoView Shell

Android GeckoView shell for the ERGASTERION browser work. This app is the browser surface; **Factory Eye / Browser Observer remains the sibling Firefox WebExtension** at:

```text
pixie-lab-v1/browser-adapter/firefox-tab-observer/
```

Do not move the observer into LIGHTHOUSE. ERGASTERION owns the observer source and package; the GO Hub Factory Eye bridge remains the remote ingress/readback boundary.

## Current scope

- GeckoView-backed Android browser shell
- URL/search bar
- back / forward / reload
- multiple GeckoSession tabs
- explicit separation between browser surface and observer source
- no remote navigation, click, type, or scroll authority

The Android shell is not yet a claim that Factory Eye is physically attached to this custom GeckoView runtime. That requires a separate GeckoView WebExtension installation/bridge test. Until then, Runtime evidence remains `UNKNOWN` rather than being inferred from the shell.

## Open

1. Open this directory in Android Studio.
2. Sync Gradle and install Android SDK 35 if needed.
3. Run on an Android emulator or device.
4. Use the sibling Firefox WebExtension for the current Factory Eye / Browser Observer path.

## Key files

- `app/src/main/java/com/example/ergasterionbrowser/MainActivity.kt` — tab and navigation shell
- `app/src/main/res/layout/activity_main.xml` — tabs, URL bar, and GeckoView
- `app/build.gradle.kts` — GeckoView dependency and Android configuration

## Next governed step

Add a GeckoView `WebExtensionController` host only after the Factory Eye extension contract is tested in this runtime. Keep pairing, session tokens, observation freshness, and readback owned by the existing Factory Eye bridge; the Android shell must not duplicate that authority.
