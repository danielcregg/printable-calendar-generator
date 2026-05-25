package com.danielcregg.printablecalendar.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.danielcregg.printablecalendar.data.StubWidgetDataSource
import com.danielcregg.printablecalendar.data.WidgetDataSource

/**
 * Entry point the [android.appwidget.AppWidgetManager] calls when the widget is added,
 * resized or refreshed. Glance handles everything else — the actual UI lives in
 * [CalendarWidget].
 *
 * ## Data source wiring
 *
 * A parallel task is adding a `WorkerWidgetDataSource` that fetches the published
 * calendar JSON from the Cloudflare Worker. While that class doesn't yet exist in this
 * worktree, the receiver tries to instantiate it reflectively and falls back to the
 * in-tree [StubWidgetDataSource] when the class is missing. Once both branches merge
 * the reflective lookup succeeds at runtime and the widget pulls real data; no change
 * to this file is needed at that point.
 *
 * Reflection cost is paid once per widget tick (i.e. when AppWidgetManager invokes
 * `onUpdate`), which is dominated by the disk/network fetch the data source itself
 * performs — so the lookup is not on a hot path.
 */
class CalendarWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = CalendarWidget { context ->
        resolveDataSource(context)
    }
}

/**
 * Resolve the most capable [WidgetDataSource] available at runtime.
 *
 * Tries to instantiate `com.danielcregg.printablecalendar.data.WorkerWidgetDataSource`
 * via reflection (the class is being built on a parallel branch and may not be on the
 * classpath of this worktree). If the class is missing — or its constructor throws —
 * the receiver falls back to [StubWidgetDataSource] so the widget always renders
 * something, even pre-merge.
 *
 * Any throwable from `newInstance` is swallowed: a broken Worker data source must not
 * take the widget offline. The fallback is silent because there is no good surface
 * to report the error to from inside a widget update.
 */
private fun resolveDataSource(context: Context): WidgetDataSource =
    try {
        val cls = Class.forName(
            "com.danielcregg.printablecalendar.data.WorkerWidgetDataSource",
        )
        val ctor = cls.getConstructor(Context::class.java)
        ctor.newInstance(context) as WidgetDataSource
    } catch (_: ClassNotFoundException) {
        // Parallel branch hasn't merged yet — stub keeps the widget rendering.
        StubWidgetDataSource()
    } catch (_: ReflectiveOperationException) {
        // Constructor changed shape, init threw, etc. — better a stubbed widget than
        // a blank one.
        StubWidgetDataSource()
    } catch (_: ClassCastException) {
        // The merged class exists but doesn't implement WidgetDataSource — bail out
        // to the stub rather than crash the widget update.
        StubWidgetDataSource()
    }
