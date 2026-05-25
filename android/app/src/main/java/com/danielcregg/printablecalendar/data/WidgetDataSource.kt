package com.danielcregg.printablecalendar.data

import java.time.LocalDate
import java.time.YearMonth

/**
 * Read-only data source for the home-screen widget.
 *
 * The widget needs *just* enough information to render the current month:
 *
 *  - which month/year to show (almost always "now"),
 *  - which day is "today" so it can be highlighted,
 *  - any custom-date or holiday labels for the days in that month.
 *
 * It deliberately does not surface the full PDF/layout engine — the widget is a glanceable
 * summary, not a rendering of the printable A4 sheet.
 *
 * ## Implementations
 *
 *  - [StubWidgetDataSource] returns hardcoded sample data. This is what the scaffold
 *    currently uses so the widget compiles and renders without any backend.
 *  - **TODO (parent task / future work):** add a `WorkerWidgetDataSource` that reads
 *    the published calendar from the Cloudflare Worker described in `worker/share.js`,
 *    at `GET /view/<readId>`. The user enters their `readId` (or `?view=…` URL) in the
 *    settings screen, the app caches the JSON payload locally, and the widget pulls
 *    the labels for the current month out of it.
 *
 *    See `worker/README.md` and `AGENTS.md` ("Shared sessions") for the protocol.
 *    The payload shape is `{ v, name, settings }` where `settings.customDates` is the
 *    raw `YYYY-MM-DD | Label [| rule]` list — the same parser/recurrence-expander logic
 *    in `docs/app.js` will need to be ported (or a much smaller subset that only
 *    expands to dates inside the current month).
 */
interface WidgetDataSource {

    /** The month the widget should render. Stub returns [YearMonth.now]. */
    fun currentMonth(): YearMonth

    /** Today's date — used to highlight a single cell. */
    fun today(): LocalDate

    /**
     * Labels to show on individual days (holidays + custom dates). The widget only has
     * room for the first label per day; longer lists are dropped silently.
     */
    fun labelsFor(month: YearMonth): Map<LocalDate, List<DayLabel>>
}

/**
 * A single label on a day cell.
 *
 * @param text The short label shown in the cell. Keep it tiny — there is no room.
 * @param kind Holiday vs custom date; the widget styles them differently.
 */
data class DayLabel(
    val text: String,
    val kind: Kind,
) {
    enum class Kind { HOLIDAY, CUSTOM }
}
