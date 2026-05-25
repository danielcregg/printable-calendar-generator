package com.danielcregg.printablecalendar.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

/**
 * Mirror of the "Ireland holidays (2026)" block in `docs/tests.js`. Easter
 * dates and the substitute-Christmas logic come straight from the JS port —
 * if the JS file changes the algorithm, this file is the place to keep us
 * honest.
 */
class IrelandHolidaysTest {

    @Test fun `easterSunday for 2024 is March 31`() {
        assertEquals(LocalDate.of(2024, 3, 31), IrelandHolidays.easterSunday(2024))
    }

    @Test fun `easterSunday for 2025 is April 20`() {
        assertEquals(LocalDate.of(2025, 4, 20), IrelandHolidays.easterSunday(2025))
    }

    @Test fun `easterSunday for 2026 is April 5`() {
        assertEquals(LocalDate.of(2026, 4, 5), IrelandHolidays.easterSunday(2026))
    }

    @Test fun `easterSunday for 2027 is March 28`() {
        assertEquals(LocalDate.of(2027, 3, 28), IrelandHolidays.easterSunday(2027))
    }

    @Test fun `St Brigid 2025 falls on the first Monday`() {
        // 2025-02-01 is a Saturday → St Brigid moves to the first Monday, Feb 3.
        assertEquals(LocalDate.of(2025, 2, 3), IrelandHolidays.stBrigidsDay(2025))
    }

    @Test fun `St Brigid 2026 falls on the first Monday`() {
        // 2026-02-01 is a Sunday → St Brigid moves to Feb 2.
        assertEquals(LocalDate.of(2026, 2, 2), IrelandHolidays.stBrigidsDay(2026))
    }

    @Test fun `Ireland 2026 has the expected dated holidays`() {
        val h = IrelandHolidays.forYear(2026)
        assertEquals("New Year's Day", h["2026-01-01"])
        assertEquals("St Brigid's Day", h["2026-02-02"])
        assertEquals("St Patrick's Day", h["2026-03-17"])
        assertEquals("Good Friday", h["2026-04-03"])
        assertEquals("Easter Sunday", h["2026-04-05"])
        assertEquals("Easter Monday", h["2026-04-06"])
        assertEquals("May Bank Holiday", h["2026-05-04"])
        assertEquals("June Bank Holiday", h["2026-06-01"])
        assertEquals("August Bank Holiday", h["2026-08-03"])
        assertEquals("October Bank Holiday", h["2026-10-26"])
        assertEquals("Christmas Day", h["2026-12-25"])
        assertEquals("St Stephen's Day", h["2026-12-26"])
    }

    @Test fun `observed Christmas when 25 Dec is a Saturday`() {
        // 2027-12-25 is a Saturday → both observed labels appear.
        val h = IrelandHolidays.forYear(2027)
        assertEquals("Christmas observed", h["2027-12-27"])
        assertEquals("St Stephen's observed", h["2027-12-28"])
    }

    @Test fun `observed Christmas when 25 Dec is a Sunday`() {
        // 2022-12-25 is a Sunday → Christmas observed only (Dec 27 Tue).
        val h = IrelandHolidays.forYear(2022)
        assertEquals("Christmas observed", h["2022-12-27"])
    }

    @Test fun `observed St Stephens when 26 Dec is a Saturday`() {
        // 2026-12-25 is Friday so neither needs moving — but 2020-12-26 is Saturday,
        // so St Stephen's substitute is Dec 28.
        val h = IrelandHolidays.forYear(2020)
        assertEquals("St Stephen's observed", h["2020-12-28"])
    }
}
