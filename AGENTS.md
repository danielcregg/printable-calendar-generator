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
  worker/                     # OPTIONAL Cloudflare Worker powering live sharing
    share.js                  #   ~70 lines — GET/PUT calendar JSON in Workers KV
    wrangler.toml.example     #   rename + edit, then `wrangler deploy`
    README.md                 #   deployment + free-tier capacity notes
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
8. Each day box has **3 dashed writing guide lines** in five-row months and **2** in six-row months, equispaced between the day-number baseline and the bottom cell gridline. The dashes plus those two implicit "rules" create `lines + 1` natural slots — **4** in five-row months, **3** in six-row months. Holiday and custom-date labels drop into the slots from the bottom up, one per slot; the dashes always stay in place. Labels beyond the cap are silently truncated, keeping the holiday (which is always the last label in the stack).
9. Holiday labels should appear in the **bottom slot** of the day box (so the holiday is the most visually prominent label on a day with several entries).
10. Holiday labels should be **black and bold**, custom-date labels **black and bold italic**, both small enough not to dominate the box. The default calendar stays black and white.
11. Keep the layout clean; do not add icons, decorative graphics, coloured holiday markers, or busy styling by default.
12. Grid boxes may be slightly rectangular; maximizing writing space is more important than perfect square cells.

## Current tuned layout values

The current printed prototype was tuned after printer testing. Be careful changing these
values. Positions use the top-left coordinate system of the canvas preview and jsPDF
(origin at the top-left of the page, y increasing downward).

- Page: A4 landscape (297 mm wide, 210 mm tall)
- Margin: `7 mm` (tightened from a more conservative 10 mm to recover ~7% of grid area; still inside every home printer's printable region)
- Header height: `22 mm`
- Month title baseline: `margin + 8 mm` from the top edge
- Weekday baseline: `margin + header_h - 1.5 mm`
- Grid: from `margin + header_h` down to `margin` above the bottom edge
- Date font size: `22 pt`
- Weekday font size: `20 pt` (auto-shrunk to fit the column when full weekday names are used)
- Month title font size: `40 pt`, centred at `w / 2`
- Year stamp: `22 pt` regular, right-aligned to `w - margin`, same baseline as the month
- Grid line width: `0.7` mm, near-black (`#222`) rather than full black so the cell contents read first
- Writing guide line style: `#cccccc` (a touch lighter than the grid line), dash pattern `2, 3`
- Label font: black, about `12 pt` — holiday labels bold, custom-date labels bold italic; shrunk proportionally if a label is too wide for the column (same pattern as full weekday names). Each label's baseline sits ~2 mm above its slot's bottom line so descenders (g, p, y, …) clear the line below cleanly.
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

Holidays are picked per country in the drawer's **Holidays** accordion section
(`<select id="country">` with `IE`, `GB`, `NONE`). Each country has its own
calculator function in `app.js` and `buildLabels` dispatches on the select's
value. Holiday labels share a global colour swatch palette (also in the
Holidays section, hidden `<input id="holidayColour">` backed by
`#holidayColourPalette`); labelStack reads it when stacking each day's holiday
entry. Adding a country = a new `xxxHolidays(year)` function + an option in
the select + a branch in `buildLabels`.

For United Kingdom (`GB`) — England & Wales bank holidays via `ukHolidays`:
New Year's Day (+ observed-Monday shift), Good Friday, Easter Monday, Early
May Bank Holiday (first Monday May), Spring Bank Holiday (last Monday May),
Summer Bank Holiday (last Monday August), Christmas Day, Boxing Day, plus
observed-substitute Christmas/Boxing logic for weekend collisions. Scotland
and Northern Ireland differ slightly — split into separate handlers when
needed.

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
1978-04-27 | Michael Cregg | birthday
2026-12-25 | Christmas Lunch | colour red
2026-04-10 | Meeting | yearly colour blue
```

Recurrence shortcuts are `daily`, `weekly`, `monthly`, `yearly`, and `birthday`
(an alias for `yearly` that also appends the age the person turns on each
occurrence — birth year comes from the line's `YYYY-MM-DD` prefix, formatted by
`formatBirthdayLabel(name, age)` in `app.js`). The general form is
`every N <day(s)|week(s)|month(s)|year(s)>`. An "Nth weekday of the month" pattern
is also supported: `first tuesday of month`, `last friday of every month`, `2nd
monday of every 3 months` (ordinals `first`/`1st` … `fourth`/`4th` and `last`;
weekday names may be three-letter or full). For the "Nth weekday" form the literal
start date is not yielded — every occurrence is the computed Nth weekday, starting
in the start date's month. All rule forms accept optional `x N` (occurrence count),
`until YYYY-MM-DD` (end date), `except YYYY-MM-DD,YYYY-MM-DD` (skipped dates),
and `colour <name>` (per-date label colour from `LABEL_COLOURS`) suffixes in any
order. Unparseable rules fall back to a one-off date on the start day.

The quick-add form above the textarea writes lines for you: a date picker, label,
**Repeats** dropdown (including a "Birthday (yearly + age)" option), end-condition,
and a swatch palette for the colour. All inputs reset to defaults after Add to list.

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
the design. Three places let a user opt into colour, all using the same
swatch-palette pattern (small circles, click to pick, one active at a time):

- **Calendar Shading** panel — `#shadeColourPalette` writes to a hidden
  `#shadeColour` input. Four pale tints (`grey` / `blue` / `green` / `warm`)
  applied to weekend columns and zebra shading. Presets in `SHADE_THEMES`.
- **Holidays** panel — `#holidayColourPalette` → `#holidayColour`. 7 swatches
  (`black` / `blue` / `green` / `red` / `orange` / `purple` / `pink`). Default
  black. `labelStack` reads it when stacking each day's holiday entry.
- **Custom dates** quick-add form — `#recurColourPalette` (same 7 swatches).
  Selected colour is written into the line's rule text as a `colour <name>`
  clause, so each custom date can carry its own colour. Default black.

All colour names resolve via the `LABEL_COLOURS` table in `app.js`. The hidden
`<input>`s exist so the existing render pipeline (settings save/load,
`RENDER_TRIGGER_IDS` change listeners) keeps working untouched; swatch clicks
update the input's `.value` and fire a synthetic `change` event.

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

## Day editor

Tapping any day in the on-screen preview opens a modal that mirrors the day
cell at large size. The cell preview is a real `<canvas>` rendered by
`drawCellOnCanvas` using the same rules as `drawCalendar` (weekend / zebra
shading, Arial 22 pt day number, equispaced `#cccccc` dashes, 12 pt labels
in slots) — so the modal is a pixel-faithful enlarged copy of how the
printed cell will look. Click hit-zones for each slot are transparent
`<button>`s positioned absolutely over the canvas, sized in canvas-pixel
space and translated to CSS pixels via `devicePixelRatio` for crisp text
on hi-DPI screens.

Slot interactions:

- **Empty slot** → "+ Add a reminder" inline hint; click opens a text
  input over the slot region; Enter appends a `YYYY-MM-DD | Label` line
  to the Custom dates textarea.
- **One-off custom date** → click to edit in place; clearing the field
  and pressing Enter deletes the line.
- **Holiday** → read-only with tooltip; uncheck "Irish holidays" in the
  toolbar to hide all of them.
- **Recurring custom date** → click to override only this occurrence.
  `findRecurringSource` walks the textarea to locate the source rule,
  then `addExceptionToRecurrence` appends the date to the rule's
  `except` clause; if the user typed different text, a one-off override
  line is appended on the same date. The other occurrences of the
  recurrence are untouched.

The colour swatches in the toolbar (`<button class="color-swatch">`) are a
shortcut for the **Shading colour** dropdown that lives inside the Setup
drawer. They sync both directions: clicking a swatch sets the dropdown
and re-renders; opening the drawer and changing the dropdown updates which
swatch shows the active ring.

## Sharing

A configured calendar can be sent to someone else as a copy-pasteable URL or as a
`.json` file. The payload is `{ v, name, settings }` (the same `settings` shape that
`saveCalendar` persists); for the link form it is URL-safe-base64 encoded and placed in
`location.hash` as `#cal=...`. Nothing is uploaded — the payload travels entirely with
the link or the file. On page load `loadFromHashIfPresent` decodes a `#cal=` hash,
applies the settings, and strips the hash so the URL doesn't carry the data around
afterwards. The file form is plain pretty-printed JSON so it's diff-friendly.

URL shorteners are deliberately not used: every free shortener stores the long URL on
its own server, which would leak personal dates and break the offline-first model. Long
URLs that get truncated by a chat app are handled by falling back to the file export.

### Shared sessions (optional, opt-in)

For households who want two devices editing the same calendar in near-real-time —
or an owner who wants to publish one read-only link to many recipients — the
`worker/` directory ships a tiny Cloudflare Worker backed by Workers KV. The
static app reads `<meta name="cal-share-worker">` for the Worker URL; when blank,
the entire shared-session UI stays hidden and no network calls are made.

Three modes, each driven by a URL query param:

- `?live=<writeId>` — **live**: both pull and push. Use when two or three people
  edit one calendar together.
- `?publish=<writeId>` — **publish (owner)**: only pushes; never pulls. The owner
  edits and updates whenever they like.
- `?view=<readId>` — **view (recipient)**: only pulls; never pushes. Recipients see
  the owner's latest version and a "Make my own copy" button to fork into a
  local-only working copy.

The publish/view pair uses a deterministic `readId = base64url(sha256("view:" +
writeId)[0:12])` computed identically on the client and on the Worker. Each PUT
to `/<writeId>` also refreshes a pointer at `view:<readId> → <writeId>`, so the
Worker can resolve viewer reads through the pointer (`GET /view/<readId>`). The
client never PUTs in `view` mode, so viewers can't edit through the UI. The
Worker itself treats every well-formed ID identically at the URL layer, so a
direct `PUT /<readId>` is accepted — but the published view is still safe:
that write only stores `cal:<readId>` and `view:<deriveReadId(readId)>`, both
orphan entries unreachable from any `?view=<readId>` URL. The meaningful
`view:<readId> → <writeId>` pointer is only written by a PUT against the
writeId, so the published calendar stays correct even under direct Worker
tampering. **If you change the Worker, preserve this property:** the
`view:<...>` pointer must always be keyed by `deriveReadId(currentPutId)`,
never by `currentPutId` itself.

- Polling cadence: every 5 s.
- Push debounce: 1.5 s after the last local change.
- Conflict policy: last-write-wins by server timestamp. Fine for households where
  two people rarely edit the same second; would need CRDTs if usage grew.

Shared sessions are deliberately opt-in because they send user data to a third
party (Cloudflare). The default-off behaviour preserves the "nothing leaves your
device" guarantee for users who don't want it.

### Deep-link query params

Two extra URL query params let an outside caller — currently the Android
widget (see `android-widget-plan.md`) — open the app focused on a specific
month or day:

- `?m=YYYY-MM` — set the Year/Month selects to that month and re-render.
- `?d=YYYY-MM-DD` — same, plus open the day editor for that ISO date.

They are parsed in `loadFromQueryIfPresent` after `wireLiveShare` and after
the initial `renderPreview`, so they compose cleanly with `?live=`, `?publish=`
and `?view=` (e.g. `?view=abc&d=2026-05-04`). Malformed values and out-of-range
years (outside `MIN_YEAR..MAX_YEAR`) are silently ignored. Both params are
stripped from the address bar via `history.replaceState` once applied;
everything else in the query string is preserved.

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
14. **Copy share link** copies a `#cal=`-style URL; opening it in a fresh tab restores every setting, then strips the hash from the address bar. **Download as file** + **Load a file** round-trip the same payload via a `.json` file.
15. Stacking labels on the same day fills slots from the bottom up: 1 label sits in the bottom slot, 2 labels in the bottom two, etc., with the dashes always drawn between them. Beyond the cap (4 in five-row months, 3 in six-row months) excess labels are silently truncated and the holiday is preserved.

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
