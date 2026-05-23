# AGENTS.md

Guidance for AI coding tools and future contributors working on this repository.

## Design philosophy

These principles inform every decision in the codebase. If a proposed change
violates one of them, prefer not to make it.

1. **The calendar is the hero.** Every layout decision starts with "does this serve the calendar?" The hero element gets centred space, generous size, and clean borders; everything else gets out of the way.
2. **Black and white by default.** The starting state is print-friendly. Colour, shading themes, the Notes area — all opt-in. A user who never touches a toggle still gets a calendar they'd be happy to pin to a wall.
3. **Readable from a few metres, writable up close.** This is a wall calendar, not a screen calendar. Type sizes, grid weights and guide lines are tuned for distance reading and pen-in-hand use, not pixel-perfect screen mockups.
4. **Tuned for A4 landscape — every inch of the page has a purpose.** The output target is a 297 × 210 mm A4 sheet, and the layout is sized to use all of it: margins are minimal, cells fill the grid, the title sits as close to the top edge as a home printer will allow without clipping. We don't design for a generic page; we design for *this* page.
5. **Configuration is one tap away, not in your face.** Setup (custom dates, saved calendars, .ics import, colours, teaching schedule) lives behind the drawer. Every control that crowds the toolbar has to earn its place; rare ones go in the drawer, very rare ones in the README only.
6. **No accounts. No server. Works offline.** Everything is a static `docs/` folder; saved calendars and date groups live in `localStorage`. The PWA precaches the app shell so the calendar is generated entirely in the browser, online or not. Nothing about a user's dates ever leaves their device.
7. **The PDF is the deliverable; the canvas is the editor.** The on-screen preview is the instant-feedback editing surface; the downloaded PDF is what gets pinned to the wall. We optimise both for their own job.
8. **Resist abstractions that risk visual drift.** The dual canvas/PDF render path duplicates work on purpose. We pay the maintenance cost so the preview and the printout always agree pixel-for-pixel.

## Project purpose

This project creates clean, printable A4 landscape wall calendars and planners, aimed
at people with easy access to a standard A4 printer (most office and home setups) who
want a paper sheet they can write important dates onto — birthdays, appointments,
bank holidays, school/academic terms, work deadlines — without software to install,
accounts to create, or design skill required.

The design goal is deliberately simple and practical rather than decorative:

- readable from a few metres away
- non-fussy black-and-white styling by default, with opt-in colour presets
- large month title — month name in bold, year in regular weight
- abbreviated weekday names (MON, TUE…) and bold black date numbers by default, with a switch to full names
- lightly shaded Saturday/Sunday columns, with optional zebra-shading of alternate weeks or day columns
- three subtle dashed writing guide lines per day box
- holiday and custom-date labels in the bottom-left of the relevant day box — holidays bold, custom dates bold italic
- reliable, reproducible date placement calculated by code, not manually designed

The original target use case is an Irish work/family/academic wall calendar, but the project should be general enough to support other countries and user-defined special dates.

## Repository structure

```text
printable-calendar-generator/
  docs/
    index.html           # Calendar generator web app (and the GitHub Pages site)
    styles.css
    app.js               # Calendar/holiday/teaching-week engine, rendering, UI, PDF export
    manifest.json        # PWA manifest — installable-app metadata and icons
    sw.js                # Service worker — precaches the app shell for offline use
    vendor/
      jspdf.umd.min.js   # Bundled jsPDF 2.5.1 — no CDN dependency
    icons/
      icon-192.png       # App icons referenced by the PWA manifest
      icon-512.png
  Original Sample month/      # Reference printed sample PDF
  README.md
  AGENTS.md
  CLAUDE.md
  android-app-dev-guide.md    # Guide for porting the app to Android
```

The entire application is the static site in `docs/`. There is no build step and no
server: it runs by opening `index.html`, and it is deployed as-is via GitHub Pages.

## Design rules to preserve

When changing layout code, preserve these visual decisions unless the user explicitly asks otherwise:

1. **A4 landscape** output.
2. **Monday-first** weeks.
3. **Large, black** month title centred; the year sits smaller, right-aligned, on the same baseline.
4. Month title should sit slightly below the printable top edge so home printers do not clip it.
5. Weekday headers should be bold and black.
6. Date numbers should be bold and black.
7. Saturday and Sunday columns should be lightly shaded, not dark.
8. Each day box has **3 dashed writing guide lines** in five-row months and **2** in six-row months (the lines are respaced so the per-line gap stays roughly the same). Drop one extra line per stacked label, from the bottom up, so the text never overwrites the dashes.
9. Holiday labels should appear in the **bottom-left corner** of the day box.
10. Holiday labels should be **black and bold**, custom-date labels **black and bold italic**, both small enough not to dominate the box. The default calendar stays black and white.
11. Keep the layout clean; do not add icons, decorative graphics, coloured holiday markers, or busy styling by default.
12. Grid boxes may be slightly rectangular; maximizing writing space is more important than perfect square cells.

## Current tuned layout values

The current printed prototype was tuned after printer testing. Be careful changing these
values. Positions use the top-left coordinate system of the canvas preview and jsPDF
(origin at the top-left of the page, y increasing downward).

- Page: A4 landscape (297 mm wide, 210 mm tall)
- Margin: `10 mm`
- Header height: `22 mm`
- Month title baseline: `margin + 8 mm` from the top edge
- Weekday baseline: `margin + header_h - 1.5 mm`
- Grid: from `margin + header_h` down to `margin` above the bottom edge
- Date font size: `22 pt`
- Weekday font size: `20 pt` (auto-shrunk to fit the column when full weekday names are used)
- Month title font size: `40 pt`, centred at `w / 2`
- Year stamp: `22 pt` regular, right-aligned to `w - margin`, same baseline as the month
- Grid line width: `1.0`
- Writing guide line style: light grey, dash pattern `2, 3`
- Label font: black, about `9 pt` — holiday labels bold, custom-date labels bold italic
- Teaching-week gutter: `13 mm` wide, with week labels (`W1`…) in `13 pt` bold
- Adjacent-month day numbers: `22 pt` bold light grey (`#a8a8a8`), top-left of the leading/trailing cells
- Adjacent-month abbreviation (`Jul`, `Sep`…): `14 pt` italic grey (`#999999`), top-right of the cell
- Notes-area "Notes" tag: `10 pt` italic grey (`#999999`), top-left of the merged block

If these values are changed, download a PDF and visually inspect it before committing.

## Language

The calendar grid (month title, weekday headers, adjacent-month tags, and
the Month dropdown options) can be rendered in either English (default) or
Irish (`ga` / Gaeilge). UI controls and holiday labels stay in English. The
translations live in `MONTH_NAMES`, `WEEKDAYS` and `FULL_WEEKDAYS` (now
keyed by language code) and the chosen language is stored with saved
calendars.

## Holiday policy

For Ireland (`IE`), include practical work/family dates:

- New Year's Day
- St Brigid's Day
- St Patrick's Day
- Good Friday
- Easter Sunday
- Easter Monday
- May Bank Holiday
- June Bank Holiday
- August Bank Holiday
- October Bank Holiday
- Christmas Day
- St Stephen's Day
- observed/substitute Christmas and St Stephen's Day labels where appropriate

Do not add broad multi-day school breaks by default. The agreed approach is to include Good Friday, Easter Sunday, and Easter Monday, while letting users add school-specific dates as custom dates.

## Custom dates

Custom dates are entered in the app's **Custom dates** box, one per line, in the format
`YYYY-MM-DD | Label`, with an optional third pipe-separated field for a recurrence
rule:

```text
2026-09-01 | School Starts
2026-11-12 | Birthday | yearly
2026-09-08 | Bins | every 2 weeks
2026-09-15 | Swimming | every week x 10
2026-04-01 | Yoga | every 2 weeks until 2026-06-30
```

Recurrence shortcuts are `daily`, `weekly`, `monthly`, `yearly`. The general form is
`every N <day(s)|week(s)|month(s)|year(s)>` with optional `x N` (occurrence count) or
`until YYYY-MM-DD` suffixes (either order). Unparseable rules fall back to a one-off
date on the start day.

Lines beginning with `#` are treated as comments. Dates can also be added by clicking a
day in the preview, or by importing an `.ics` file. If multiple labels fall on the same
date, each one is drawn on its own line, stacked above any holiday label for that day.

## Teaching weeks

An optional **Teaching weeks** checkbox adds a narrow left-hand gutter that numbers the
week rows `W1`–`W13` for an academic year. The numbering is computed automatically:

- **Semester 1** — 13 weeks. The reading week is the week of the October bank-holiday
  Monday; `W1` is six weeks before it, and `W7`–`W13` follow it.
- **Semester 2** — 13 weeks, starting the third Monday of January, with a two-week
  Easter break (the week of Easter Sunday and the week after).

Break weeks are left blank so the count resumes correctly after them. The **Teaching
week schedule** panel exposes four auto-filled but editable dates — each semester's
Week 1 start and break start — for years whose schedule differs, plus a button to reset
them to the automatic values.

## Colour options

The calendar is black and white by default — that simplicity is the core of
the design. Two optional dropdowns in the **Colours** panel let a user opt
into colour: a shading theme (grey, blue, green or warm) that tints the
weekend and zebra shading, and a custom-date label colour (black, blue or
green). Both default to the black-and-white choice, and holiday labels are
always black. Presets live in `SHADE_THEMES` and `LABEL_COLOURS` in `app.js`.

## Leading and trailing cells

Months always start and end with some cells outside the current month (the
grid before day 1 and after the last day). By default these are filled with
**adjacent month dates** — the trailing days of the previous month and the
opening days of the next, in light grey with a small italic 3-letter month
tag in the top-right corner. A **Use leading/trailing cells as a Notes
area** checkbox in the main controls replaces that with a merged Notes
area (no internal dividers, full-width writing lines per row, a faint
"Notes" tag in the top-left).

## The web app

The application is a single static site in `docs/`. It uses jsPDF — bundled in
`docs/vendor/` — to produce the downloadable PDF. There is no build step and nothing to
install.

`app.js` holds everything: holiday calculations, teaching-week numbering, the layout
maths, rendering, the UI, `.ics` import, browser-stored saved calendars and date groups,
and PDF export. It is loaded by `index.html` (the generator).

`app.js` renders the calendar through two paths that must be kept consistent:

- `drawCalendar` — draws to a `<canvas>` for the on-screen preview.
- `drawPdfMonth` — draws the same layout with jsPDF for the downloaded PDF.

Any layout change must be made in **both**, or the preview and the PDF will disagree.
The downloaded PDF is the print-quality output and the one to trust; the canvas preview
is approximate because it uses the browser's own font rendering.

## Offline support (PWA)

The site is an installable Progressive Web App. `manifest.json` carries the install
metadata and icons; `sw.js` is a service worker that precaches the whole app shell —
the HTML page, the CSS and JS, the vendored jsPDF, the manifest and the icons — so the
app loads and generates PDFs with no network connection.

The service worker is cache-first. **When you change any precached asset, bump the
`CACHE` constant in `sw.js`** (for example `printable-calendar-v2` to `-v3`). Otherwise
the service worker keeps serving the old cached file to returning visitors, even when
the `?v=` query on the script tags changes — it matches requests with `ignoreSearch`.

## Testing checklist

Before finishing any change, verify:

1. January 1, 2026 appears on Thursday.
2. February 1, 2026 appears on Sunday.
3. March 2026 uses 6 rows.
4. June 1, 2026 appears on Monday and is labelled `June Bank Holiday` when IE holidays are enabled.
5. Easter 2026 labels appear on:
   - Good Friday: 2026-04-03
   - Easter Sunday: 2026-04-05
   - Easter Monday: 2026-04-06
6. Weekend shading applies only to Saturday and Sunday columns.
7. Holiday labels are black and bold, custom-date labels black and bold italic, bottom-left.
8. Generated PDFs print safely with no clipped month title.
9. With **Teaching weeks** enabled, week rows are numbered `W1`–`W13` and the reading-week and Easter-break rows are left blank.
10. Default rendering fills leading and trailing cells with adjacent-month day numbers in light grey, with a 3-letter month tag (`Jul`, `Sep`, …) in the top-right corner.
11. With **Notes area** checked, those cells merge into one writing block per row with full-width guide lines and a faint "Notes" tag in the top-left.
12. Weekday headers default to the 3-letter form (`MON`, `TUE`, …); ticking **Full day names** switches them to `MONDAY`/`TUESDAY`/….
13. Recurring custom-date lines (e.g. `2026-09-08 | Bins | every 2 weeks`) expand into every occurrence inside the rendered year, with the same styling as one-off custom dates.

Suggested local smoke test:

1. Serve the `docs/` folder with a static server (a served URL, not `file://`, is needed for the service worker).
2. Open `docs/tests.html` and confirm the pure-function assertion suite passes (date math, holidays, recurrence parser, layout helpers).
3. Generate a full-year 2026 calendar with IE holidays and download the PDF.
4. Generate a single month (for example June 2026) and download it.
5. Reload once, then load again with the network disabled, to confirm the service worker serves the app offline.
6. Visually inspect each PDF against the checklist above.

## Coding style

- Prefer simple, readable code over clever abstractions.
- Keep dependencies minimal.
- Avoid adding frameworks unless necessary.
- Keep all date calculations deterministic.
- Do not hard-code month layouts manually; compute weekday positions using date/calendar logic.
- Keep public-facing labels short so they fit in the day boxes.

## Future improvements

Good future additions:

- more country holiday providers
- Sunday-start option
- portrait option
- different paper sizes
- optional localisation of weekday/month labels
- a native Android app (see `android-app-dev-guide.md`)

Avoid adding clutter to the default design. The core value of this project is that the calendar is clean, readable, and easy to write on.
