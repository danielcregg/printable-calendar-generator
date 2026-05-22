from __future__ import annotations

import argparse
import calendar
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .holidays import holidays_for_country

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

WEEKDAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


def month_rows(year: int, month: int) -> int:
    first = date(year, month, 1)
    days = calendar.monthrange(year, month)[1]
    return 5 if first.weekday() + days <= 35 else 6


def load_custom_dates(path: str | None) -> Dict[date, str]:
    if not path:
        return {}
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    labels: Dict[date, str] = {}
    for item in data:
        d = datetime.strptime(item["date"], "%Y-%m-%d").date()
        label = str(item["label"]).strip()
        if not label:
            continue
        labels[d] = label if d not in labels else f"{labels[d]} / {label}"
    return labels


def labels_for_date(labels: Dict[date, str], d: date) -> str | None:
    return labels.get(d)


def draw_month(
    c: canvas.Canvas,
    year: int,
    month: int,
    labels: Dict[date, str],
    *,
    shade_weekends: bool = True,
    guide_lines: bool = True,
) -> None:
    page_w, page_h = landscape(A4)

    margin = 10 * mm
    usable_w = page_w - 2 * margin
    usable_h = page_h - 2 * margin

    # Tuned from the printed prototype: title sits just below the printer-safe top area;
    # grid rises close to the weekday row so the boxes have maximum writing room.
    header_h = 22 * mm
    grid_h = usable_h - header_h
    grid_y0 = margin
    grid_y1 = margin + grid_h

    title_y = page_h - margin - 8 * mm
    c.setFont("Helvetica-Bold", 40)
    c.setFillColor(colors.black)
    c.drawCentredString(page_w / 2, title_y, f"{MONTH_NAMES[month - 1]} {year}")

    first_day = date(year, month, 1)
    days = calendar.monthrange(year, month)[1]
    rows = month_rows(year, month)
    cols = 7
    col_w = usable_w / cols
    row_h = grid_h / rows

    if shade_weekends:
        c.setFillColor(colors.Color(0.92, 0.92, 0.92))
        for col in [5, 6]:
            x = margin + col * col_w
            c.rect(x, grid_y0, col_w, grid_h, stroke=0, fill=1)
        c.setFillColor(colors.black)

    c.setFont("Helvetica-Bold", 20)
    header_y = grid_y1 + 1.5 * mm
    for i, weekday in enumerate(WEEKDAY_HEADERS):
        x = margin + i * col_w + col_w / 2
        c.drawCentredString(x, header_y, weekday)

    if guide_lines:
        c.setStrokeColor(colors.Color(0.75, 0.75, 0.75))
        c.setLineWidth(0.6)
        c.setDash(2, 3)
        for r in range(rows):
            for col in range(cols):
                x0 = margin + col * col_w + 3 * mm
                x1 = margin + (col + 1) * col_w - 3 * mm
                yb = grid_y0 + (rows - 1 - r) * row_h
                yt = yb + row_h
                y_start = yt - 10 * mm
                y_end = yb + 2 * mm
                spacing = (y_start - y_end) / 4
                for k in range(1, 4):
                    y = y_start - k * spacing
                    c.line(x0, y, x1, y)

    c.setDash()
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.6)
    c.rect(margin, grid_y0, usable_w, grid_h)
    for i in range(1, cols):
        x = margin + i * col_w
        c.line(x, grid_y0, x, grid_y0 + grid_h)
    for j in range(1, rows):
        y = grid_y0 + j * row_h
        c.line(margin, y, margin + usable_w, y)

    current = first_day
    while current.month == month:
        offset = (current.day - 1) + first_day.weekday()
        r = offset // cols
        col = offset % cols
        y = grid_y0 + (rows - 1 - r) * row_h
        x = margin + col * col_w

        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(colors.black)
        c.drawString(x + 3.5 * mm, y + row_h - 9 * mm, str(current.day))

        label = labels_for_date(labels, current)
        if label:
            c.setFont("Helvetica-BoldOblique", 9)
            c.setFillColor(colors.black)
            c.drawString(x + 3 * mm, y + 3.5 * mm, label[:32])

        current += timedelta(days=1)

    c.showPage()


def build_labels(year: int, country: str | None, include_holidays: bool, custom_dates: str | None) -> Dict[date, str]:
    labels: Dict[date, str] = {}
    if include_holidays:
        labels.update(holidays_for_country(year, country))
    for d, label in load_custom_dates(custom_dates).items():
        labels[d] = label if d not in labels else f"{labels[d]} / {label}"
    return labels


def generate_pdf(
    output: str,
    *,
    year: int,
    month: int | None = None,
    country: str | None = "IE",
    include_holidays: bool = True,
    custom_dates: str | None = None,
    shade_weekends: bool = True,
    guide_lines: bool = True,
) -> str:
    out = Path(output)
    out.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(out), pagesize=landscape(A4))
    labels = build_labels(year, country, include_holidays, custom_dates)
    months: Iterable[int] = [month] if month else range(1, 13)
    for m in months:
        if m is None:
            continue
        draw_month(c, year, m, labels, shade_weekends=shade_weekends, guide_lines=guide_lines)
    c.save()
    return str(out)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate clean printable A4 landscape calendars.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, choices=range(1, 13), default=None)
    parser.add_argument("--country", default="IE", help="Holiday country code. Currently IE is built in.")
    parser.add_argument("--output", required=True)
    parser.add_argument("--custom-dates", default=None, help="Path to JSON custom-date labels.")
    parser.add_argument("--no-holidays", action="store_true")
    parser.add_argument("--no-weekend-shading", action="store_true")
    parser.add_argument("--no-guide-lines", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    path = generate_pdf(
        args.output,
        year=args.year,
        month=args.month,
        country=args.country,
        include_holidays=not args.no_holidays,
        custom_dates=args.custom_dates,
        shade_weekends=not args.no_weekend_shading,
        guide_lines=not args.no_guide_lines,
    )
    print(path)


if __name__ == "__main__":
    main()
