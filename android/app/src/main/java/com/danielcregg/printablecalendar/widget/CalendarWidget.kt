package com.danielcregg.printablecalendar.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import com.danielcregg.printablecalendar.data.DayLabel
import com.danielcregg.printablecalendar.data.StubWidgetDataSource
import com.danielcregg.printablecalendar.data.WidgetDataSource
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

/**
 * Home-screen widget that displays the same A4 calendar layout the PWA / PDF
 * produces. The month is drawn into a [android.graphics.Bitmap] by
 * [WidgetCalendarRenderer] using `android.graphics.Canvas`, then shown as a single
 * Glance [Image]. A transparent grid of clickable boxes sits on top of the image
 * so each day cell still has its own deep link into the PWA.
 *
 * ## Why Bitmap instead of Glance composition
 *
 * Glance composes [RemoteViews] under the hood and is fine for simple text and
 * rows, but it can't draw what makes the print layout look like the print layout:
 *
 *   - bordered cells with day numbers anchored top-left,
 *   - dashed writing-guide lines through each cell,
 *   - holiday labels stacked in bottom-left "slots" (with bold/italic mixing),
 *   - faint adjacent-month tags in the top-right corner.
 *
 * All of those require absolute positioning and stroke control that Glance
 * doesn't expose. Drawing to a Bitmap and presenting via Image gives us the full
 * Canvas API at the cost of one tradeoff: the bitmap itself is one tap target,
 * which we work around by overlaying a transparent click grid (see [TapGrid]).
 *
 * ## Per-cell deep links
 *
 * Every day cell — current-month, leading prev-month, trailing next-month — has
 * its own `ACTION_VIEW` intent against the PWA's `?d=YYYY-MM-DD` deep link.
 * Adjacent-month cells route to their actual calendar month so the user lands
 * where they expect.
 *
 * ## Sizing & memory
 *
 * The bitmap is sized to the widget's actual pixel dimensions, capped at 700 px
 * on either axis to stay well under RemoteViews' bitmap-size limit
 * (~2 MB at ARGB_8888). On launches where the widget would render larger, the
 * bitmap is scaled down proportionally and Glance stretches it back up; the
 * print-layout proportions are preserved either way.
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
            WidgetContent(month = month, today = today, labels = labels)
        }
    }
}

/** Base URL of the deployed PWA. `?d=YYYY-MM-DD` is appended per cell. */
private const val DEEP_LINK_BASE =
    "https://danielcregg.github.io/printable-calendar-generator/"

/** Cap any axis of the rendered bitmap to this many pixels so we stay under
 *  the RemoteViews bitmap-size budget (~2 MB at ARGB_8888 ≈ 720 × 720). */
private const val BITMAP_DIMENSION_CAP_PX = 700

@Composable
private fun WidgetContent(
    month: YearMonth,
    today: LocalDate,
    labels: Map<LocalDate, List<DayLabel>>,
) {
    val context = LocalContext.current
    val size = LocalSize.current
    val density = context.resources.displayMetrics.density

    // Compute the bitmap's pixel size. Down-scale proportionally if either axis
    // would exceed the cap — keeps memory bounded for huge resized widgets.
    val rawW = (size.width.value * density).toInt().coerceAtLeast(1)
    val rawH = (size.height.value * density).toInt().coerceAtLeast(1)
    val maxAxis = maxOf(rawW, rawH).toFloat()
    val scale = if (maxAxis > BITMAP_DIMENSION_CAP_PX) BITMAP_DIMENSION_CAP_PX / maxAxis else 1f
    val widthPx = (rawW * scale).toInt().coerceAtLeast(1)
    val heightPx = (rawH * scale).toInt().coerceAtLeast(1)

    val bitmap = WidgetCalendarRenderer.render(
        widthPx = widthPx,
        heightPx = heightPx,
        month = month,
        today = today,
        labels = labels,
    )

    Box(modifier = GlanceModifier.fillMaxSize()) {
        Image(
            provider = ImageProvider(bitmap),
            contentDescription = null,
            modifier = GlanceModifier.fillMaxSize(),
            // FillBounds (not Fit) — the bitmap is rendered at the widget's
            // exact aspect ratio, so this stretches with zero distortion and
            // never letterboxes. Fit was leaving a hairline white frame on
            // some launchers where the widget content area's effective ratio
            // didn't exactly match what we sampled from LocalSize.
            contentScale = ContentScale.FillBounds,
        )
        // Invisible 7 × rows grid of clickable Boxes, laid on top of the image
        // so every cell still has its own tap target → PWA day editor.
        TapGrid(month = month)
    }
}

/**
 * Transparent grid that mirrors the bitmap's cell layout and turns each cell
 * into its own tap target. The grid skips the top ~12.5% of the widget — that's
 * the area the renderer reserves for the month title + weekday header band, so
 * taps there fall through to the underlying Image (no link, intentionally).
 */
@Composable
private fun TapGrid(month: YearMonth) {
    val size = LocalSize.current
    val firstOfMonth = month.atDay(1)
    val leading = (firstOfMonth.dayOfWeek.value + 6) % 7  // Mon = 0, Sun = 6
    val rows = if (leading + month.lengthOfMonth() <= 35) 5 else 6

    // Reserve the header band — must match WidgetCalendarRenderer's layout
    // (title 7% + weekday 4.5% = 11.5%). Taps on the title band fall through
    // to the underlying image and do nothing, which keeps the calendar title
    // a "safe zone" the user can press without accidentally opening a day.
    val headerHeightDp = (size.height.value * 0.115f).dp

    Column(modifier = GlanceModifier.fillMaxSize()) {
        Spacer(GlanceModifier.height(headerHeightDp))
        for (row in 0 until rows) {
            Row(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                for (col in 0 until 7) {
                    val cellIndex = row * 7 + col
                    val date = firstOfMonth.plusDays((cellIndex - leading).toLong())
                    Box(
                        modifier = GlanceModifier
                            .defaultWeight()
                            .fillMaxHeight()
                            .clickable(actionStartActivity(deepLinkIntentFor(date))),
                    ) {}
                }
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
