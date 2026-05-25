package com.danielcregg.printablecalendar.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import com.danielcregg.printablecalendar.R
import com.danielcregg.printablecalendar.data.DayLabel
import com.danielcregg.printablecalendar.data.StubWidgetDataSource
import com.danielcregg.printablecalendar.data.WidgetDataSource
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Home-screen widget showing "this month at a glance" — a clean Mon-first 7-column grid
 * sized to the launcher's 4×4 cell default, with today highlighted, weekend columns
 * lightly shaded, and adjacent-month leading/trailing cells filled in (matching the
 * print layout in `docs/app.js`).
 *
 * ## Per-cell deep links
 *
 * Every day cell — including the leading/trailing adjacent-month days — has its own
 * `ACTION_VIEW` intent against `.../printable-calendar-generator/?d=YYYY-MM-DD`.
 * The PWA's `loadFromQueryIfPresent` reads `?d=` and opens the day editor focused on
 * that ISO date. Adjacent-month cells link into the *actual* month their date belongs
 * to (the previous or next month), not the rendered month — so the user lands where
 * they expect.
 *
 * The deep-link host is verified via Digital Asset Links (see `digital_asset_links.json`
 * and the `<intent-filter android:autoVerify="true">` in the manifest), so taps route
 * straight into the TWA without the disambiguation dialog.
 *
 * ## Visual rules
 *
 * Follows `AGENTS.md`'s design rules where they apply to an on-screen widget:
 *
 *  - Mon-first 7-column grid.
 *  - Saturday and Sunday columns lightly shaded (`#f0f0f0` in light, `#262626` in dark).
 *  - Adjacent-month day numbers in light grey (`#a8a8a8`), no labels.
 *  - Today's cell filled with `#1a56db` (the PWA's `--primary` blue), day number in
 *    white bold; any holiday label on that cell flips to white bold too.
 *  - Holiday labels in default text colour, bold. Custom-date labels in a muted slate
 *    colour to differentiate (Glance doesn't expose italic, so colour stands in for
 *    "bold italic" from the print layout).
 *  - Month header "JUNE 2026" centred, 16 sp bold, with a slim horizontal divider
 *    immediately below.
 *
 * The writing guide lines and teaching-week gutter from the print layout are dropped:
 * the widget is a glanceable summary, not a print preview.
 *
 * ## Sizing
 *
 * Declared as a single resizable widget in `res/xml/widget_info.xml`, defaulting to
 * 4×4 launcher cells. Glance's [SizeMode.Exact] hands us the current size on every
 * update; the layout adapts within the same composable so the grid stays readable
 * down to roughly 3×3.
 */
class CalendarWidget(
    private val dataSourceProvider: (Context) -> WidgetDataSource = { StubWidgetDataSource() },
) : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val source = dataSourceProvider(context)
        val month = source.currentMonth()
        val today = source.today()
        // The grid spans the rendered month plus adjacent leading/trailing days. We
        // only fetch labels for the rendered month; adjacent-month cells stay clean
        // to match the print layout (no holiday or custom-date text on greyed days).
        val labels = source.labelsFor(month)
        provideContent {
            WidgetContent(month = month, today = today, labels = labels)
        }
    }
}

// ============================================================================
// Colour tokens
// ----------------------------------------------------------------------------
// Glance exposes two compatible ways to specify a colour:
//
//   1. `background(@ColorRes Int)` accepts a raw resource ID — Android auto-resolves
//      day/night via the values/values-night colours folder. We use this for cell
//      backgrounds where the styling cascades through `Box.background(...)`.
//
//   2. `androidx.glance.color.ColorProvider(day, night)` builds a [ColorProvider]
//      tied to system dark mode. In Glance 1.1.x the factory takes two `Long` ARGB
//      values; the `Color`-taking overload only arrives in 1.2.x. We use this for
//      text colours, which need a [ColorProvider] inside a [TextStyle] — the
//      resource-backed factory is `@RestrictTo` and can't be called from app code.
//
// Each entry below mirrors the equivalent ARGB in `res/values/colors.xml` and
// `res/values-night/colors.xml`. Keep them aligned when changing either set.
// ============================================================================

// ARGB literals wrapped in Compose Color() — Glance's ColorProvider(day, night)
// factory takes Compose Colors, not raw Longs.
private val WidgetForeground = ColorProvider(day = Color(0xFF111111), night = Color(0xFFF5F5F5))
private val WidgetOnPrimary = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFFFFFFFF))
private val WidgetAdjacent = ColorProvider(day = Color(0xFFA8A8A8), night = Color(0xFF5C5C5C))
private val WidgetLabelMuted = ColorProvider(day = Color(0xFF64748B), night = Color(0xFF94A3B8))

/** Base URL of the deployed PWA. `?d=YYYY-MM-DD` is appended per cell. */
private const val DEEP_LINK_BASE =
    "https://danielcregg.github.io/printable-calendar-generator/"

@Composable
private fun WidgetContent(
    month: YearMonth,
    today: LocalDate,
    labels: Map<LocalDate, List<DayLabel>>,
) {
    // Root no longer carries its own clickable — each DayCell owns its tap target so
    // a tap goes to the day that was touched, not the whole widget.
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(R.color.widget_background)
            .cornerRadius(16.dp)
            .padding(12.dp),
    ) {
        Header(month = month)
        Divider()
        Spacer(GlanceModifier.height(6.dp))
        WeekdayHeader()
        Spacer(GlanceModifier.height(2.dp))
        DayGrid(month = month, today = today, labels = labels)
    }
}

@Composable
private fun Header(month: YearMonth) {
    // "JUNE 2026" centred, 16sp bold — matches AGENTS.md's "month name bold, year
    // regular" idea, condensed for the widget where there is no room for a separate
    // year stamp. The print layout's strict left/right split would be wasted at this
    // size; a single centred title reads better.
    val titleFormatter = DateTimeFormatter.ofPattern("LLLL yyyy", Locale.getDefault())
    val title = month.format(titleFormatter).uppercase(Locale.getDefault())
    Row(
        modifier = GlanceModifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = WidgetForeground,
                textAlign = TextAlign.Center,
            ),
        )
    }
}

@Composable
private fun Divider() {
    // Slim horizontal divider directly under the month header. 1 dp tall, in the
    // theme's `widget_divider` colour — light grey on light, dim grey on dark.
    Spacer(GlanceModifier.height(6.dp))
    Box(
        modifier = GlanceModifier
            .fillMaxWidth()
            .height(1.dp)
            .background(R.color.widget_divider),
    ) {}
}

@Composable
private fun WeekdayHeader() {
    // Monday-first weekday header. Matches the print layout's MON/TUE/… style, but
    // single letters because a widget cell is too narrow for three-letter labels.
    val mondayFirst = listOf("M", "T", "W", "T", "F", "S", "S")
    Row(modifier = GlanceModifier.fillMaxWidth()) {
        mondayFirst.forEachIndexed { index, letter ->
            val isWeekend = index >= 5  // Sat (5) and Sun (6)
            val bgRes = if (isWeekend) R.color.widget_weekend else R.color.widget_background
            Box(
                modifier = GlanceModifier
                    .defaultWeight()
                    .background(bgRes)
                    .padding(vertical = 2.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = letter,
                    style = TextStyle(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = WidgetForeground,
                        textAlign = TextAlign.Center,
                    ),
                )
            }
        }
    }
}

@Composable
private fun DayGrid(
    month: YearMonth,
    today: LocalDate,
    labels: Map<LocalDate, List<DayLabel>>,
) {
    // Monday-offset placement: how many adjacent-month days lead the grid before day 1.
    val firstOfMonth = month.atDay(1)
    val leading = (firstOfMonth.dayOfWeek.value + 6) % 7  // Mon=0 .. Sun=6
    val daysInMonth = month.lengthOfMonth()
    val totalCells = leading + daysInMonth
    val rows = (totalCells + 6) / 7  // 5 or 6 rows depending on month

    Column(modifier = GlanceModifier.fillMaxSize()) {
        for (row in 0 until rows) {
            Row(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                for (col in 0 until 7) {
                    val cellIndex = row * 7 + col
                    // Compute the actual date for this cell — leading cells go into
                    // the previous month, trailing into the next, so every cell is
                    // tappable to a real date (matching the print layout).
                    val date = firstOfMonth.plusDays((cellIndex - leading).toLong())
                    val inCurrentMonth = YearMonth.from(date) == month
                    val isWeekend = col >= 5
                    DayCell(
                        date = date,
                        inCurrentMonth = inCurrentMonth,
                        isToday = inCurrentMonth && date == today,
                        isWeekend = isWeekend,
                        label = if (inCurrentMonth) labels[date]?.firstOrNull() else null,
                        // defaultWeight() handles 1/7 horizontal distribution; fillMaxHeight
                        // stretches the cell vertically. Using fillMaxSize() here would
                        // include fillMaxWidth(), which fights the weight and made each cell
                        // claim the whole row — only column 0 ever rendered.
                        modifier = GlanceModifier.defaultWeight().fillMaxHeight(),
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    date: LocalDate,
    inCurrentMonth: Boolean,
    isToday: Boolean,
    isWeekend: Boolean,
    label: DayLabel?,
    modifier: GlanceModifier,
) {
    // Background priority: today > weekend tint > plain widget background.
    val backgroundRes = when {
        isToday -> R.color.widget_today
        isWeekend -> R.color.widget_weekend
        else -> R.color.widget_background
    }

    // Day-number colour: today white, adjacent-month grey, otherwise default fg.
    val numberColor = when {
        isToday -> WidgetOnPrimary
        !inCurrentMonth -> WidgetAdjacent
        else -> WidgetForeground
    }

    val numberStyle = TextStyle(
        fontSize = 12.sp,
        // Bold for today and current-month days; regular for adjacent-month (the
        // print layout uses light grey + bold there, but the widget leans further into
        // the "this isn't the rendered month" hint with a lighter weight too).
        fontWeight = if (!inCurrentMonth) FontWeight.Normal else FontWeight.Bold,
        color = numberColor,
        textAlign = TextAlign.Center,
    )

    // Label colour: white on today, muted slate for custom dates, default fg for holidays.
    val labelColor = when {
        isToday -> WidgetOnPrimary
        label?.kind == DayLabel.Kind.CUSTOM -> WidgetLabelMuted
        else -> WidgetForeground
    }

    Box(
        modifier = modifier
            .padding(1.dp)
            .background(backgroundRes)
            .cornerRadius(6.dp)
            .clickable(actionStartActivity(deepLinkIntentFor(date))),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = GlanceModifier.fillMaxSize().padding(2.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = date.dayOfMonth.toString(), style = numberStyle)
            // Adjacent-month cells stay clean — matches the print layout's behaviour
            // of greying out leading/trailing day numbers with no holiday text.
            if (inCurrentMonth && label != null) {
                Text(
                    text = label.text,
                    style = TextStyle(
                        fontSize = 7.sp,
                        // Holidays are bold per spec; custom dates also bold (Glance
                        // doesn't expose italic — we already differentiate by colour).
                        fontWeight = FontWeight.Bold,
                        color = labelColor,
                        textAlign = TextAlign.Center,
                    ),
                )
            }
        }
    }
}

/**
 * Build a deep-link intent for a specific date. The PWA reads `?d=YYYY-MM-DD` in
 * `loadFromQueryIfPresent` and opens the day editor pre-focused on it.
 */
private fun deepLinkIntentFor(date: LocalDate): Intent {
    val iso = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
    val uri = Uri.parse("$DEEP_LINK_BASE?d=$iso")
    return Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
