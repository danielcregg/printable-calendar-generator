package com.danielcregg.printablecalendar.data

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Kotlin port of `irelandHolidays(year)` from `docs/app.js`.
 *
 * Returns a map of ISO date string -> holiday label for the Republic of Ireland
 * for a given year. Easter is computed via the Anonymous Gregorian algorithm
 * (same as the JS version), and observed/substitute Christmas + St Stephen's
 * Day labels are emitted when 25/26 December fall on a weekend.
 *
 * The widget renders these as short labels — the JS app already keeps them
 * compact ("New Year's Day", "St Brigid's Day", …) so the same strings work
 * for the widget when truncated.
 */
object IrelandHolidays {

    /** Public entry: ISO date string -> label. Keyed by ISO so it lines up with
     *  the worker's `customDates` parsing (which also uses ISO strings). */
    fun forYear(year: Int): Map<String, String> {
        val labels = LinkedHashMap<String, String>()
        val easter = easterSunday(year)
        labels[iso(LocalDate.of(year, 1, 1))] = "New Year's Day"
        labels[iso(stBrigidsDay(year))] = "St Brigid's Day"
        labels[iso(LocalDate.of(year, 3, 17))] = "St Patrick's Day"
        labels[iso(easter.minusDays(2))] = "Good Friday"
        labels[iso(easter)] = "Easter Sunday"
        labels[iso(easter.plusDays(1))] = "Easter Monday"
        // The JS uses month indices 4/5/7/9 — which are May/June/August/October.
        labels[iso(firstMonday(year, 5))] = "May Bank Holiday"
        labels[iso(firstMonday(year, 6))] = "June Bank Holiday"
        labels[iso(firstMonday(year, 8))] = "August Bank Holiday"
        labels[iso(lastMonday(year, 10))] = "October Bank Holiday"
        labels[iso(LocalDate.of(year, 12, 25))] = "Christmas Day"
        labels[iso(LocalDate.of(year, 12, 26))] = "St Stephen's Day"

        val christmas = LocalDate.of(year, 12, 25)
        val stephens = LocalDate.of(year, 12, 26)
        when {
            christmas.dayOfWeek == DayOfWeek.SATURDAY -> {
                labels[iso(LocalDate.of(year, 12, 27))] = "Christmas observed"
                labels[iso(LocalDate.of(year, 12, 28))] = "St Stephen's observed"
            }
            christmas.dayOfWeek == DayOfWeek.SUNDAY -> {
                labels[iso(LocalDate.of(year, 12, 27))] = "Christmas observed"
            }
            stephens.dayOfWeek == DayOfWeek.SATURDAY || stephens.dayOfWeek == DayOfWeek.SUNDAY -> {
                labels[iso(LocalDate.of(year, 12, 28))] = "St Stephen's observed"
            }
        }
        return labels
    }

    /**
     * Anonymous Gregorian algorithm — mirrors `easterSunday(year)` in app.js.
     * Returns the [LocalDate] of Easter Sunday for the given year.
     */
    internal fun easterSunday(year: Int): LocalDate {
        val a = year % 19
        val b = year / 100
        val c = year % 100
        val d = b / 4
        val e = b % 4
        val f = (b + 8) / 25
        val g = (b - f + 1) / 3
        val h = (19 * a + b - d - g + 15) % 30
        val i = c / 4
        val k = c % 4
        val l = (32 + 2 * e + 2 * i - h - k) % 7
        val m = (a + 11 * h + 22 * l) / 451
        val month = (h + l - 7 * m + 114) / 31
        val day = ((h + l - 7 * m + 114) % 31) + 1
        return LocalDate.of(year, month, day)
    }

    /** St Brigid's Day is Feb 1 if Feb 1 is a Friday; otherwise the first Monday of Feb. */
    internal fun stBrigidsDay(year: Int): LocalDate {
        val feb1 = LocalDate.of(year, 2, 1)
        return if (feb1.dayOfWeek == DayOfWeek.FRIDAY) feb1 else firstMonday(year, 2)
    }

    /** First Monday on or after the 1st of `month` (1-indexed) in `year`. */
    internal fun firstMonday(year: Int, month: Int): LocalDate {
        val d = LocalDate.of(year, month, 1)
        val offset = (8 - d.dayOfWeek.value) % 7  // Mon=1 in java.time; 0 when already Mon
        return d.plusDays(offset.toLong())
    }

    /** Last Monday on or before the last day of `month` in `year`. */
    internal fun lastMonday(year: Int, month: Int): LocalDate {
        val last = LocalDate.of(year, month, 1).plusMonths(1).minusDays(1)
        // java.time: Mon=1 … Sun=7; subtract (dayOfWeek - 1) to reach the preceding Mon.
        val back = last.dayOfWeek.value - 1
        return last.minusDays(back.toLong())
    }

    private fun iso(date: LocalDate): String = date.toString()
}
