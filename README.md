# Printable Calendar Generator

A clean, browser-based generator for printable A4 wall calendars. No install and no
build step — open the page, set it up, and download a PDF.

The design is intentionally simple and non-fussy:

- A4 landscape pages
- large bold month title
- Monday-start weeks
- bold weekday headers and date numbers
- lightly shaded weekends, with optional zebra shading of alternate weeks or day columns
- three dashed writing guide lines per day box
- optional holiday labels in the bottom-left corner
- Irish public/bank holidays plus Good Friday and Easter Sunday support
- optional teaching-week numbering (W1–W13 per semester), with an editable schedule
- optional custom dates such as birthdays, school starts, appointments, or reminders
- save named calendars and reusable date groups in your browser

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

## Custom dates

Add your own dates in the **Custom dates** box, one per line, as `YYYY-MM-DD | Label`:

```
2026-09-01 | School Starts
2026-11-12 | Birthday
```

Lines starting with `#` are ignored. You can also click any day in the preview to add a
date, or import an `.ics` file (Outlook, Google, Apple) and tick the dates to include.

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
