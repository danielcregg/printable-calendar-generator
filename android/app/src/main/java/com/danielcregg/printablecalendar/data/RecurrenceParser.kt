package com.danielcregg.printablecalendar.data

import java.time.LocalDate

/**
 * Kotlin port of `parseRule`, `expandRule` and `parseCustomDates` from
 * `docs/app.js`.
 *
 * The same line shape applies: each line of the Custom dates textarea is
 *   `YYYY-MM-DD | Label [| rule]`
 * with `#`-prefixed comment lines and optional `x N` / `until …` / `except …`
 * suffixes on the rule. See `AGENTS.md` "Custom dates" for the user-facing
 * spec and `docs/tests.html` for the worked examples that drive the unit
 * tests in this module.
 *
 * Use [parseCustomDates] to convert the textarea into a `Map<ISO date, labels>`
 * over a rendered year ± 1 buffer (same as the web app).
 */
object RecurrenceParser {

    /**
     * Mon=0 … Sun=6. Matches the JS `RULE_WEEKDAYS` indexing, which is one of
     * the load-bearing details of the parser — `parseRule("first sunday of month")`
     * needs `weekday == 6`, not `weekday == 0`.
     */
    internal val WEEKDAYS: Map<String, Int> = mapOf(
        "mon" to 0, "monday" to 0,
        "tue" to 1, "tues" to 1, "tuesday" to 1,
        "wed" to 2, "wednesday" to 2,
        "thu" to 3, "thur" to 3, "thurs" to 3, "thursday" to 3,
        "fri" to 4, "friday" to 4,
        "sat" to 5, "saturday" to 5,
        "sun" to 6, "sunday" to 6,
    )

    internal val ORDINALS: Map<String, Int> = mapOf(
        "first" to 1, "1st" to 1,
        "second" to 2, "2nd" to 2,
        "third" to 3, "3rd" to 3,
        "fourth" to 4, "4th" to 4,
        "last" to -1,
    )

    /** Mirrors `Rule` in `docs/app.js`'s `parseRule` return shape. */
    data class Rule(
        val unit: String,
        val n: Int,
        val count: Int? = null,
        val until: String? = null,
        val exceptions: List<String> = emptyList(),
        // Only meaningful for unit == "nthWeekdayOfMonth":
        val ordinal: Int = 0,
        val weekday: Int = 0,
    )

    // ------------------------------------------------------------------
    // parseRule
    // ------------------------------------------------------------------

    private val EXCEPT_REGEX =
        Regex("""\s+except\s+(\d{4}-\d{2}-\d{2}(?:\s*,\s*\d{4}-\d{2}-\d{2})*)$""")
    private val UNTIL_REGEX = Regex("""\s+until\s+(\d{4}-\d{2}-\d{2})$""")
    private val COUNT_REGEX = Regex("""\s+x\s*(\d+)$""")
    private val INTERVAL_REGEX =
        Regex("""^every\s+(?:(\d+)\s+)?(day|days|week|weeks|month|months|year|years)$""")
    private val NTH_REGEX =
        Regex("""^(\S+)\s+(\S+)\s+of\s+(?:every\s+)?(?:(\d+)\s+)?months?$""")

    fun parseRule(text: String): Rule? {
        var body = text.lowercase().trim()
        if (body.isEmpty()) return null

        var count: Int? = null
        var until: String? = null
        var exceptions: List<String> = emptyList()

        // Strip optional suffixes (any order). The JS does this in a fixed-point
        // loop so e.g. `until 2026-12-31 x 5` and `x 5 until 2026-12-31` both work.
        while (true) {
            val em = EXCEPT_REGEX.find(body)
            if (em != null) {
                exceptions = em.groupValues[1].split(Regex("""\s*,\s*"""))
                body = body.substring(0, em.range.first)
                continue
            }
            val um = UNTIL_REGEX.find(body)
            if (um != null) {
                until = um.groupValues[1]
                body = body.substring(0, um.range.first)
                continue
            }
            val cm = COUNT_REGEX.find(body)
            if (cm != null) {
                count = cm.groupValues[1].toInt()
                body = body.substring(0, cm.range.first)
                continue
            }
            break
        }
        body = body.trim()

        // Shortcuts: daily / weekly / monthly / yearly
        val aliases = mapOf(
            "daily" to "day", "weekly" to "week", "monthly" to "month", "yearly" to "year",
        )
        aliases[body]?.let {
            return Rule(unit = it, n = 1, count = count, until = until, exceptions = exceptions)
        }

        // "every N unit(s)"
        INTERVAL_REGEX.matchEntire(body)?.let { m ->
            val n = m.groupValues[1].takeIf { it.isNotEmpty() }?.toInt() ?: 1
            val unit = m.groupValues[2].removeSuffix("s")
            return Rule(unit = unit, n = n, count = count, until = until, exceptions = exceptions)
        }

        // "first tuesday of month", "last friday of every month", "2nd monday of every 3 months"
        NTH_REGEX.matchEntire(body)?.let { m ->
            val ordinal = ORDINALS[m.groupValues[1]]
            val weekday = WEEKDAYS[m.groupValues[2]]
            if (ordinal != null && weekday != null) {
                val n = m.groupValues[3].takeIf { it.isNotEmpty() }?.toInt() ?: 1
                return Rule(
                    unit = "nthWeekdayOfMonth",
                    n = n,
                    count = count,
                    until = until,
                    exceptions = exceptions,
                    ordinal = ordinal,
                    weekday = weekday,
                )
            }
        }
        return null
    }

    // ------------------------------------------------------------------
    // expandRule
    // ------------------------------------------------------------------

    /** Returns the Nth occurrence of `targetWeekday` (Mon=0…Sun=6) in (year, month),
     *  or null if such an occurrence doesn't exist (e.g. 5th Tuesday of a 4-Tue month). */
    internal fun nthWeekdayOfMonth(
        year: Int,
        month: Int,
        ordinal: Int,
        targetWeekday: Int,
    ): LocalDate? {
        if (ordinal == -1) {
            val lastDay = LocalDate.of(year, month, 1).plusMonths(1).minusDays(1)
            val lastIdx = mondayIndex(lastDay)
            val diff = (lastIdx - targetWeekday + 7) % 7
            return lastDay.minusDays(diff.toLong())
        }
        val first = LocalDate.of(year, month, 1)
        val dayOfFirstMatch = ((targetWeekday - mondayIndex(first) + 7) % 7) + 1
        val day = dayOfFirstMatch + (ordinal - 1) * 7
        val daysInMonth = first.lengthOfMonth()
        return if (day > daysInMonth) null else LocalDate.of(year, month, day)
    }

    private fun mondayIndex(d: LocalDate): Int {
        // java.time: Mon=1 … Sun=7; we want Mon=0 … Sun=6.
        return d.dayOfWeek.value - 1
    }

    private const val MAX_OCCURRENCES = 5000

    /**
     * Expand a recurrence into ISO dates. Bounded by the rule's `count`/`until`
     * and the start of (`year + 2`) — the calendar only renders one year at a
     * time but recurrences can spill into adjacent years.
     *
     * Mirrors the JS generator exactly; produces a deterministic list.
     */
    fun expandRule(startIso: String, rule: Rule?, year: Int): List<String> {
        if (rule == null) return listOf(startIso)
        val out = ArrayList<String>()
        val start = LocalDate.parse(startIso)
        val untilDate = rule.until?.let { LocalDate.parse(it) }
        val stopAt = LocalDate.of(year + 2, 1, 1)
        val maxCount = (rule.count ?: Int.MAX_VALUE).coerceAtMost(MAX_OCCURRENCES)
        val exceptions = rule.exceptions.toHashSet()

        if (rule.unit == "nthWeekdayOfMonth") {
            // Walk months from the start's month; the literal start date is NOT
            // yielded — every occurrence is the computed Nth weekday.
            var cursorYear = start.year
            var cursorMonth = start.monthValue
            var i = 0
            while (i < maxCount) {
                val cursor = LocalDate.of(cursorYear, cursorMonth, 1)
                if (!cursor.isBefore(stopAt)) break
                val target = nthWeekdayOfMonth(cursorYear, cursorMonth, rule.ordinal, rule.weekday)
                if (target != null) {
                    if (untilDate != null && target.isAfter(untilDate)) break
                    val iso = target.toString()
                    if (iso !in exceptions) { out.add(iso); i++ }
                }
                // Add n months — Java does the calendar math for us.
                val next = cursor.plusMonths(rule.n.toLong())
                cursorYear = next.year
                cursorMonth = next.monthValue
            }
            return out
        }

        var current = start
        var i = 0
        loop@ while (i < maxCount) {
            if (untilDate != null && current.isAfter(untilDate)) break
            if (!current.isBefore(stopAt)) break
            val iso = current.toString()
            if (iso !in exceptions) { out.add(iso); i++ }
            current = when (rule.unit) {
                "day" -> current.plusDays(rule.n.toLong())
                "week" -> current.plusWeeks(rule.n.toLong())
                "month" -> current.plusMonths(rule.n.toLong())
                "year" -> current.plusYears(rule.n.toLong())
                else -> break@loop  // unknown unit — stop expanding.
            }
        }
        return out
    }

    // ------------------------------------------------------------------
    // parseCustomDates
    // ------------------------------------------------------------------

    private val LINE_SPLIT_REGEX = Regex("""\r?\n""")
    private val DATE_REGEX = Regex("""^\d{4}-\d{2}-\d{2}$""")

    /**
     * Parses the Custom dates textarea (one rule per line) into a map of ISO
     * date -> labels. Comment lines (`#…`) and obviously-malformed lines are
     * skipped silently. Recurring rules are expanded across the rendered year
     * (with a 1-year buffer either side, matching `expandRule`).
     */
    fun parseCustomDates(text: String, year: Int): Map<String, List<String>> {
        val labels = LinkedHashMap<String, MutableList<String>>()
        for (rawLine in text.split(LINE_SPLIT_REGEX)) {
            val line = rawLine.trim()
            if (line.isEmpty() || line.startsWith("#")) continue
            val parts = line.split("|")
            val date = parts.getOrNull(0)?.trim().orEmpty()
            val label = parts.getOrNull(1)?.trim().orEmpty()
            val ruleText = parts.drop(2).joinToString("|").trim()
            if (!DATE_REGEX.matches(date)) continue
            if (label.isEmpty()) continue
            val rule = if (ruleText.isNotEmpty()) parseRule(ruleText) else null
            for (occ in expandRule(date, rule, year)) {
                labels.getOrPut(occ) { mutableListOf() }.add(label)
            }
        }
        return labels
    }
}
