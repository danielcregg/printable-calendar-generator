# Android App Development Guide

A guide for an AI coding tool tasked with building the **Printable Calendar Generator**
as an Android app. It explains what the app does, the two viable approaches, and the
concrete details needed to execute either one.

## What the app does

The Printable Calendar Generator is a web app (see `README.md` and `AGENTS.md`) that
produces clean, printable **A4 landscape** wall calendars and exports them as PDF. Its
core behaviour:

- Renders one month, or a full year, as an A4 landscape grid: a large month title, a
  Monday-first weekday header, and a 7-column by 5-or-6-row day grid.
- Computes Irish public/bank holidays (including Easter) and labels them in the day boxes.
- Supports user-supplied custom dates, optional weekend/zebra shading, writing guide
  lines, full weekday names, and teaching-week (W1–W13) numbering.
- Exports a print-ready PDF.

`AGENTS.md` is the authoritative spec — its **design rules**, **tuned layout values**,
**holiday policy**, and **testing checklist** apply to the Android app too. Read it
before starting.

## Two approaches

### Approach A — wrap the PWA as a Trusted Web Activity (recommended for a fast ship)

The web app is already an installable PWA with an offline service worker. A **Trusted
Web Activity (TWA)** wraps that PWA in a native Android package with no logic
duplication: the app *is* the PWA, running full-screen without browser chrome.

- **Effort:** low — hours, not days.
- **Maintenance:** one codebase; fixes to the web app reach the Android app on next load.
- **You get:** a Play-Store-publishable app bundle, offline support (via the existing
  service worker), and the app icon/splash from the manifest.
- **Limitations:** it is a web app in an app shell, not native UI. It loads the deployed
  PWA, so a working HTTPS deployment is required. Running with no URL bar needs Digital
  Asset Links — see the wrinkle below.

### Approach B — native Android rewrite (Kotlin + Jetpack Compose)

Reimplement the calendar logic and rendering natively. Choose this if you need a fully
self-contained app (no dependency on a hosted site), native UI, or tighter platform
integration.

- **Effort:** high — it is a real port of the engine in `docs/app.js`.
- **Maintenance:** a second implementation that must be kept in sync with the web app.
- **You get:** a true native app, native PDF generation, full control.

**Recommendation:** ship Approach A first — it is low-risk and reuses everything already
built. Move to Approach B only if a genuinely native, self-contained app is a hard
requirement.

## Approach A: build the TWA

Prerequisites (all already satisfied by this repo):

1. The PWA must be deployed over **HTTPS** — GitHub Pages provides this.
2. A valid `docs/manifest.json` with `name`, `start_url`, `display: standalone`, a
   `theme_color`, and 192px + 512px icons including `maskable` variants — all present.

Steps:

1. Use **PWABuilder** (pwabuilder.com — paste the deployed manifest URL) or the
   **Bubblewrap** CLI (`@bubblewrap/cli`) to generate an Android project from the
   manifest.
2. Set the launch URL to the deployed `index.html`, plus the app name and colours from
   the manifest.
3. Build a signed app bundle (`.aab`) and test on a device or emulator.

**Digital Asset Links wrinkle:** for the TWA to run with no URL bar, the host origin
must serve `/.well-known/assetlinks.json` containing the app's signing-key fingerprint.
A GitHub Pages *project* site lives at `username.github.io/printable-calendar-generator/`,
but `.well-known` must sit at the *origin root* (`username.github.io/.well-known/`),
which a project repo cannot control. Options:

- Publish the PWA under a **custom domain** (you then control `/.well-known/`).
- Publish it as a **user/org GitHub Pages site** (a repo named `username.github.io`).
- Accept the fallback: without verified asset links the TWA shows a thin Custom-Tab
  URL bar — functional, but less polished.

## Approach B: native Android app

### Stack

- **Language:** Kotlin. **UI:** Jetpack Compose. **Min SDK:** 24+.
- **PDF:** `android.graphics.pdf.PdfDocument` (no third-party library needed).
- **Dates:** `java.time` (`LocalDate`, `DayOfWeek`, `TemporalAdjusters`).

### Suggested module layout

- `domain/` — pure Kotlin: date math, holidays, teaching weeks, the layout model. No
  Android dependencies, fully unit-testable.
- `render/` — draws a month onto an `android.graphics.Canvas` (shared by the on-screen
  preview and the PDF page).
- `pdf/` — wraps `render/` with `PdfDocument` to produce the file.
- `ui/` — Compose screens: options, preview, export.

### Domain logic to port from `docs/app.js`

Port these exactly — they are deterministic and already verified against the `AGENTS.md`
checklist:

- **Easter** — the Anonymous Gregorian algorithm (`easterSunday` in `app.js`).
- **Irish holidays** — `irelandHolidays`, including the observed-substitute rules for
  Christmas / St Stephen's Day.
- **Teaching weeks** — `teachingWeekMap` (both semesters, break-week skipping); see the
  "Teaching weeks" section of `AGENTS.md`.
- **Row count** — the 5-vs-6 week-row rule (`monthRows`).
- **Day placement** — Monday-offset positioning of each date in the grid.

`java.time` makes most of this cleaner than the JavaScript `Date` arithmetic — for
example `LocalDate.with(TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY))`.

### Layout and rendering

Keep the **A4 landscape** geometry and the tuned constants from `AGENTS.md` (margin
10 mm, header 22 mm, the font sizes, the 13 mm teaching-week gutter, and so on). Work in
millimetres in the domain model and convert at draw time.

- **On-screen preview:** draw onto a Compose `Canvas` scaled to the view.
- **PDF:** an A4 landscape page is **841.89 × 595.28 pt** (297 mm × 210 mm at 72 pt per
  inch; convert mm to pt with `× 72 / 25.4`). Create a `PdfDocument`, start a page with
  that `PageInfo`, draw with the same `Canvas`/`Paint` code as the preview, then finish
  the page. For a full year, add 12 pages.
- Use a bold sans-serif `Typeface`; pixel-exact matching of jsPDF's Helvetica is not
  required, only a clean, legible print.

### Save, share, print

- **Save:** write the PDF via the `MediaStore` Downloads collection (API 29+) or the
  Storage Access Framework (`ACTION_CREATE_DOCUMENT`).
- **Share:** expose the file with a `FileProvider` and fire an `ACTION_SEND` intent
  (`application/pdf`).
- **Print:** optionally integrate the Android print framework (`PrintManager` plus a
  `PrintDocumentAdapter`) so users can print or "Save as PDF" directly.

## Suggested build sequence (Approach B)

1. Port `domain/` and cover it with unit tests against the `AGENTS.md` checklist
   (Jan 1 2026 = Thursday, Easter 2026 = Apr 5, March 2026 = 6 rows, and so on).
2. Implement `render/` for a single month; verify visually against the web preview.
3. Add `pdf/` and confirm a generated A4 PDF prints without a clipped title.
4. Build the Compose `ui/` — options, live preview, export.
5. Add full-year export, custom dates, `.ics` import, and teaching weeks.
6. Add save / share / print.

## References

- `AGENTS.md` — design rules, tuned layout values, holiday policy, testing checklist.
- `docs/app.js` — the reference implementation of every algorithm above.
- `README.md` — the feature list and user-facing behaviour.
