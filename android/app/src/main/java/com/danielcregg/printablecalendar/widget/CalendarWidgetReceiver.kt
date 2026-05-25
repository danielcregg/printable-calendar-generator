package com.danielcregg.printablecalendar.widget

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

/**
 * Entry point the [android.appwidget.AppWidgetManager] calls when the widget is added,
 * resized or refreshed. Glance handles everything else — the actual UI lives in
 * [CalendarWidget].
 */
class CalendarWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = CalendarWidget()
}
