# Android app — TWA wrapper + home-screen widget

A scaffold (not yet built) for two pieces of native code on top of the Printable
Calendar PWA:

1. A **Trusted Web Activity** that opens the deployed site
   (`https://danielcregg.github.io/printable-calendar-generator/`) full-screen, with
   no browser chrome.
2. A **Jetpack Glance App Widget** ("This month") showing the current month name and a
   day grid with today highlighted. Tapping the widget deep-links into the TWA.

Open this directory in **Android Studio Ladybug (2024.2.1)** or later. Everything is
modern: Kotlin, Gradle Kotlin DSL, AGP 8.x, Kotlin 2.0, Compose with the Kotlin 2.0
Compose compiler plugin, `compileSdk = 35`, `minSdk = 26`.

## What's in here

```text
android/
  app/
    src/main/
      AndroidManifest.xml                — TWA launcher activity + Glance receiver
      java/com/danielcregg/printablecalendar/
        PrintableCalendarApp.kt          — Application shell
        data/
          WidgetDataSource.kt            — Interface seam for the widget's data
          StubWidgetDataSource.kt        — Hardcoded sample data (current)
        widget/
          CalendarWidgetReceiver.kt      — AppWidgetProvider boilerplate
          CalendarWidget.kt              — Glance UI: header + Mon-first 7×N grid
      res/
        xml/widget_info.xml              — Single resizable widget (2×2 → 4×3)
        xml/{backup_rules,data_extraction_rules}.xml
        values/{strings,colors,themes}.xml
        values-night/colors.xml
        drawable/{splash,ic_launcher_*}.xml
        mipmap-anydpi-v26/ic_launcher{,_round}.xml
        layout/widget_loading.xml        — Fallback while Glance composes
    build.gradle.kts
    proguard-rules.pro
  build.gradle.kts                       — Root project
  settings.gradle.kts                    — Single :app module
  gradle.properties
  gradle/libs.versions.toml              — Version catalog (AGP, Kotlin, Glance, TWA)
  gradle/wrapper/gradle-wrapper.properties
  gradlew{,.bat}                         — Placeholder; first sync regenerates them
  digital_asset_links.json               — Placeholder (see below)
  .gitignore
  README.md                              — This file
```

## What is *stubbed* / not done

- **`WidgetDataSource` has only the stub implementation.** It returns one hand-picked
  sample label per month (St Patrick's Day, June BH, Christmas…). No actual holiday
  math, no `.ics` import, no Cloudflare-Worker integration. See the "Data integration
  TODO" section below.
- **The signing key is not generated.** `release` builds in `app/build.gradle.kts` have
  no `signingConfig` block. Until you generate a key, only `debug` builds will install.
- **`digital_asset_links.json` has a placeholder SHA-256 fingerprint.** The TWA will run
  with a thin Custom-Tab URL bar until you replace the placeholder, host the file (see
  below), and let Chrome re-verify.
- **The Gradle wrapper JAR is not committed.** Android Studio (or `gradle wrapper`)
  regenerates it on first sync. `gradle-wrapper.properties` *is* committed so the right
  Gradle distribution is pinned.
- **Launcher icon is a tiny vector placeholder.** Run *Image Asset Studio* in Android
  Studio with `docs/icons/icon-512.png` to overwrite it.
- **No tests.** This scaffold compiles (once the wrapper is generated) but has no
  unit/instrumented coverage. If you port any of the date math from `docs/app.js`, that
  is the obvious thing to test.

## Open in Android Studio

1. Open Android Studio (Ladybug 2024.2.1+).
2. *File → Open* → pick the `android/` directory.
3. On first sync, accept the prompt to regenerate the Gradle wrapper. If it does not
   prompt, run `gradle wrapper --gradle-version 8.10.2` from a system that has Gradle
   installed.
4. Let it finish syncing — it pulls AGP, Kotlin 2.0, Glance 1.1.x and the TWA helper.
5. Plug in a phone (or start an emulator with API 26+) and *Run → Run 'app'*. The TWA
   opens the deployed PWA. Long-press the home screen → *Widgets* → *Printable
   Calendar → This month* to add the widget.

## Generating a signing key and asset links

This is what unlocks the *no URL bar* TWA experience.

1. Generate a release keystore (do this once, store it somewhere safe and back it up):

   ```sh
   keytool -genkey -v \
     -keystore release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias printable-calendar
   ```

2. Get the **SHA-256 fingerprint** of the key:

   ```sh
   keytool -list -v -keystore release.jks -alias printable-calendar
   ```

   Copy the line that starts `SHA256:` — it looks like
   `AB:CD:12:34:…` and is 32 colon-separated hex bytes.

3. Paste it (keeping the colons, uppercase) into `android/digital_asset_links.json`,
   replacing `REPLACE_WITH_SHA256_FINGERPRINT_OF_YOUR_SIGNING_KEY`.

4. **Host the asset links file at the GitHub Pages well-known path.** Copy
   `digital_asset_links.json` to:

   ```text
   docs/.well-known/assetlinks.json
   ```

   ...and push. The file must be served at
   `https://danielcregg.github.io/.well-known/assetlinks.json` for Chrome to verify it.

   **Important wrinkle (already flagged in `android-app-dev-guide.md`):** GitHub Pages
   *project* sites live under `username.github.io/<repo>/`, but `.well-known` has to be
   at the *origin root* (`username.github.io/.well-known/`). A project-pages repo
   cannot put files at the origin root. You have three options:

   - Switch the site to a **user/org Pages site** (rename the repo to
     `danielcregg.github.io` so the origin root *is* the repo) — easiest.
   - Use a **custom domain** (CNAME a domain you control, then `.well-known` lives at
     `your-domain.com/.well-known/assetlinks.json`).
   - **Accept the fallback.** Without verified asset links the TWA renders with a thin
     Custom-Tab URL bar across the top. Everything still works.

   Whichever option you pick, also wire up the signing config in `app/build.gradle.kts`
   so release builds use the key whose fingerprint matches what's hosted.

5. Build a signed release APK / AAB and install. Chrome verifies the asset links
   automatically on first launch; if the fingerprint matches, the URL bar disappears.

## Data integration TODO

The widget currently shows hardcoded sample labels via `StubWidgetDataSource`. To make
it show *your* calendar:

- The web app already has an opt-in sharing flow (see `worker/share.js` and the
  "Shared sessions" section of `AGENTS.md`). The owner publishes their calendar with
  `?publish=<writeId>`, which produces a deterministic read-only id, and viewers fetch
  it at `GET https://<your-worker>/view/<readId>`.
- Add a tiny settings screen (a Compose `MainActivity` — *not* present in this scaffold)
  where the user pastes either the full `?view=…` URL or the bare `readId`. Store it
  in `DataStore` or shared prefs.
- Add a `WorkerWidgetDataSource : WidgetDataSource` that:
  - reads that id,
  - hits `GET /view/<readId>` (with WorkManager, or a one-shot suspend call from
    `provideGlance`),
  - parses the returned `{ v, name, settings }` payload (specifically
    `settings.customDates` — the raw `YYYY-MM-DD | Label [| rule]` lines),
  - expands recurrence rules to dates inside the current month,
  - merges with the Ireland holiday list (which still needs to be ported from
    `irelandHolidays` in `docs/app.js`),
  - and returns the result via `labelsFor()`.
- Swap the receiver to construct `CalendarWidget(dataSourceProvider = …)` with the new
  source. The interface seam in `data/WidgetDataSource.kt` is already in place.

This is deliberately out of scope for the scaffold — the user (you) needs to choose
*how* to expose the read URL in the UI before any of that code is written.

## Design choices

### Glance over RemoteViews

The widget uses **Jetpack Glance**, not direct RemoteViews:

- A 7×N day grid in RemoteViews is doable, but it means hand-building a
  `RemoteViews(R.layout.cell)` per cell and calling `setTextViewText` / `setInt`
  by view ID. That's repetitive and error-prone for a calendar grid.
- Glance gives a Compose-style API (`Row`, `Column`, `Box`, `Text`) that internally
  compiles to the same RemoteViews. We pay nothing at runtime but the development
  cost drops sharply, especially for the conditional compact-vs-full layout.
- Theming via `GlanceTheme.colors` automatically picks up the user's dynamic-colour
  preference on Android 12+.
- We pin Glance 1.1.x (latest stable) in `libs.versions.toml`.

### Single resizable widget vs two fixed sizes

The task brief allowed either one Glance widget that dynamically resizes, or one
declared widget per size. We chose **one resizable widget covering 2×2 → 4×3**:

- `res/xml/widget_info.xml` declares `resizeMode="horizontal|vertical"` with a single
  `<appwidget-provider>` element.
- Glance's `SizeMode.Exact` gives us the actual cell size on each compose pass, so
  `CalendarWidget` switches to a compact layout (no weekday header, smaller font, no
  label text) below 180dp on either axis, and to the full layout above that.
- This is materially less code than two separate receivers and avoids a second pair of
  preview/info XMLs.

### TWA over native rewrite

The TWA wrapper is Approach A from `android-app-dev-guide.md`. The whole printable-PDF
engine stays in the web app — the Android module is *just* the shell + the widget.

## Discrepancies with `android-app-dev-guide.md`

`android-app-dev-guide.md` was written before this scaffold. It suggests using
**PWABuilder** or the **Bubblewrap CLI** to generate the TWA project. This scaffold
sets up the TWA by hand with `com.google.androidbrowserhelper` so the project shape
matches the rest of the repo (Kotlin DSL, version catalog, single `:app` module) — and
because we also need the widget, which Bubblewrap output does not include. The guide's
advice on Digital Asset Links and signing keys still applies verbatim.
