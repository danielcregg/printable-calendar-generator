# Android Home-Screen Widget Plan

An opinionated implementation plan for shipping a home-screen widget that shows
"this month at a glance" for the Printable Calendar Generator on Android. The
widget piggybacks on a Trusted Web Activity (TWA) wrapper so the same PWA still
does all the heavy lifting; only the widget itself is native.

Read `AGENTS.md` first for the design rules. Read `android-app-dev-guide.md`
for the TWA-vs-native background — the bottom of this document lists what in
that file has gone stale and should be updated in a follow-up pass.

## TL;DR

- Wrap the deployed PWA with **Bubblewrap** (Approach A in the existing guide).
- Add a **Jetpack Glance** (Compose-style) app widget to the TWA project.
- The widget fetches the **published `view/<readId>` JSON** from the existing
  Cloudflare Worker, caches it on disk, and renders the current month into a
  compact Glance grid. No JS-bridge into the WebView, no scraping.
- Three sizes: 2×2 (today + next holiday), 4×2 (week strip), 4×4 (whole month).
- Tapping the widget deep-links into the TWA, scrolled/opened on the right
  month via a `#m=YYYY-MM` hash.
- Build locally with Android Studio Iguana+ / AGP 8.x, Kotlin 2.x, target SDK
  35, min SDK 26 (Glance requires 23 but `androidx.browser` TWAs and Glance
  surfaces are happier at 26+).

The rest of this document expands those choices and the workflow.

---

## 1. Tooling choice: Bubblewrap

**Pick: Bubblewrap (`@bubblewrap/cli`).** Hand-rolled is unnecessary; PWABuilder
is a fine starting point but its generated project drifts from upstream
Android norms and is awkward to extend with a custom widget module.

Bubblewrap gives us a **plain Gradle Android project on disk** that we can
open in Android Studio, commit, and extend. The widget is a regular Android
module in that project — it does not interfere with Bubblewrap's regenerate
flow as long as we keep our changes out of the files Bubblewrap owns
(`app/build.gradle`, `AndroidManifest.xml`, `twa-manifest.json`, the resources
it copies from the web manifest).

Concrete plan:

- `npx @bubblewrap/cli init --manifest https://danielcregg.github.io/printable-calendar-generator/manifest.json`
- Accept the host (`danielcregg.github.io`) and the start URL.
- Set application id `com.danielcregg.printablecalendar` (Play-publishable;
  not tied to GitHub Pages so a future custom domain doesn't force a rename).
- Commit the generated project to a sibling repository **`printable-calendar-android`**
  rather than this one — Android sources don't belong next to `docs/`, and a
  separate repo keeps the web app's commit history and GitHub Pages deploy
  clean. The web app continues to be the source of truth.
- Re-run `bubblewrap update` whenever the web manifest changes; the widget
  module sits in its own Gradle module so the regeneration only touches
  `:app`.

**Why not PWABuilder?** The Windows-flavoured Android scaffold it emits is
fine for a vanilla TWA but mixes outdated Gradle settings and a custom
Bubblewrap fork. We want stock Bubblewrap output so AGP/Gradle upgrades stay
painless.

**Why not hand-rolled?** TWA bootstrapping (the `LauncherActivity` subclass,
the Digital Asset Links wiring, the splash-screen image generation, the
manifest-to-resources copy) is well-trodden ground. Bubblewrap does it in one
command and updates cleanly. Writing it by hand earns nothing.

## 2. Widget framework: Jetpack Glance

**Pick: Jetpack Glance (`androidx.glance:glance-appwidget`, currently 1.1.x).**

Glance is the Compose-style API for app widgets. It compiles down to
`RemoteViews` under the hood, so we get the runtime model widgets need (no
arbitrary Views; everything is a serializable spec) with a modern API that
matches the rest of a Compose Android project.

Reasons:

- **Composable layouts.** `Row`/`Column`/`Box`/`LazyColumn` plus
  `GlanceModifier` is the same vocabulary we'd use elsewhere — no XML layout
  juggling, no manual `RemoteViews.setTextViewText` calls.
- **State and updates fit a fetched-JSON model.** `GlanceAppWidget` works
  naturally with `updateAppWidgetState { … }` + a `GlanceStateDefinition`
  backed by a small `androidx.datastore` Preferences store. The widget reads
  cached calendar JSON from disk and recomposes; we don't need to invent a
  refresh protocol.
- **Action APIs.** `actionStartActivity(...)` for the deep link, and
  `actionRunCallback<RefreshAction>()` for the refresh button is one line each.
- **No Compose runtime needed at runtime.** Glance is its own runtime; we
  don't drag Compose UI into the launcher's process.

Traditional `RemoteViews` would also work — the widget is small — but we'd be
hand-rolling layout XML, view ids, and update calls for no benefit. Use
Glance.

A small constraint to keep in mind: Glance widgets render into a launcher's
restricted view sandbox, so anything fancier than text, images, simple boxes
and a couple of standard inputs has to render off-screen to a `Bitmap` and be
displayed via `Image`. The 4×4 month grid is borderline — see §4 for how to
handle it.

## 3. Data integration: use the Publish `view` URL

**Pick: fetch the published calendar's JSON from the existing Worker.**

The owner already has a Publish workflow: open the app with `?publish=<writeId>`
and every save pushes the calendar to `cal:<writeId>` in Workers KV. A
deterministic `readId = base64url(sha256("view:"+writeId)[0..12])` lets
**anyone** fetch a read-only copy via `GET <workerUrl>/view/<readId>`.

That endpoint is exactly what the widget wants:

- Anonymous — the widget never sees the owner's writeId, and tampering with the
  app's storage to extract a readId gets the attacker nothing they couldn't
  get from the published link.
- Stable, versioned JSON — the payload is the same `{ v, name, settings }`
  shape the web app already saves and restores from a `#cal=` hash, so
  rendering logic on the device just reads `settings` fields.
- Trivial to cache — `OkHttp`'s built-in disk cache, or a single file written
  by `Context.cacheDir`, handles "show last good state when offline."
- Already deployed and load-bearing for the web app.

**Setup flow inside the TWA:**

1. First widget add (or first app launch) shows a "Connect to your calendar"
   screen with a single field: paste a viewer URL (`…?view=<readId>`) or just
   the readId. We persist the readId in `EncryptedSharedPreferences`.
2. Optionally, sniff `?view=<readId>` from a deep link if the owner opens the
   TWA via their own viewer URL once.
3. Once configured, the widget's `WorkManager` job hits
   `GET <workerUrl>/view/<readId>` every 30 minutes (and on widget-update
   broadcasts), writes the JSON to `filesDir/cal.json`, and schedules a
   Glance update.

**Why not a WebView JS bridge?** The alternative is:
`@JavascriptInterface` injected into the TWA's Custom-Tab/WebView, the web
app posting `settings` over the bridge on every change, the native code
stashing it for the widget. It is fiddly because:

- TWAs don't host a WebView **we** own — they delegate to Chrome via Custom
  Tabs. You can't inject `@JavascriptInterface` into Chrome.
- Switching to a hosted WebView (`WebView` + `WebViewAssetLoader`) loses the
  "we're a TWA" properties: no PWA install context, no shared cookies/storage
  with the deployed site, no automatic offline cache from `sw.js`.
- It only works while the user has the app open. The widget needs to be
  fresh after a phone reboot, after a couple of days without launching, etc.

The Worker is already the right shape for what we need. Use it.

**Failure modes the widget must handle:**

- No readId configured → render a "Tap to set up" CTA that opens the setup
  screen.
- Network error → render the last cached JSON, with a tiny "(offline)" tag
  in the corner.
- 404 (publisher deleted/expired) → render an "Calendar no longer published"
  state with a refresh button.
- Stale (> 7 days since last successful fetch) → render the cache but tag it
  "Last updated 9 Jun" so the user notices.

**Optional fast-path (do not block on this):** when the TWA is open and the
owner is editing their *own* published calendar on this device, intercept
the next `PUT` from inside the app and write the same JSON straight to
`filesDir/cal.json`. That requires the web app to expose a small hook — out
of scope for v1.

## 4. Widget visuals

A wall calendar's "this month" view does not fit a 2×2 widget cell, so we
ship three sizes (`<appwidget-provider android:targetCellWidth/Height>` and
`android:resizeMode="horizontal|vertical"`). The user picks the size they
want when they drop the widget.

All sizes follow the AGENTS.md design rules: black/white default, holiday
labels bold, custom-date labels bold italic, weekend columns lightly shaded.
The widget is **not** a print preview — we drop the writing guide lines and
the teaching-week gutter, both of which only make sense for the printed
sheet.

### Small (2×2 — "Today")

- Big day number (today's date) — bold, 32 sp.
- Day of week + month name underneath — `MON · JUNE 2026`.
- A single line at the bottom: today's first label (holiday or custom date)
  if any; otherwise the next upcoming holiday or custom date and how many
  days away ("Next: June Bank Holiday · in 5d").
- Tap target = the whole widget. Deep link to `/?m=YYYY-MM-DD`.

### Medium (4×2 — "This week")

- Header row: `JUNE 2026` left, today highlighted (filled circle on the day
  number).
- Two-row Mon-Sun strip:
  - Row 1: `MON TUE WED THU FRI SAT SUN`.
  - Row 2: the date numbers for the current week, with weekend columns
    shaded the same grey as the print layout (`#eeeeee`).
- Below the strip: up to three stacked labels for "this week" — holiday or
  custom — truncated with ellipsis.

### Large (4×4 — "Whole month")

- Header: `JUNE` bold left, `2026` regular right (the print layout, scaled
  down).
- Mon-first weekday row.
- 5 or 6 week rows (same `monthRows` rule as the web app) of day numbers.
  Adjacent-month leading/trailing cells render greyed exactly as on paper
  (no Notes-area variant for the widget — keep it simple).
- Today is highlighted with a black filled circle behind the day number,
  white text.
- Each cell carries at most **one** label — the highest-priority entry for
  that day (holiday wins over custom dates; if multiple custom dates, the
  first by entered order). Anything else is silently dropped on the widget;
  the user can tap through to see the full calendar.

**Glance rendering note for the 4×4 month:** a 7×7 grid of cells with text
**is** doable in pure Glance (a `Column` of `Row`s of `Box`s with `Text`),
but spacing controls are limited. If the layout feels off, fall back to
**drawing the month to a `Bitmap` on a background thread** (the same domain
code we'll port for the day math), and showing it inside a single
`Image(provider = ImageProvider(bitmap))`. The cached JSON makes that
cheap.

### Colours and theming

- Honour the system's day/night mode: light theme = black on `#f6f4ef` (the
  PWA's background_color); dark theme = white on `#1a1a1a`. Holiday/custom
  labels invert too.
- Respect the user's "Colours" choices stored in the published JSON
  (`settings.shadeTheme`, `settings.labelColor`) — same presets that
  `SHADE_THEMES` and `LABEL_COLOURS` define in `app.js`. We only need the
  background/weekend tints; full theming is overkill for a 4×4 widget.

## 5. Deep links

The widget needs to open the TWA on the user's tap, and ideally land on the
month the widget is showing.

- Add a `#m=YYYY-MM` (or `?m=YYYY-MM`) hash recogniser to `docs/app.js`:
  if present on load, pre-set the year/month controls to that month before
  the first `drawCalendar` call. This is a small one-line change in the
  query-param parsing that already handles `?live=`, `?publish=`, `?view=`.
- In the widget, `actionStartActivity` an `Intent.ACTION_VIEW` against
  `https://danielcregg.github.io/printable-calendar-generator/?m=2026-06`.
  Because the host is verified via Digital Asset Links (see §6), Android
  routes it straight to the TWA without the disambiguation dialog.
- The 2×2 widget links to today's month; the 4×2 to the current week's
  month; the 4×4 to the month it is showing. Tapping a specific day cell on
  the 4×4 widget appends the day: `?m=2026-06-15`. The web app can ignore
  the day component for now (it just scrolls/opens the month); a future
  improvement is to also open the day editor pre-focused on that date.

## 6. Build & signing workflow

After Bubblewrap initialises the project (§1), the user runs everything
locally in a checkout of the **`printable-calendar-android`** repo. The
loop is: open the project in Android Studio (Iguana 2023.2 or newer), let
it sync against AGP 8.x and Kotlin 2.x, then `./gradlew :app:bundleRelease`
to produce an `.aab` and `./gradlew :app:assembleRelease` for an `.apk`.
First-time signing: generate a keystore with
`keytool -genkey -v -keystore release.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`,
store the path/password pair in `~/.gradle/gradle.properties` (never in the
repo), and put the SHA-256 fingerprint into `docs/.well-known/assetlinks.json`
on whatever origin will serve the verified PWA (see the "Digital Asset
Links wrinkle" already documented in `android-app-dev-guide.md`). On every
release: bump `versionCode`/`versionName` in `app/build.gradle.kts`, run the
two Gradle tasks above, upload the `.aab` to the Play Console, sideload the
`.apk` to a phone with `adb install` for smoke-testing first.

## 7. What is out of date in `android-app-dev-guide.md`

Do **not** modify that file as part of this plan — but note these deltas
for a follow-up update pass:

- **Min SDK.** The guide is silent on min SDK; Glance 1.1 requires API 23+
  and `androidx.browser` TWAs work from 21, but for a 2026 ship we should
  state **min SDK 26, target SDK 35**.
- **Kotlin / AGP / Gradle versions.** The guide says "Kotlin, Compose,
  `java.time`" but doesn't pin versions. Should call out **Kotlin 2.x,
  AGP 8.5+, Gradle 8.7+, Compose BOM 2024.10+**.
- **Build system flavour.** The guide doesn't mention Gradle Kotlin DSL.
  Should standardise on `build.gradle.kts` everywhere.
- **PWABuilder vs Bubblewrap.** The guide lists both as equivalent. For a
  project we expect to extend (we are extending it with a widget), only
  Bubblewrap is sensible — say so.
- **TWA hosting wrinkle.** The Digital Asset Links discussion is still
  accurate but now relevant for a second reason: deep-link routing from
  the widget needs the assetlinks file too, or every widget tap shows the
  Chrome address bar for a half-second. Worth a sentence.
- **The `worker/` directory.** The guide predates the Cloudflare Worker
  entirely. It should at least mention that a deployed Worker plus a
  published calendar enables the **home-screen widget** (this plan) and is
  also useful for any future native-app data-sync without re-implementing
  the engine. The Publish/view contract — `readId = base64url(sha256(
  "view:" + writeId)[0..12])`, `GET /view/<readId>` — is the public API.
- **`docs/tests.html`.** AGENTS.md now references a pure-function test
  page that didn't exist when the guide was written. Approach B (native
  port) should call out using that test suite as the cross-check for the
  Kotlin port of the date math.
- **Custom-date recurrence.** The guide's "domain logic to port" list
  doesn't mention recurrence rules (`yearly`, `every N weeks`,
  `first tuesday of month`, `x N`, `until …`). That parser is now
  load-bearing — anyone doing Approach B has to port it.
- **Day editor.** Recent commits added a slot-aware day editor (click a
  cell to edit). Approach B has to plan for that too; the guide is silent
  on it.
- **Language toggle.** AGENTS.md now has English/Irish (`ga`) calendar
  labels; the guide doesn't mention the `MONTH_NAMES`/`WEEKDAYS` language
  keying.
- **Tightened margin.** The guide quotes "margin 10 mm" as the tuned value;
  it is now **7 mm** (see commit `97e283e` and the current AGENTS.md).
- **App icons.** Manifest only has 192/512 sizes; for a polished
  Play-Store + adaptive-icon build the guide should mention generating a
  monochrome icon for themed icons on Android 13+, and adaptive icons via
  Android Studio's Asset Studio.

## Appendix: dependencies

Minimal set the widget module will pull in:

- `androidx.glance:glance-appwidget:1.1.x`
- `androidx.glance:glance-material3:1.1.x` (themed text/colour helpers)
- `androidx.work:work-runtime-ktx:2.9.x` (periodic refresh)
- `androidx.datastore:datastore-preferences:1.1.x` (widget state)
- `androidx.security:security-crypto:1.1.0-alpha06` (EncryptedSharedPreferences
  for the readId)
- `com.squareup.okhttp3:okhttp:4.12.x` (HTTP + disk cache)
- `org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.x` (parse the
  calendar JSON)
- `androidx.browser:browser:1.8.x` (already pulled in by the Bubblewrap-
  generated `:app` for the TWA itself)

No Compose UI dependency unless we add a setup screen (we will: a tiny
single-screen Compose activity for "paste your viewer URL").

## Appendix: rough effort estimate

- Bubblewrap init + Digital Asset Links + first signed build: **half a day**.
- Glance widget skeleton + setup screen + readId persistence: **half a day**.
- `WorkManager` fetch + JSON parsing + on-disk cache + offline tag: **1 day**.
- Three layouts (small/medium/large) + day-math port (just enough to render
  one month, no PDF, no teaching weeks): **1–2 days**.
- Deep links + `?m=` handling in `docs/app.js` (a tiny web-app change):
  **half a day**.
- Polish: dark mode, today highlight, themed icon, Play listing assets:
  **half a day**.

Total: roughly a working week for a first internal release. Play-Store
hardening (privacy listing, content rating, screenshots, asset links
verification on the production origin) is a separate small task on top.
