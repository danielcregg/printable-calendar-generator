package com.danielcregg.printablecalendar.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import com.danielcregg.printablecalendar.data.DayLabel
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Bitmap renderer for the home-screen widget. Produces a pixel-accurate copy of the
 * printable A4 calendar layout — white background, bordered grid cells, day numbers
 * in the top-left, dashed writing guide lines, holiday/custom labels stacked in the
 * bottom of each cell. Mirrors the JS `drawCalendar` in docs/app.js so what you see
 * on the home screen is what comes out of the PDF.
 *
 * Sizing is relative to the widget's actual pixel dimensions. Fonts scale with the
 * cell height so a small (2×2) widget stays legible and a big (5×5) one fills the
 * available space.
 */
object WidgetCalendarRenderer {

    private const val GRID_COLOR = 0xFF222222.toInt()      // near-black
    private const val GUIDE_COLOR = 0xFFCCCCCC.toInt()     // light grey dashes
    private const val WEEKEND_COLOR = 0xFFEEEEEE.toInt()   // subtle weekend shade
    private const val ADJACENT_COLOR = 0xFFA8A8A8.toInt()  // grey for prev/next month days
    private const val ADJACENT_TAG_COLOR = 0xFF999999.toInt()
    private const val TODAY_COLOR = 0xFF1A56DB.toInt()     // PWA --primary blue
    private const val WHITE = 0xFFFFFFFF.toInt()

    private val titleFormatter = DateTimeFormatter.ofPattern("LLLL", Locale.getDefault())
    private val mondayFirstDays = listOf("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
    private val mondayFirstShort = listOf("M", "T", "W", "T", "F", "S", "S")
    private val shortMonthNames = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

    /**
     * Draws the month into a fresh bitmap of size [widthPx] × [heightPx] and returns it.
     * The bitmap uses [Bitmap.Config.ARGB_8888] for clean text. The renderer is pure —
     * no Android Context is required, so it can be called from a worker thread.
     */
    fun render(
        widthPx: Int,
        heightPx: Int,
        month: YearMonth,
        today: LocalDate?,
        labels: Map<LocalDate, List<DayLabel>>,
    ): Bitmap {
        val bmp = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val w = widthPx.toFloat()
        val h = heightPx.toFloat()

        // White paper background.
        canvas.drawColor(WHITE)

        // Layout: no inner margin — the grid runs edge to edge so the widget
        // fills its launcher slot. A small top band carries the month title +
        // weekday header. The print layout uses 7 mm paper margins, but on a
        // launcher widget the launcher already imposes its own ~8 dp padding,
        // so adding more here makes the calendar look squished inside the slot.
        val titleH = h * 0.07f       // month name band
        val weekdayH = h * 0.045f    // weekday letters band
        val headerH = titleH + weekdayH

        val gridX = 0f
        val gridY = headerH
        val gridW = w
        val gridH = h - headerH

        val rows = monthRows(month)
        val cellW = gridW / 7f
        val cellH = gridH / rows

        // ----- Title ("MAY 2026") -----------------------------------------------
        val titlePaint = textPaint(textSize = titleH * 0.7f, bold = true)
        val title = month.format(titleFormatter).uppercase(Locale.getDefault()) +
            " " + month.year
        // Centred horizontally; baseline placed near the bottom of the title band.
        val titleBaseline = titleH * 0.85f
        titlePaint.textAlign = Paint.Align.CENTER
        canvas.drawText(title, w / 2f, titleBaseline, titlePaint)

        // ----- Weekday row ------------------------------------------------------
        // MON/TUE/WED... at full size if it fits; single-letter fallback at narrow
        // widget sizes so 7 abbreviations never overlap.
        val weekdayPaint = textPaint(textSize = weekdayH * 0.55f, bold = true)
        weekdayPaint.textAlign = Paint.Align.CENTER
        val widest = mondayFirstDays.maxOf { weekdayPaint.measureText(it) }
        val labels3 = widest <= cellW - 4f
        val weekdayLabels = if (labels3) mondayFirstDays else mondayFirstShort
        val weekdayBaseline = titleH + weekdayH * 0.75f
        for (i in 0 until 7) {
            canvas.drawText(
                weekdayLabels[i],
                gridX + i * cellW + cellW / 2f,
                weekdayBaseline,
                weekdayPaint,
            )
        }

        // ----- Weekend column shading (Sat/Sun) --------------------------------
        val shadePaint = Paint().apply {
            color = WEEKEND_COLOR
            style = Paint.Style.FILL
            isAntiAlias = false
        }
        for (col in 5..6) {
            canvas.drawRect(
                gridX + col * cellW,
                gridY,
                gridX + (col + 1) * cellW,
                gridY + rows * cellH,
                shadePaint,
            )
        }

        // ----- Writing guide lines ---------------------------------------------
        // Equispaced dashes between the day-number baseline and the cell bottom.
        // 3 lines in 5-row months, 2 in 6-row months — same rule as docs/app.js.
        val guideLines = if (rows == 6) 2 else 3
        val guidePaint = Paint().apply {
            color = GUIDE_COLOR
            strokeWidth = (cellH * 0.012f).coerceAtLeast(1f)
            style = Paint.Style.STROKE
            pathEffect = DashPathEffect(floatArrayOf(cellW * 0.04f, cellW * 0.06f), 0f)
            isAntiAlias = true
        }
        val dayNumberH = cellH * 0.30f
        for (r in 0 until rows) {
            val yt = gridY + r * cellH
            val yb = yt + cellH
            val yStart = yt + dayNumberH
            val spacing = (yb - yStart) / (guideLines + 1)
            for (col in 0 until 7) {
                val x0 = gridX + col * cellW + cellW * 0.06f
                val x1 = gridX + (col + 1) * cellW - cellW * 0.06f
                for (k in 1..guideLines) {
                    val y = yStart + k * spacing
                    canvas.drawLine(x0, y, x1, y, guidePaint)
                }
            }
        }

        // ----- Grid borders -----------------------------------------------------
        val gridPaint = Paint().apply {
            color = GRID_COLOR
            strokeWidth = (cellH * 0.012f).coerceAtLeast(1.2f)
            style = Paint.Style.STROKE
            isAntiAlias = true
        }
        // Outer rectangle.
        canvas.drawRect(gridX, gridY, gridX + 7 * cellW, gridY + rows * cellH, gridPaint)
        // Vertical dividers (between columns).
        for (i in 1 until 7) {
            val x = gridX + i * cellW
            canvas.drawLine(x, gridY, x, gridY + rows * cellH, gridPaint)
        }
        // Horizontal dividers (between rows).
        for (j in 1 until rows) {
            val y = gridY + j * cellH
            canvas.drawLine(gridX, y, gridX + 7 * cellW, y, gridPaint)
        }

        // ----- Day numbers + labels --------------------------------------------
        val firstOfMonth = month.atDay(1)
        val leading = mondayIndex(firstOfMonth)
        val daysInMonth = month.lengthOfMonth()
        val totalCells = leading + daysInMonth
        val trailingStart = leading + daysInMonth  // first cell index after last day

        // Pre-build paints we'll reuse.
        val dayPaint = textPaint(textSize = dayNumberH * 0.85f, bold = true)
        dayPaint.textAlign = Paint.Align.LEFT
        dayPaint.color = Color.BLACK

        // Filled chip behind today's day number — primary-blue circle with
        // white digits, the same pattern Google / Apple calendar widgets use.
        // Drawn before the digit so the text sits cleanly on top.
        val todayChipPaint = Paint().apply {
            color = TODAY_COLOR
            style = Paint.Style.FILL
            isAntiAlias = true
        }

        val labelPaint = textPaint(textSize = cellH * 0.12f, bold = true)
        labelPaint.textAlign = Paint.Align.LEFT
        labelPaint.color = Color.BLACK

        val adjacentDayPaint = textPaint(textSize = dayNumberH * 0.85f, bold = true)
        adjacentDayPaint.textAlign = Paint.Align.LEFT
        adjacentDayPaint.color = ADJACENT_COLOR

        val adjacentTagPaint = textPaint(textSize = cellH * 0.10f, italic = true)
        adjacentTagPaint.textAlign = Paint.Align.RIGHT
        adjacentTagPaint.color = ADJACENT_TAG_COLOR

        // Current-month days.
        for (day in 1..daysInMonth) {
            val offset = (day - 1) + leading
            val r = offset / 7
            val col = offset % 7
            val cellX = gridX + col * cellW
            val cellY = gridY + r * cellH

            // Day number, top-left, just inside the cell padding.
            val numX = cellX + cellW * 0.06f
            val numY = cellY + dayNumberH * 0.95f
            val date = month.atDay(day)
            val isToday = today != null && date == today
            val dayStr = day.toString()

            if (isToday) {
                // Draw the primary-blue circle behind the digit using Paint
                // metrics so the chip stays centred on the glyph regardless
                // of font size. textWidth gives horizontal centre; ascent +
                // descent average gives vertical centre.
                val textWidth = dayPaint.measureText(dayStr)
                val fm = dayPaint.fontMetrics
                val textHeight = fm.descent - fm.ascent
                val chipX = numX + textWidth / 2f
                val chipY = numY + (fm.ascent + fm.descent) / 2f
                val chipR = textHeight * 0.62f
                canvas.drawCircle(chipX, chipY, chipR, todayChipPaint)
                dayPaint.color = Color.WHITE
            } else {
                dayPaint.color = Color.BLACK
            }
            canvas.drawText(dayStr, numX, numY, dayPaint)

            // Labels stacked in the cell's "slots" — same as docs/app.js. There are
            // `guideLines + 1` natural slots between the day-number baseline and the
            // cell bottom; labels fill from the bottom up. `date` is already in scope
            // from the today-highlight block above.
            val dayLabels = labels[date].orEmpty()
            if (dayLabels.isNotEmpty()) {
                val slots = guideLines + 1
                val slotSpacing = (cellH - dayNumberH) / slots
                val labelMaxW = cellW - cellW * 0.12f

                // Slice keeps the LAST `slots` items so the holiday (always
                // last in a same-day stack) survives truncation.
                val visible = dayLabels.takeLast(slots)
                visible.forEachIndexed { i, item ->
                    // Per-label scaled font: shrink if too wide, mirroring the JS path.
                    val baseSize = cellH * 0.12f
                    labelPaint.textSize = baseSize
                    val textW = labelPaint.measureText(item.text)
                    if (textW > labelMaxW) {
                        labelPaint.textSize = baseSize * labelMaxW / textW
                    }
                    val slotIndex = slots - (visible.size - 1 - i)  // 1..slots from top
                    val slotBottom = cellY + dayNumberH + slotIndex * slotSpacing
                    val baseline = slotBottom - cellH * 0.02f
                    val truncated = item.text.take(32)
                    canvas.drawText(truncated, numX, baseline, labelPaint)
                }
            }
        }

        // Adjacent-month leading cells (prev month's last days).
        if (leading > 0) {
            val prevMonth = month.minusMonths(1)
            val prevLen = prevMonth.lengthOfMonth()
            for (cellIndex in 0 until leading) {
                val col = cellIndex % 7
                val cellX = gridX + col * cellW
                val cellY = gridY  // leading run is always row 0
                val prevDay = prevLen - leading + 1 + cellIndex
                canvas.drawText(
                    prevDay.toString(),
                    cellX + cellW * 0.06f,
                    cellY + dayNumberH * 0.95f,
                    adjacentDayPaint,
                )
                // 3-letter month tag in the top-right corner (faint italic).
                canvas.drawText(
                    shortMonthNames[prevMonth.monthValue - 1],
                    cellX + cellW - cellW * 0.06f,
                    cellY + cellH * 0.18f,
                    adjacentTagPaint,
                )
            }
        }

        // Adjacent-month trailing cells (next month's leading days).
        val lastCellIndex = trailingStart - 1
        val cellsAfterLast = rows * 7 - trailingStart
        if (cellsAfterLast > 0) {
            val nextMonth = month.plusMonths(1)
            for (i in 0 until cellsAfterLast) {
                val cellIndex = trailingStart + i
                val r = cellIndex / 7
                val col = cellIndex % 7
                val cellX = gridX + col * cellW
                val cellY = gridY + r * cellH
                val nextDay = i + 1
                canvas.drawText(
                    nextDay.toString(),
                    cellX + cellW * 0.06f,
                    cellY + dayNumberH * 0.95f,
                    adjacentDayPaint,
                )
                canvas.drawText(
                    shortMonthNames[nextMonth.monthValue - 1],
                    cellX + cellW - cellW * 0.06f,
                    cellY + cellH * 0.18f,
                    adjacentTagPaint,
                )
            }
        }

        return bmp
    }

    /** Mon = 0, Sun = 6. Matches the JS `mondayIndex`. */
    private fun mondayIndex(date: LocalDate): Int =
        (date.dayOfWeek.value + 6) % 7

    /** 5 or 6 row months, same rule as `monthRows` in docs/app.js. */
    private fun monthRows(month: YearMonth): Int {
        val first = month.atDay(1)
        return if (mondayIndex(first) + month.lengthOfMonth() <= 35) 5 else 6
    }

    private fun textPaint(textSize: Float, bold: Boolean = false, italic: Boolean = false): Paint {
        val style = when {
            bold && italic -> Typeface.BOLD_ITALIC
            bold -> Typeface.BOLD
            italic -> Typeface.ITALIC
            else -> Typeface.NORMAL
        }
        return Paint().apply {
            this.textSize = textSize
            isAntiAlias = true
            isSubpixelText = true
            typeface = Typeface.create(Typeface.DEFAULT, style)
            color = Color.BLACK
        }
    }
}
