# Printable Calendar Generator

A clean, browser-based generator for printable A4 wall calendars. No install and no
build step — open the page, set it up, and download a PDF.

The default design is intentionally simple, black and white, and easy to write on:

- A4 landscape pages, Monday-start weeks
- Large month title with the **month bold** and the year in regular weight
- Full weekday names by default, switchable to abbreviated `MON`/`TUE`
- Bold black date numbers, three dashed writing guide lines per day box
- Lightly shaded weekends, with optional zebra-shading of alternate weeks or day columns
- Holiday and custom-date labels in the bottom-left of each cell — holidays bold, custom dates bold italic, always black so the default stays black and white
- Leading and trailing cells filled with the adjacent month's days in light grey, with a small `Jul`/`Sep` tag in the top-right
- Irish public/bank holidays plus Good Friday and Easter Sunday support
- Optional teaching-week numbering (W1–W13 per semester) with an editable schedule
- Optional **recurring** custom dates (e.g. `every 2 weeks`, `weekly x 10`, `yearly`)
- Opt-in colour presets for the shading and the custom-date label colour
- Saved calendars and reusable date groups, stored in your browser
- Installable Progressive Web App — works fully offline

## Using it

The whole app is the static site in `docs/`. To run it locally, open `docs/index.html`
in a browser, or serve the folder with any static file server.

Pick a year and a month (or a full year), toggle the holiday, shading and teaching-week
options, add your own dates, then click **Download PDF**. You can save a named calendar
or a reusable date group in your browser to load again later. `docs/today.html` is a
companion page that shows the current month with today highlighted.

Generating a PDF needs nothing online — jsPDF is bundled in `docs/vendor/`. The site is
also a Progressive Web App: your browser can install it as a standalone app, and once
visited it keeps working with no internet connection.

## GitHub Pages

The site is published straight from this repository:

1. Open repository **Settings**
2. Go to **Pages**
3. Set source to **Deploy from a branch**
4. Choose branch `main` and folder `/docs`
5. Save

## Layout options

Each toggle in the **Setup** drawer is opt-in; the defaults give a clean black-and-white
calendar:

- **Shade weekends / Zebra weeks / Zebra columns** — gentle background shading.
- **Add 3 writing guide lines** — the dashed lines per cell; the calendar drops one extra line per stacked label so the text never overwrites the dashes, and tightens further in six-row months.
- **Show holiday labels** — show or hide the Irish bank-holiday labels.
- **Abbreviate weekday names** — switch from `MONDAY` to `MON`.
- **Teaching weeks** — adds a `W1`–`W13` gutter and reveals an editable schedule panel for years that don't fit the standard ATU pattern.
- **Colours** — choose an opt-in shading theme (grey / blue / green / warm) and custom-date label colour (black / blue / green).
- **Use leading/trailing cells as a Notes area** — replaces the adjacent-month dates with a merged writing block per row, with full-width guide lines and a faint "Notes" tag in the top-left.

## Custom dates

Add your own dates in the **Custom dates** box, one per line, as `YYYY-MM-DD | Label`,
with an optional third pipe-separated field for a recurrence rule:

```
2026-09-01 | School Starts
2026-11-12 | Birthday | yearly
2026-09-08 | Bins | every 2 weeks
2026-09-15 | Swimming | every week x 10
2026-04-01 | Yoga | every 2 weeks until 2026-06-30
```

Recurrence shortcuts: `daily`, `weekly`, `monthly`, `yearly`. The general form is
`every N <day(s)|week(s)|month(s)|year(s)>` with optional `x N` (occurrence count) or
`until YYYY-MM-DD` (end date) — either order works. Lines starting with `#` are
ignored.

You can also click any day in the preview to add a date, or import an `.ics` file
(Outlook, Google, Apple) and tick the dates to include. If a day has more than one
custom date and/or a public holiday, the labels stack on separate lines — custom dates
on top, holiday at the bottom.

## Holiday notes

For Ireland, the generator includes:

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

If Christmas Day or St Stephen's Day falls on a weekend, the generator also labels the
common observed substitute weekdays.

## Android app

The app can be ported to Android — see `android-app-dev-guide.md` for a guide aimed at
AI coding tools, covering both wrapping the existing PWA and a native rebuild.

## License

MIT
