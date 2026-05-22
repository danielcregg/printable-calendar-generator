# AGENTS.md

Guidance for AI coding tools and future contributors working on this repository.

## Project purpose

This project creates clean, printable A4 landscape wall calendars. The design goal is deliberately simple and practical rather than decorative:

- readable from a few metres away
- non-fussy black-and-white styling
- large bold month title, weekday labels, and date numbers
- lightly shaded Saturday/Sunday columns
- three subtle dashed writing guide lines in each day box
- holiday/custom-date labels in the bottom-left corner of the relevant day box
- reliable, reproducible date placement calculated by code, not manually designed

The original target use case is an Irish work/family wall calendar, but the project should be general enough to support other countries and user-defined special dates.

## Repository structure

```text
printable-calendar-generator/
  docs/
    index.html           # Calendar generator web app (and the GitHub Pages site)
    today.html           # Companion "this month" page with today highlighted
    styles.css
    app.js               # Holiday math, layout/rendering, UI, and jsPDF export
    today.js             # Renders the current month, reusing app.js
    vendor/
      jspdf.umd.min.js   # Bundled jsPDF 2.5.1 — no CDN dependency
  Original Sample month/ # Reference printed sample PDF
  README.md
  AGENTS.md
  CLAUDE.md
```

The entire application is the static site in `docs/`. There is no build step and no
server: it runs by opening `index.html`, and it is deployed as-is via GitHub Pages.

## Design rules to preserve

When changing layout code, preserve these visual decisions unless the user explicitly asks otherwise:

1. **A4 landscape** output.
2. **Monday-first** weeks.
3. **Large, bold, black** month title.
4. Month title should sit slightly below the printable top edge so home printers do not clip it.
5. Weekday headers should be bold and black.
6. Date numbers should be bold and black.
7. Saturday and Sunday columns should be lightly shaded, not dark.
8. Each day box should have exactly **3 dashed writing guide lines** by default.
9. Holiday labels should appear in the **bottom-left corner** of the day box.
10. Holiday labels should be **black, bold italic**, and small enough not to dominate the box.
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
- Month title font size: `40 pt`
- Grid line width: `1.6`
- Writing guide line style: light grey, dash pattern `2, 3`
- Holiday font: bold italic, black, about `9 pt`

If these values are changed, download a PDF and visually inspect it before committing.

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
`YYYY-MM-DD | Label`:

```text
2026-09-01 | School Starts
2026-11-12 | Birthday
```

Lines beginning with `#` are treated as comments. Dates can also be added by clicking a
day in the preview, or by importing an `.ics` file. If multiple labels fall on the same
date, each one is drawn on its own line, stacked above any holiday label for that day.

## The web app

The application is a single static site in `docs/`. It uses jsPDF — bundled in
`docs/vendor/` — to produce the downloadable PDF. There is no build step and nothing to
install.

`app.js` holds everything: holiday calculations, the layout maths, rendering, the UI,
`.ics` import, and PDF export. It is shared by both pages — `index.html` (the generator)
and `today.html` (the live month view). Its `DOMContentLoaded` handler exits early when
the generator controls are absent, so it is safe to load on `today.html`.

`app.js` renders the calendar through two paths that must be kept consistent:

- `drawCalendar` — draws to a `<canvas>` for the on-screen preview and the today page.
- `drawPdfMonth` — draws the same layout with jsPDF for the downloaded PDF.

Any layout change must be made in **both**, or the preview and the PDF will disagree.
The downloaded PDF is the print-quality output and the one to trust; the canvas preview
is approximate because it uses the browser's own font rendering.

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
7. Holiday labels are black, bold italic, bottom-left.
8. Generated PDFs print safely with no clipped month title.

Suggested local smoke test:

1. Open `docs/index.html` in a browser, or serve the `docs/` folder with a static server.
2. Generate a full-year 2026 calendar with IE holidays and download the PDF.
3. Generate a single month (for example June 2026) and download it.
4. Open `docs/today.html` and confirm the current month renders with today highlighted.
5. Visually inspect each PDF against the checklist above.

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

Avoid adding clutter to the default design. The core value of this project is that the calendar is clean, readable, and easy to write on.
