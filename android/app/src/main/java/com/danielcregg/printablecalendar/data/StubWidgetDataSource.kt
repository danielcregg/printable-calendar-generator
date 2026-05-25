package com.danielcregg.printablecalendar.data

import java.time.LocalDate
import java.time.Month
import java.time.YearMonth

/**
 * Hardcoded sample data so the widget renders something useful before any real data
 * integration is wired up.
 *
 * The labels are drawn from the project's Ireland holiday policy (see `AGENTS.md`).
 * They are *static* — there is no holiday math here. Replacing this with a real
 * implementation (see [WidgetDataSource]'s TODO) will fix the dates automatically.
 */
class StubWidgetDataSource(
    private val clock: () -> LocalDate = LocalDate::now,
) : WidgetDataSource {

    override fun currentMonth(): YearMonth = YearMonth.from(clock())

    override fun today(): LocalDate = clock()

    override fun labelsFor(month: YearMonth): Map<LocalDate, List<DayLabel>> {
        // A small, fixed sampler so every month has at least one label visible during
        // development. Real holidays are a port of `irelandHolidays` in docs/app.js.
        val samples = buildList {
            when (month.month) {
                Month.JANUARY -> add(month.atDay(1) to listOf(holiday("New Year")))
                Month.FEBRUARY -> add(month.atDay(2) to listOf(holiday("St Brigid")))
                Month.MARCH -> add(month.atDay(17) to listOf(holiday("St Patrick")))
                Month.APRIL -> add(month.atDay(5) to listOf(holiday("Easter Sun")))
                Month.MAY -> add(month.atDay(4) to listOf(holiday("May BH")))
                Month.JUNE -> add(month.atDay(1) to listOf(holiday("June BH")))
                Month.JULY -> add(month.atDay(12) to listOf(custom("Birthday")))
                Month.AUGUST -> add(month.atDay(3) to listOf(holiday("Aug BH")))
                Month.SEPTEMBER -> add(month.atDay(1) to listOf(custom("School")))
                Month.OCTOBER -> add(month.atDay(26) to listOf(holiday("Oct BH")))
                Month.NOVEMBER -> add(month.atDay(11) to listOf(custom("Birthday")))
                Month.DECEMBER -> {
                    add(month.atDay(25) to listOf(holiday("Christmas")))
                    add(month.atDay(26) to listOf(holiday("St Stephen")))
                }
            }
        }
        return samples.toMap()
    }

    private fun holiday(text: String) = DayLabel(text, DayLabel.Kind.HOLIDAY)
    private fun custom(text: String) = DayLabel(text, DayLabel.Kind.CUSTOM)
}
