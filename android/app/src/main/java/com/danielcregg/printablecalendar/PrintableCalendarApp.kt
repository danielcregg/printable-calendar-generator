package com.danielcregg.printablecalendar

import android.app.Application

/**
 * Application entry point.
 *
 * Currently a no-op shell; lives here so anything that needs an [Application] subclass
 * later (DI graph, WorkManager init, etc.) has somewhere to live. The Glance widget
 * does not need Application-level setup.
 */
class PrintableCalendarApp : Application()
