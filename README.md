# Printable Calendar Generator

A clean, reproducible A4 calendar generator for printable wall calendars.

The design is intentionally simple and non-fussy:

- A4 landscape pages
- large bold month title
- Monday-start weeks
- bold weekday headers and date numbers
- lightly shaded weekends
- three dashed writing guide lines per day box
- optional holiday labels in the bottom-left corner
- Irish public/bank holidays plus Good Friday and Easter Sunday support
- optional custom dates such as birthdays, school starts, appointments, or reminders

## Python PDF generator

Install dependencies:

```bash
pip install -r requirements.txt
```

Generate a full year:

```bash
python -m generator.calendar_pdf --year 2026 --country IE --output output/irish_calendar_2026.pdf
```

Generate one month:

```bash
python -m generator.calendar_pdf --year 2026 --month 6 --country IE --output output/june_2026.pdf
```

Generate without holidays:

```bash
python -m generator.calendar_pdf --year 2026 --month 6 --no-holidays --output output/june_2026_plain.pdf
```

Add custom dates with JSON:

```bash
python -m generator.calendar_pdf --year 2026 --country IE --custom-dates custom_dates.example.json --output output/calendar_2026.pdf
```

## GitHub Pages web app

The static web app lives in `docs/`. It can be served by GitHub Pages.

In GitHub:

1. Open repository **Settings**
2. Go to **Pages**
3. Set source to **Deploy from a branch**
4. Choose branch `main` and folder `/docs`
5. Save

The web version lets people choose a year, toggle Irish holidays, add custom dates, and download a PDF in the same style.

## Custom dates format

See `custom_dates.example.json`.

```json
[
  { "date": "2026-09-01", "label": "School Starts" },
  { "date": "2026-11-12", "label": "Birthday" }
]
```

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

If Christmas Day or St Stephen's Day falls on a weekend, the generator also labels the common observed substitute weekdays.

## License

MIT
