from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, Iterable


@dataclass(frozen=True)
class CalendarLabel:
    date: date
    label: str


def easter_sunday(year: int) -> date:
    """Return Western/Gregorian Easter Sunday using the Anonymous Gregorian algorithm."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def first_monday(year: int, month: int) -> date:
    d = date(year, month, 1)
    return d + timedelta(days=(7 - d.weekday()) % 7)


def last_monday(year: int, month: int) -> date:
    if month == 12:
        d = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        d = date(year, month + 1, 1) - timedelta(days=1)
    return d - timedelta(days=d.weekday())


def st_brigids_day(year: int) -> date:
    """Irish St Brigid's Day public holiday.

    It is 1 February when that date is a Friday, otherwise the first Monday in February.
    """
    feb_1 = date(year, 2, 1)
    if feb_1.weekday() == 4:  # Friday
        return feb_1
    return first_monday(year, 2)


def observed_christmas_labels(year: int) -> Dict[date, str]:
    """Return Christmas/St Stephen's Day and common substitute weekday labels.

    Ireland's public-holiday entitlements can be handled in several ways by employers.
    For a practical wall calendar, we show the named dates and the commonly observed
    substitute weekdays when Christmas Day or St Stephen's Day fall on a weekend.
    """
    labels: Dict[date, str] = {
        date(year, 12, 25): "Christmas Day",
        date(year, 12, 26): "St Stephen's Day",
    }

    christmas = date(year, 12, 25)
    stephens = date(year, 12, 26)

    if christmas.weekday() == 5:  # Saturday
        labels[date(year, 12, 27)] = "Christmas observed"
        labels[date(year, 12, 28)] = "St Stephen's observed"
    elif christmas.weekday() == 6:  # Sunday
        labels[date(year, 12, 26)] = "St Stephen's Day"
        labels[date(year, 12, 27)] = "Christmas observed"
    elif stephens.weekday() == 5:  # Saturday
        labels[date(year, 12, 28)] = "St Stephen's observed"
    elif stephens.weekday() == 6:  # Sunday
        labels[date(year, 12, 28)] = "St Stephen's observed"

    return labels


def ireland_holidays(year: int) -> Dict[date, str]:
    easter = easter_sunday(year)
    labels: Dict[date, str] = {
        date(year, 1, 1): "New Year's Day",
        st_brigids_day(year): "St Brigid's Day",
        date(year, 3, 17): "St Patrick's Day",
        easter - timedelta(days=2): "Good Friday",
        easter: "Easter Sunday",
        easter + timedelta(days=1): "Easter Monday",
        first_monday(year, 5): "May Bank Holiday",
        first_monday(year, 6): "June Bank Holiday",
        first_monday(year, 8): "August Bank Holiday",
        last_monday(year, 10): "October Bank Holiday",
    }
    labels.update(observed_christmas_labels(year))
    return labels


def holidays_for_country(year: int, country: str | None) -> Dict[date, str]:
    country_code = (country or "").upper()
    if country_code in {"IE", "IRELAND"}:
        return ireland_holidays(year)
    return {}


def merge_labels(*sources: Iterable[CalendarLabel] | Dict[date, str]) -> Dict[date, str]:
    merged: Dict[date, str] = {}
    for source in sources:
        if isinstance(source, dict):
            for d, label in source.items():
                merged[d] = label if d not in merged else f"{merged[d]} / {label}"
        else:
            for item in source:
                merged[item.date] = item.label if item.date not in merged else f"{merged[item.date]} / {item.label}"
    return merged
