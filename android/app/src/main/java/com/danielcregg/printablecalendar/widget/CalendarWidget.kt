package com.danielcregg.printablecalendar.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.LocalSize
import com.danielcregg.printablecalendar.data.DayLabel
import com.danielcregg.printablecalendar.data.StubWidgetDataSource
import com.danielcregg.printablecalendar.data.WidgetDataSource
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Home-screen widget showing "This month" — the month name, weekday header (Mon-first),
 * and a 7-column day grid with today highlighted.
 *
 * ## Sizing
 *
 * Declared as a single resizable widget in `res/xml/widget_info.xml` covering the 2×2 →
 * 4×3 range. Glance's [SizeMode.Exact] hands us the current size on every update so we
 * can decide what to show: at compact sizes we drop the weekday header and use a
 * smaller day-cell font; at the medium 4×2 size we render the full grid with labels.
 *
 * ## Tap target
 *
 * Tapping anywhere on the widget fires an `ACTION_VIEW` intent pointed at the deployed
 * PWA, which the manifest claims via Digital Asset Links — so it opens directly in the
 * TWA host activity instead of in a browser.
 */
class CalendarWidget(
    private val dataSourceProvider: (Context) -> WidgetDataSource = { StubWidgetDataSource() },
) : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val source = dataSourceProvider(context)
        val month = source.currentMonth()
        val today = source.today()
        val labels = source.labelsFor(month)
        provideContent {
            GlanceTheme {
                WidgetContent(month = month, today = today, labels = labels)
            }
        }
    }
}

private const val DEEP_LINK_URL = "https://danielcregg.github.io/printable-calendar-generator/"

@Composable
private fun WidgetContent(
    month: YearMonth,
    today: LocalDate,
    labels: Map<LocalDate, List<DayLabel>>,
) {
    val size = LocalSize.current
    val compact = size.width < 180.dp || size.height < 180.dp

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(GlanceTheme.colors.background)
            .cornerRadius(16.dp)
            .padding(12.dp)
            .clickable(actionStartActivity(deepLinkIntent())),
    ) {
        Header(month = month)
        Spacer(GlanceModifier.height(6.dp))
        if (!compact) {
            WeekdayHeader()
            Spacer(GlanceModifier.height(2.dp))
        }
        DayGrid(month = month, today = today, labels = labels, compact = compact)
    }
}

@Composable
private fun Header(month: YearMonth) {
    val titleFormatter = DateTimeFormatter.ofPattern("LLLL yyyy", Locale.getDefault())
    Row(
        modifier = GlanceModifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = month.format(titleFormatter),
            style = TextStyle(
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = GlanceTheme.colors.onBackground,
            ),
        )
    }
}

@Composable
private fun WeekdayHeader() {
    // Monday-first weekday header. Matches the printable calendar's convention.
    val mondayFirst = listOf("M", "T", "W", "T", "F", "S", "S")
    Row(modifier = GlanceModifier.fillMaxWidth()) {
        mondayFirst.forEach { letter ->
            Text(
                text = letter,
                modifier = GlanceModifier.defaultWeight(),
                style = TextStyle(
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = GlanceTheme.colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                ),
            )
        }
    }
}

@Composable
private fun DayGrid(
    month: YearMonth,
    today: LocalDate,
    labels: Map<LocalDate, List<DayLabel>>,
    compact: Boolean,
) {
    // Monday-offset placement: how many blank cells before day 1.
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
                    val day = cellIndex - leading + 1
                    val date = if (day in 1..daysInMonth) month.atDay(day) else null
                    DayCell(
                        date = date,
                        isToday = date == today,
                        label = date?.let { labels[it]?.firstOrNull() },
                        compact = compact,
                        modifier = GlanceModifier.defaultWeight().fillMaxSize(),
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    date: LocalDate?,
    isToday: Boolean,
    label: DayLabel?,
    compact: Boolean,
    modifier: GlanceModifier,
) {
    if (date == null) {
        // Empty leading/trailing cell.
        Box(modifier = modifier) {}
        return
    }

    val numberStyle = TextStyle(
        fontSize = if (compact) 10.sp else 12.sp,
        fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
        color = if (isToday) GlanceTheme.colors.onPrimary else GlanceTheme.colors.onBackground,
        textAlign = TextAlign.Center,
    )

    val cellBackground = if (isToday) GlanceTheme.colors.primary else GlanceTheme.colors.surface

    Box(
        modifier = modifier
            .padding(1.dp)
            .background(cellBackground)
            .cornerRadius(6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = GlanceModifier.fillMaxSize().padding(2.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = date.dayOfMonth.toString(), style = numberStyle)
            if (!compact && label != null) {
                Text(
                    text = label.text,
                    style = TextStyle(
                        fontSize = 7.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isToday) GlanceTheme.colors.onPrimary
                                else GlanceTheme.colors.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        // bold-italic for custom dates would be nice but Glance doesn't
                        // currently expose italic via TextStyle — bold alone is fine
                        // for the scaffold.
                    ),
                )
            }
        }
    }
}

private fun deepLinkIntent(): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK_URL))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
