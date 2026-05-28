# Printable Calendar Generator

A clean, browser-based generator for printable A4 wall calendars and planners. Built
for people with easy access to a standard A4 printer — most office and home setups —
who want a paper sheet they can write important dates onto: birthdays, appointments,
bank holidays, school terms, work deadlines. No software to install, no account to
create, no build step: open the page, set it up, download a PDF.

The default design is intentionally simple, black and white, and easy to write on:

- A4 landscape pages, Monday-start weeks
- Large month title with the **month bold** and the year in regular weight
- Abbreviated weekday names (`MON`/`TUE`) by default, switchable to the full names
- Bold black date numbers, three dashed writing guide lines per day box
- Lightly shaded weekends, with optional zebra-shading of alternate weeks or day columns
- Holiday and custom-date labels in the bottom-left of each cell — holidays bold, custom dates bold italic, always black so the default stays black and white
- Leading and trailing cells filled with the adjacent month's days in light grey, with a small `Jul`/`Sep` tag in the top-right
- Irish public/bank holidays plus Good Friday and Easter Sunday support
- Optional teaching-week numbering (W1–W13 per semester) with an editable schedule
- Optional **recurring** custom dates (e.g. `every 2 weeks`, `weekly x 10`, `yearly`, `birthday`)
- Per-date label colours, plus opt-in shading themes
- Irish and UK bank-holiday calculators
- Saved calendars and reusable date groups, stored in your browser

## Using it

The whole app is the static site in `docs/`. To run it locally, open `docs/index.html`
in a browser, or serve the folder with any static file server.

Pick a year and a month (or a full year), toggle the holiday, shading and teaching-week
options, add your own dates, then click **Print** to open the browser's print dialog —
"Save as PDF" is one of the destinations. You can save a named calendar or a reusable
date group in your browser to load again later.

To send a calendar to someone else, open the **Saved calendars** panel and choose
**Copy share link** (the recipient pastes the URL and the calendar opens with all your
settings restored) or **Download as file** (a `.json` file the recipient can drop in via
**Load a file**). Both options carry the whole setup in the link or the file itself, so
nothing is uploaded to any server.

For shared sessions the app supports two more modes. They are enabled on the official
deployment at <https://danielcregg.github.io/printable-calendar-generator/>; in any
fork they stay hidden until that fork's owner deploys the optional Cloudflare Worker
themselves (see [`worker/README.md`](worker/README.md) for the one-time setup):

- **Publish read-only** — you keep one master copy and share a viewer link with as many
  people as you like. They see your latest version each time they open it; their local
  tweaks never touch your master.
- **Live share** — two or three people open the same link and every edit syncs to
  everyone within a few seconds.

Generating a PDF needs nothing online — jsPDF is bundled in `docs/vendor/`.

## GitHub Pages

The site is published straight from this repository:

1. Open repository **Settings**
2. Go to **Pages**
3. Set source to **Deploy from a branch**
4. Choose branch `main` and folder `/docs`
5. Save

## Layout options

The toolbar carries the date dropdowns; the **Setup** drawer holds the rest
(Display, Calendar Shading, Teaching weeks, Holidays, Custom dates, Save &
share):

- **Year / Month** — between the prev/next arrows, with **Full year** as an option for a 12-page PDF.
- **Display** — language (English/Gaeilge), Guidelines (the dashed writing lines), Full day names (`MON` → `MONDAY`), Teaching weeks gutter, Notes area (merges leading/trailing cells into a writing block).
- **Calendar Shading** — pick a tint (grey / blue / green / warm) and choose which slices get shaded (weekends, alternating week rows, alternating day columns).
- **Holidays** — pick a country (Ireland / United Kingdom / None) and the label colour.
- **Teaching weeks** (visible when the toggle is on) — auto-filled but editable W1/reading-week/Easter-break dates for years that don't fit the standard ATU pattern.

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
`every N <day(s)|week(s)|month(s)|year(s)>`. There's also an "Nth weekday of the
month" pattern — `first tuesday of month`, `last friday of every month`,
`2nd monday of every 3 months` — useful for things like "Child Benefit is paid on
the first Tuesday of every month". All forms accept the optional `x N` (occurrence
count) or `until YYYY-MM-DD` (end date) suffixes, in either order. Lines starting
with `#` are ignored.

A small **quick-add** form above the textarea can build the line for you: pick a date,
type a label, choose a repeat (Once, Daily, Weekly, Every 2 weeks, Monthly, Yearly),
optionally type a number of occurrences, and click **Add** — the correctly formatted
entry is appended to the textarea.

You can also click any day in the preview to add a date. If a day has more than one
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

## Development

The app is plain HTML, CSS and JS in `docs/` with no build step. Open `docs/index.html`
in a browser, or serve the folder with any static server:

```bash
cd docs
python3 -m http.server 8000
```

A small browser-based test runner lives at `docs/tests.html` and exercises the pure
helpers (date math, holidays, recurrence parser, layout helpers).

## Known limitations

- **Holidays**: Ireland (`IE`) and United Kingdom (`GB`) only. Holiday labels are always in English (the Language option only switches the month and weekday names on the calendar grid).
- **Layout**: Monday-first only; portrait orientation is not available; the page is A4 only.
- **Year range**: the dropdown lists from the current year through 2099 — past years are not selectable from the controls.
- **Saved data**: saved calendars and date groups live in your browser's `localStorage`. Clearing browser data, switching devices, or private browsing will lose them. A single calendar can be moved across browsers via the share link or the `.json` export; date groups have no export.
- **Print orientation**: the PDF is landscape; some browsers' print dialogs default to portrait and need a one-click change to landscape.
- **Preview fidelity**: the on-screen canvas preview uses the browser's font rendering and is approximate. The downloaded PDF is the print-quality output.

## License

MIT
