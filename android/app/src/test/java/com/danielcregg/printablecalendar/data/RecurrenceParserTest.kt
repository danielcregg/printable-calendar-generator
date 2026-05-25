package com.danielcregg.printablecalendar.data

import com.danielcregg.printablecalendar.data.RecurrenceParser.Rule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Kotlin counterpart of `docs/tests.js` for the recurrence rules. Cases below
 * mirror the ones in the JS test page so the two implementations stay in
 * lockstep — if the JS port and this port disagree, the printable calendar
 * and the widget will drift in places like "every 2 weeks until ..." and
 * that's exactly the bug class these tests are here to prevent.
 */
class RecurrenceParserTest {

    // ---------- parseRule ----------

    @Test fun `parseRule weekly`() {
        assertEquals(
            Rule(unit = "week", n = 1),
            RecurrenceParser.parseRule("weekly"),
        )
    }

    @Test fun `parseRule yearly`() {
        assertEquals(
            Rule(unit = "year", n = 1),
            RecurrenceParser.parseRule("yearly"),
        )
    }

    @Test fun `parseRule every 2 weeks`() {
        assertEquals(
            Rule(unit = "week", n = 2),
            RecurrenceParser.parseRule("every 2 weeks"),
        )
    }

    @Test fun `parseRule every week with no explicit N`() {
        assertEquals(
            Rule(unit = "week", n = 1),
            RecurrenceParser.parseRule("every week"),
        )
    }

    @Test fun `parseRule weekly x 10`() {
        assertEquals(
            Rule(unit = "week", n = 1, count = 10),
            RecurrenceParser.parseRule("weekly x 10"),
        )
    }

    @Test fun `parseRule every 2 weeks until DATE`() {
        assertEquals(
            Rule(unit = "week", n = 2, until = "2026-12-31"),
            RecurrenceParser.parseRule("every 2 weeks until 2026-12-31"),
        )
    }

    @Test fun `parseRule until DATE then x N (reversed)`() {
        assertEquals(
            Rule(unit = "week", n = 2, count = 5, until = "2026-12-31"),
            RecurrenceParser.parseRule("every 2 weeks until 2026-12-31 x 5"),
        )
    }

    @Test fun `parseRule case insensitive shortcut`() {
        assertEquals(
            Rule(unit = "month", n = 1),
            RecurrenceParser.parseRule("MONTHLY"),
        )
    }

    @Test fun `parseRule nonsense returns null`() {
        assertNull(RecurrenceParser.parseRule("once a fortnight"))
    }

    @Test fun `parseRule first tuesday of month`() {
        assertEquals(
            Rule(unit = "nthWeekdayOfMonth", n = 1, ordinal = 1, weekday = 1),
            RecurrenceParser.parseRule("first tuesday of month"),
        )
    }

    @Test fun `parseRule last friday of every month`() {
        assertEquals(
            Rule(unit = "nthWeekdayOfMonth", n = 1, ordinal = -1, weekday = 4),
            RecurrenceParser.parseRule("last friday of every month"),
        )
    }

    @Test fun `parseRule 2nd monday of every 3 months with x 4`() {
        assertEquals(
            Rule(unit = "nthWeekdayOfMonth", n = 3, count = 4, ordinal = 2, weekday = 0),
            RecurrenceParser.parseRule("2nd monday of every 3 months x 4"),
        )
    }

    @Test fun `parseRule except DATE suffix`() {
        assertEquals(
            Rule(unit = "week", n = 2, exceptions = listOf("2026-04-06")),
            RecurrenceParser.parseRule("every 2 weeks except 2026-04-06"),
        )
    }

    @Test fun `parseRule except combines with until and x N`() {
        assertEquals(
            Rule(
                unit = "week",
                n = 2,
                count = 10,
                until = "2026-12-31",
                exceptions = listOf("2026-04-06"),
            ),
            RecurrenceParser.parseRule("every 2 weeks x 10 until 2026-12-31 except 2026-04-06"),
        )
    }

    // ---------- expandRule ----------

    @Test fun `expandRule no rule yields just the start`() {
        assertEquals(
            listOf("2026-09-08"),
            RecurrenceParser.expandRule("2026-09-08", null, 2026),
        )
    }

    @Test fun `expandRule yearly stops at year plus 2`() {
        assertEquals(
            listOf("2024-01-12", "2025-01-12", "2026-01-12", "2027-01-12"),
            RecurrenceParser.expandRule(
                "2024-01-12",
                Rule(unit = "year", n = 1),
                2026,
            ),
        )
    }

    @Test fun `expandRule every 2 weeks x 4 (cap-by-count)`() {
        assertEquals(
            listOf("2026-09-08", "2026-09-22", "2026-10-06", "2026-10-20"),
            RecurrenceParser.expandRule(
                "2026-09-08",
                Rule(unit = "week", n = 2, count = 4),
                2026,
            ),
        )
    }

    @Test fun `expandRule every 2 weeks until DATE (cap-by-until)`() {
        // Start 2026-04-01 (Wed), step 2 weeks, stop after 2026-06-30.
        val out = RecurrenceParser.expandRule(
            "2026-04-01",
            Rule(unit = "week", n = 2, until = "2026-06-30"),
            2026,
        )
        assertEquals(
            listOf(
                "2026-04-01",
                "2026-04-15",
                "2026-04-29",
                "2026-05-13",
                "2026-05-27",
                "2026-06-10",
                "2026-06-24",
            ),
            out,
        )
    }

    @Test fun `expandRule first tuesday of month (literal start not yielded)`() {
        // The start 2026-01-15 is a Thursday; the rule yields the first Tuesday
        // of each month starting in January (so 2026-01-06, then 2026-02-03), NOT
        // the literal start date.
        assertEquals(
            listOf("2026-01-06", "2026-02-03"),
            RecurrenceParser.expandRule(
                "2026-01-15",
                Rule(
                    unit = "nthWeekdayOfMonth",
                    n = 1,
                    count = 2,
                    ordinal = 1,
                    weekday = 1,
                ),
                2026,
            ),
        )
    }

    @Test fun `expandRule except skips a single occurrence`() {
        assertEquals(
            listOf("2026-09-08", "2026-10-06", "2026-10-20", "2026-11-03"),
            RecurrenceParser.expandRule(
                "2026-09-08",
                Rule(unit = "week", n = 2, count = 4, exceptions = listOf("2026-09-22")),
                2026,
            ),
        )
    }

    @Test fun `nthWeekdayOfMonth returns null when no 5th occurrence`() {
        // May 2026 has only 4 Tuesdays (5, 12, 19, 26).
        assertNull(RecurrenceParser.nthWeekdayOfMonth(2026, 5, 5, 1))
    }

    // ---------- parseCustomDates ----------

    @Test fun `parseCustomDates handles one-off date`() {
        val m = RecurrenceParser.parseCustomDates("2026-09-01 | School", 2026)
        assertEquals(1, m.size)
        assertEquals(listOf("School"), m["2026-09-01"])
    }

    @Test fun `parseCustomDates skips comment lines`() {
        val m = RecurrenceParser.parseCustomDates(
            """
            # this is a header comment
            2026-07-09 | X
            """.trimIndent(),
            2026,
        )
        assertEquals(1, m.size)
        assertEquals(listOf("X"), m["2026-07-09"])
    }

    @Test fun `parseCustomDates expands recurring rule`() {
        val m = RecurrenceParser.parseCustomDates("2026-09-15 | Swim | weekly x 3", 2026)
        assertEquals(3, m.size)
        assertEquals(listOf("Swim"), m["2026-09-15"])
        assertEquals(listOf("Swim"), m["2026-09-22"])
        assertEquals(listOf("Swim"), m["2026-09-29"])
    }

    @Test fun `parseCustomDates skips an invalid line but keeps a valid one`() {
        val m = RecurrenceParser.parseCustomDates(
            """
            garbage
            2026-07-09 | X
            """.trimIndent(),
            2026,
        )
        assertEquals(1, m.size)
        assertEquals(listOf("X"), m["2026-07-09"])
    }
}
