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
  generator/
    __init__.py
    calendar_pdf.py      # ReportLab-based Python PDF generator
    holidays.py          # Holiday/date calculations
  docs/
    index.html           # GitHub Pages web app
    styles.css
    app.js               # Browser/jsPDF generator and preview
  custom_dates.example.json
  requirements.txt
  README.md
  AGENTS.md
```

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

The current printed prototype was tuned after printer testing. Be careful changing these values:

- Page: A4 landscape
- Margin: `10 mm`
- Header height: `22 mm`
- Title y-position: `page_h - margin - 8 mm` in ReportLab bottom-left coordinates
- Weekday y-position: `grid_y1 + 1.5 mm` in ReportLab bottom-left coordinates
- Date font size: `22 pt`
- Weekday font size: `20 pt`
- Month title font size: `40 pt`
- Grid line width: `1.6`
- Writing guide line style: light grey, dash pattern `2, 3`
- Holiday font: bold italic, black, about `9 pt`

If these values are changed, generate a PDF and visually inspect it before committing.

## Coordinate systems warning

The Python generator uses ReportLab, where the origin is bottom-left. The browser preview and jsPDF code use a top-left coordinate system. Do not blindly copy y-coordinate formulas between the two implementations.

Equivalent tuned positions:

- ReportLab title baseline: `page_h - margin - 8 mm`
- Browser/jsPDF title baseline: `margin + 8 mm`
- ReportLab grid bottom: `margin`
- Browser/jsPDF grid top: `margin + header_h`
- ReportLab weekday baseline: `grid_y1 + 1.5 mm`
- Browser/jsPDF weekday baseline: `margin + header_h - 1.5 mm`

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

Custom dates should use a simple, user-editable format:

```json
[
  { "date": "2026-09-01", "label": "School Starts" },
  { "date": "2026-11-12", "label": "Birthday" }
]
```

If multiple labels fall on the same date, combine them with ` / `.

## Python generator

Primary reproducible generator:

```bash
python -m generator.calendar_pdf --year 2026 --country IE --output output/irish_calendar_2026.pdf
```

Single month:

```bash
python -m generator.calendar_pdf --year 2026 --month 6 --country IE --output output/june_2026.pdf
```

With custom dates:

```bash
python -m generator.calendar_pdf --year 2026 --country IE --custom-dates custom_dates.example.json --output output/calendar_2026.pdf
```

No holidays:

```bash
python -m generator.calendar_pdf --year 2026 --no-holidays --output output/calendar_2026_plain.pdf
```

## Web app

The GitHub Pages app is in `docs/` and uses jsPDF in the browser. It should mirror the Python generator as closely as possible.

When updating calendar layout logic, update both:

- `generator/calendar_pdf.py`
- `docs/app.js`

The Python generator is the source of truth for print quality. The browser preview can be approximate, but the downloaded web PDF should match the same overall design.

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

```bash
pip install -r requirements.txt
python -m generator.calendar_pdf --year 2026 --country IE --output output/smoke_2026.pdf
python -m generator.calendar_pdf --year 2026 --month 6 --country IE --output output/smoke_june_2026.pdf
```

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
- user-importable custom dates
- Sunday-start option
- portrait option
- different paper sizes
- downloadable full-year PDF from the web app
- optional localisation of weekday/month labels
- GitHub Action to generate release PDFs automatically

Avoid adding clutter to the default design. The core value of this project is that the calendar is clean, readable, and easy to write on.
