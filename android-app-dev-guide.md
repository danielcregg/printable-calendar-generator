# Android App Development Guide

A guide for AI coding tools and contributors working on the **Printable Calendar
Generator** on Android. It frames the two viable approaches and points at the
docs that hold the day-to-day detail. The web app remains the source of truth;
Android is a thin shell plus a home-screen widget on top of it.

Start here, then jump to the linked docs for the specifics:

- [`AGENTS.md`](AGENTS.md) — authoritative design spec for the calendar itself.
  The "Shared sessions" section is the data contract the widget rides on.
- [`android-widget-plan.md`](android-widget-plan.md) — implementation plan for
  the Trusted Web Activity + Glance widget. The architectural reference.
- [`android/README.md`](android/README.md) — what the in-repo scaffold contains,
  how to open it in Android Studio, how to sign and publish.
- [`worker/README.md`](worker/README.md) — the Cloudflare Worker that powers
  the read-only `view/<readId>` endpoint the widget fetches from.

## What the app does

The Printable Calendar Generator (see [`README.md`](README.md)) produces clean,
printable **A4 landscape** wall calendars and exports them as PDF. Its core
behaviour:

- Renders one month, or a full year, as an A4 landscape grid: a large month
  title, a Monday-first weekday header, and a 7-column by 5-or-6-row day grid.
- Computes Irish public/bank holidays (Easter via the Anonymous Gregorian
  algorithm, the bank-holiday rules including observed substitutes) and labels
  them in the day boxes.
- Supports user-supplied custom dates with a full recurrence-rule grammar
  (`yearly`, `every 2 weeks`, `first tuesday of month`, `x N`, `until …`),
  weekend/zebra shading, writing guide lines, full weekday names,
  teaching-week (W1–W13) numbering, English/Irish (`ga`) labels and opt-in
  colour presets.
- Exports a print-ready PDF via jsPDF (bundled — no network needed).
- Can optionally publish a calendar through a tiny Cloudflare Worker so other
  devices (and the widget below) can fetch a read-only copy.

Read [`AGENTS.md`](AGENTS.md) before any layout work. Its design rules, tuned
layout values, holiday policy and testing checklist apply to the Android app
too.

## The recommended path: TWA + Glance widget

The headline approach is **Approach A** — wrap the deployed PWA in a Trusted
Web Activity (TWA) and add a native home-screen **widget** on top. This is
what the scaffold under `android/` is set up to ship.

The web app already:

- Runs full-screen with no browser chrome (it is a PWA with a service worker
  and a complete `manifest.json`).
- Generates the PDF entirely in-browser, online or off.
- Exposes an opt-in read-only sharing endpoint via the Worker
  (see [`worker/README.md`](worker/README.md) and the "Shared sessions"
  section of [`AGENTS.md`](AGENTS.md)).

The native side therefore only owns:

- The **TWA host activity** that launches the deployed site full-screen.
- A **Jetpack Glance app widget** that pulls a published calendar's JSON from
  the Worker, caches it on disk, and renders a "this month" view.
- A small **settings screen** for pasting the viewer URL / `readId`.

Architecture details — sizes, refresh cadence, fall-back states, deep links —
live in [`android-widget-plan.md`](android-widget-plan.md). Repository layout,
build commands, and signing live in [`android/README.md`](android/README.md).

### Toolchain pins

The scaffold uses **Gradle Kotlin DSL** throughout, with a version catalogue
at `android/gradle/libs.versions.toml`:

- **Kotlin** 2.0.21 (with the Kotlin 2.0 Compose compiler plugin)
- **AGP** 8.7.2
- **Gradle** 8.10.2 (pinned in `gradle/wrapper/gradle-wrapper.properties`)
- **compileSdk / targetSdk** 35
- **minSdk** 26 (TWA helpers work earlier but Glance and `androidx.browser`
  are happier here, and 26+ covers everything we need)
- **Java target** 17
- **Glance** 1.1.1, **`androidbrowserhelper`** 2.6.0, **Compose BOM**
  2024.12.01

Open `android/` in **Android Studio Ladybug (2024.2.1)** or newer. The first
sync will regenerate the Gradle wrapper JAR (which is intentionally not
committed); from then on the toolchain is fully pinned by the wrapper
properties and the version catalogue.

### Why TWA over a native rewrite?

- The web app is already polished, tested, offline-capable, and the rendering
  engine doubles as the PDF engine. A native rewrite duplicates **all** of
  that.
- Layout changes already have to land in two places (canvas preview and PDF
  via jsPDF — see [`AGENTS.md`](AGENTS.md)). Adding a third Kotlin renderer
  multiplies the drift risk.
- TWA + widget is days, not weeks. The widget is small enough to be worth
  writing natively; the calendar engine isn't.

### Why hand-rolled instead of Bubblewrap?

For the TWA piece alone, Bubblewrap is fine. But we also need a **widget
module** in the same Gradle project, and Bubblewrap's generated scaffold
fights that:

- Bubblewrap regenerates `app/build.gradle`, `AndroidManifest.xml` and the
  resources whenever the web manifest changes. Anything we add by hand to
  those files is at risk.
- Bubblewrap output uses Groovy DSL and its own conventions, not the Kotlin
  DSL + version-catalogue layout the rest of this scaffold uses.
- The TWA glue we actually need (`LauncherActivity` from
  `com.google.androidbrowserhelper`, the splash drawable, the
  asset-links wiring) is a few dozen lines.

So the scaffold uses **`com.google.androidbrowserhelper`** directly, in a
single `:app` Gradle module that also hosts the widget. PWABuilder is not
used at all — it tends to produce older Gradle settings and a Bubblewrap
fork.

### Digital Asset Links wrinkle

For the TWA to launch with no URL bar (and for deep links from the widget to
go straight to the TWA without a Chrome flash) the host origin must serve
`/.well-known/assetlinks.json` containing the release-signing key's SHA-256
fingerprint.

A GitHub Pages **project** site lives at
`username.github.io/printable-calendar-generator/`, but `.well-known` must
sit at the **origin root** (`username.github.io/.well-known/`), which a
project repo cannot control. Options, in rough order of preference:

- Rename the repo to `danielcregg.github.io` so the project becomes a
  user/org Pages site and the origin root *is* this repo.
- Set up a **custom domain** (CNAME a domain you control; `.well-known` then
  lives at `your-domain.com/.well-known/`).
- **Accept the fallback** — without verified asset links the TWA shows a thin
  Custom-Tab URL bar at the top. Everything still works.

`android/digital_asset_links.json` is the template. See
[`android/README.md`](android/README.md) for the keystore + hosting steps.

### What the widget pulls (data contract)

The widget never talks to the WebView, never injects JavaScript, never scrapes
the page. It calls the Worker's read-only endpoint:

```
GET <worker-url>/view/<readId>
```

`readId` is derived deterministically from the owner's `writeId`:

```
readId = base64url( sha256("view:" + writeId)[0..12] )
```

The owner publishes by opening the app once with `?publish=<writeId>`, which
pushes their current calendar to `cal:<writeId>` in Workers KV and refreshes
a `view:<readId> → <writeId>` pointer. Recipients (including the widget)
hit `/view/<readId>` and get back the same JSON the web app saves locally —
`{ v, name, settings }`, where `settings.customDates` is the raw multi-line
text users type into the **Custom dates** box. Holidays are not in the
payload — the widget computes them from `settings.country` (today: `IE` or
none).

For the full Publish/Live/View story see the "Shared sessions" section of
[`AGENTS.md`](AGENTS.md) and [`worker/README.md`](worker/README.md). The
widget's setup flow, refresh cadence, offline behaviour and failure states
are spelled out in [`android-widget-plan.md`](android-widget-plan.md).

### Deep links from the widget

The web app already parses two query params for deep links from the widget
(see `loadFromQueryIfPresent` in `docs/app.js`):

- `?m=YYYY-MM` — focus the calendar on that month.
- `?d=YYYY-MM-DD` — focus on that month and open the **day editor** on the
  given date.

Both are stripped from the address bar after they are applied, so they don't
follow the user around afterwards. The 2×2 widget links to today's month; the
4×2 widget to the current week's month; the 4×4 widget to the month it is
showing, optionally with `?d=` when the user taps a specific day cell.

### Themed and adaptive icons

The scaffold ships `mipmap-anydpi-v26/ic_launcher.xml` as an `adaptive-icon`
referencing background and foreground vector drawables. For a polished
release build:

- Replace the placeholder foreground in `drawable/ic_launcher_foreground.xml`
  with an asset generated by Android Studio's **Image Asset Studio** from
  `docs/icons/icon-512.png`.
- Add a `<monochrome>` layer alongside `<background>` / `<foreground>` for
  Android 13+ themed-icon support.
- Adaptive icons render inside whatever shape the launcher prefers; keep the
  important art inside the safe zone (the inner ~66% of the 108dp canvas).

The web app's `manifest.json` only carries 192/512 PNGs — fine for the TWA's
own splash and notifications, but the launcher icon needs the adaptive +
monochrome setup above.

## Native rebuild — alternative path

Choose this only if you need a fully self-contained app with no dependency on
the deployed PWA, native UI controls, or platform integrations the web app
cannot reach. It is a real port — figure on weeks, not days, and an ongoing
maintenance cost as the web app evolves.

### Stack

- **Language:** Kotlin. **UI:** Jetpack Compose. **Min SDK:** 26 (matches the
  TWA scaffold for parity).
- **PDF:** `android.graphics.pdf.PdfDocument` — no third-party library.
- **Dates:** `java.time` (`LocalDate`, `DayOfWeek`, `TemporalAdjusters`).

### Suggested module layout

- `domain/` — pure Kotlin: date math, holidays, teaching weeks, the
  recurrence rule grammar, the layout model. No Android dependencies, fully
  unit-testable.
- `render/` — draws a month onto `android.graphics.Canvas`, shared by the
  on-screen preview and the PDF page.
- `pdf/` — wraps `render/` with `PdfDocument` to produce the file.
- `ui/` — Compose screens: options, preview, day editor, export.

### Domain logic to port from `docs/app.js`

Port these exactly — they are deterministic and `docs/tests.html` exercises
most of them as pure-function assertions. Use that suite as the cross-check
for your Kotlin port: if your JVM port matches the same outputs for the same
inputs, you are done.

- **Easter** — `easterSunday(year)`, Anonymous Gregorian algorithm.
- **Irish holidays** — `irelandHolidays(year)`, including the
  observed-substitute rules for Christmas and St Stephen's Day.
- **Teaching weeks** — `teachingWeekMap()` (both semesters, reading-week and
  Easter-break skipping); see the "Teaching weeks" section of
  [`AGENTS.md`](AGENTS.md).
- **Row count** — `monthRows(year, monthIndex)`, the 5-vs-6 week-row rule.
- **Day placement** — Monday-offset positioning of each date in the grid.
- **Recurrence rules** — `parseRule(text)`, `expandRule(startISO, rule, year)`
  and `nthWeekdayOfMonth(year, month, ordinal, weekday)`. The grammar
  supports `daily` / `weekly` / `monthly` / `yearly`, the general form
  `every N <day(s)|week(s)|month(s)|year(s)>`, "Nth weekday of the month"
  (`first tuesday of month`, `last friday of every month`,
  `2nd monday of every 3 months`), and optional `x N` (occurrence count) or
  `until YYYY-MM-DD` suffixes in either order. This is load-bearing — every
  user with a recurring custom date depends on it.
- **Language toggle** — `MONTH_NAMES`, `WEEKDAYS` and `FULL_WEEKDAYS` are
  keyed by language code (`en` and `ga`). The calendar grid swaps between
  English and Irish; UI controls and holiday labels stay in English.

`java.time` makes most of this cleaner than the JavaScript `Date`
arithmetic — `LocalDate.with(TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY))`
replaces a handful of helper functions.

### Layout and rendering

Keep the **A4 landscape** geometry and the tuned constants from
[`AGENTS.md`](AGENTS.md) (margin **7 mm**, header 22 mm, the font sizes, the
13 mm teaching-week gutter, the slot stack for labels, etc.). Work in
millimetres in the domain model and convert at draw time.

- **On-screen preview:** draw onto a Compose `Canvas` scaled to the view.
- **PDF:** an A4 landscape page is **841.89 × 595.28 pt** (297 mm × 210 mm
  at 72 pt per inch; convert mm to pt with `× 72 / 25.4`). Create a
  `PdfDocument`, start a page with that `PageInfo`, draw with the same
  `Canvas`/`Paint` code as the preview, then finish the page. For a full
  year, add 12 pages.
- Use a bold sans-serif `Typeface`; pixel-exact matching of jsPDF's Helvetica
  is not required, only a clean, legible print.
- Port the **shading themes** (`SHADE_THEMES`: grey / blue / green / warm)
  and **label colour presets** (`LABEL_COLOURS`: black / blue / green) from
  `docs/app.js`. Both default to the black-and-white choice.

### Day editor

Recent commits added a slot-aware day editor in the web app: click a day in
the preview and a modal lets you add, edit, reorder or delete the labels in
that cell, with live feedback on how many label slots remain (4 in five-row
months, 3 in six-row months). Any native port has to plan for this
interaction — the calendar is not just read-only.

### Save, share, print

- **Save:** write the PDF via the `MediaStore` Downloads collection (API 29+)
  or the Storage Access Framework (`ACTION_CREATE_DOCUMENT`).
- **Share:** expose the file with a `FileProvider` and fire an `ACTION_SEND`
  intent (`application/pdf`).
- **Print:** optionally integrate the Android print framework (`PrintManager`
  + a `PrintDocumentAdapter`) so users can print or "Save as PDF" directly.

### Suggested build sequence

1. Port `domain/` and cover it with unit tests against
   [`AGENTS.md`](AGENTS.md)'s testing checklist (Jan 1 2026 = Thursday,
   Easter 2026 = Apr 5, March 2026 = 6 rows, the recurrence grammar
   examples, etc.). Mirror `docs/tests.html`.
2. Implement `render/` for a single month; verify visually against the web
   preview side-by-side.
3. Add `pdf/` and confirm a generated A4 PDF prints without a clipped title.
4. Build the Compose `ui/` — options, live preview, day editor, export.
5. Add full-year export, custom dates with recurrence, `.ics` import,
   teaching weeks, the language toggle, the colour presets.
6. Add save / share / print.
7. Decide whether to keep the TWA + widget side alongside, or replace it.

## FAQ

**Why TWA over a full native rewrite?**
The web app is the source of truth, it already works offline, and it already
generates PDFs in-browser. A native rewrite duplicates the engine and creates
a second place every layout change has to land. The TWA path reuses
everything and adds a small Kotlin shell.

**Why a custom Android module instead of Bubblewrap?**
We need to ship a widget in the same project. Bubblewrap regenerates the
`:app` module on every web-manifest change, which makes adding hand-written
code there fragile. Hand-wiring the TWA via
`com.google.androidbrowserhelper` is a few lines and lets us keep
modern Kotlin DSL + version catalogue conventions.

**Why Glance over RemoteViews?**
A 7×N day grid in raw RemoteViews means a `RemoteViews(R.layout.cell)` per
cell with `setTextViewText` / `setInt` plumbing by view ID — fine but
repetitive and prone to drift between the compact and full layouts. Glance
gives us a Compose-style API (`Row`, `Column`, `Box`, `Text`) that compiles
**to** RemoteViews at runtime, so the launcher sandbox is happy and we pay
no Compose runtime cost in the launcher process.

**Can the widget edit the calendar?**
No. The widget is read-only by design: it fetches the published JSON and
renders it. Tapping the widget (or a day on the 4×4 layout) deep-links into
the TWA, where the day editor opens on that date (`?d=YYYY-MM-DD`). All
editing happens in the web app.

**Does the widget need the Cloudflare Worker?**
Yes, in v1. The widget reads from `GET /view/<readId>`, so the user has to
publish their calendar once via `?publish=<writeId>` and paste the viewer
URL into the widget's setup screen. A future fast-path could write directly
to local cache when the TWA is open and the owner is editing their own
published calendar, but that needs a hook into the web app and is out of
scope.

**What happens to the widget when the network is down?**
It renders the last successfully cached JSON with a small "(offline)" tag.
If no cache exists yet, it shows a "Tap to set up" CTA. A 404 from the
Worker (publication deleted/expired) renders a "no longer published" state
with a refresh button. See [`android-widget-plan.md`](android-widget-plan.md)
§3 for the full state machine.

**Where do the holidays come from in the widget?**
The widget recomputes them from the country code in `settings`, the same way
the web app does. Only Ireland (`IE`) is supported today. The published
JSON does not carry the holiday list — porting `irelandHolidays` (and the
Easter math it depends on) is part of the widget's date-math port.

**Where does the 7 mm margin come from?**
[`AGENTS.md`](AGENTS.md). The tuned printed margin was 10 mm; it was
tightened to 7 mm to recover about 7% of grid area while staying inside
every home printer's printable region. Any port has to use the current
value, not the historical one.
