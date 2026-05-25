package com.danielcregg.printablecalendar.data

import android.content.Context
import android.util.Log
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.YearMonth

/**
 * Real implementation of [WidgetDataSource] that fetches a published
 * calendar from the Cloudflare Worker described in `worker/share.js`.
 *
 * Workflow per call:
 *
 *  1. Read the user's `readId` from `SharedPreferences("printcal_widget")`.
 *     If empty, return today / current month / empty labels and do nothing
 *     else — the widget UI shows itself in a "tap to set up" state in that
 *     case (handled in the Glance layer, not here).
 *  2. Try `GET https://printcal-share.daniel-cregg.workers.dev/view/<readId>`.
 *     On 200, persist the raw body to `filesDir/cal.json` and parse it.
 *  3. On any non-200 (404 / 400 / network error / timeout), fall back to the
 *     cached `cal.json`. If the cache is missing too, return empty labels.
 *  4. The worker wraps the calendar payload as `{ ts, payload: { v, name,
 *     settings: { country, customDates, ... } } }`. We only need
 *     `country` and `customDates` to render the per-day labels.
 *
 * The class deliberately does the HTTP call synchronously inside
 * [labelsFor]. Glance's `provideGlance` is a `suspend` function that runs
 * off the main thread (on `Dispatchers.Default`-equivalent), so a blocking
 * `HttpURLConnection` is OK here. Doing it this way keeps the data source
 * free of coroutine deps — easier to unit-test, and aligned with the
 * "minimal dependencies" rule from `AGENTS.md`.
 */
class WorkerWidgetDataSource(
    private val context: Context,
    private val clock: () -> LocalDate = LocalDate::now,
    /** Override the base URL in tests; production calls the live Worker. */
    internal val workerBaseUrl: String = DEFAULT_WORKER_BASE_URL,
    /** Override the HTTP transport in tests so we don't hit the network. */
    internal val httpGet: (String) -> HttpResult = ::defaultWorkerHttpGet,
) : WidgetDataSource {

    override fun currentMonth(): YearMonth = YearMonth.from(clock())
    override fun today(): LocalDate = clock()

    override fun labelsFor(month: YearMonth): Map<LocalDate, List<DayLabel>> {
        val readId = readReadId()
        if (readId.isNullOrBlank()) return emptyMap()

        val body = fetchOrCachedBody(readId) ?: return emptyMap()
        val settings = extractSettings(body) ?: return emptyMap()

        val result = HashMap<LocalDate, MutableList<DayLabel>>()

        // Custom dates first — they stack above the holiday in the printable
        // calendar (see `labelStack` in app.js); the widget only shows the first
        // label per day, but we preserve that order anyway.
        val customDates = settings.customDates
        if (customDates.isNotEmpty()) {
            val expanded = RecurrenceParser.parseCustomDates(customDates, month.year)
            for ((iso, list) in expanded) {
                val date = parseIsoOrNull(iso) ?: continue
                if (YearMonth.from(date) != month) continue
                val bucket = result.getOrPut(date) { mutableListOf() }
                for (text in list) bucket.add(DayLabel(text, DayLabel.Kind.CUSTOM))
            }
        }

        // Then holidays (only for Ireland). They go at the end of the list so
        // the widget — which renders only the first label — prefers a custom
        // date when both exist, matching the printable calendar's stacking.
        if (settings.country == "IE") {
            val holidays = IrelandHolidays.forYear(month.year)
            for ((iso, label) in holidays) {
                val date = parseIsoOrNull(iso) ?: continue
                if (YearMonth.from(date) != month) continue
                result.getOrPut(date) { mutableListOf() }
                    .add(DayLabel(label, DayLabel.Kind.HOLIDAY))
            }
        }

        return result
    }

    // ------------------------------------------------------------------
    // Worker + cache
    // ------------------------------------------------------------------

    internal fun fetchOrCachedBody(readId: String): String? {
        val url = "$workerBaseUrl/view/$readId"
        val cache = cacheFile()
        val attempt = runCatching { httpGet(url) }.getOrElse {
            Log.w(TAG, "Worker GET threw ${it::class.simpleName}: ${it.message}")
            null
        }
        if (attempt == null) {
            // Network exception — try cache.
            return cache.takeIf { it.exists() }?.readText()
        }
        return when (attempt.code) {
            200 -> {
                runCatching { cache.writeText(attempt.body) }.onFailure {
                    Log.w(TAG, "Cache write failed: ${it.message}")
                }
                attempt.body
            }
            400 -> {
                Log.w(TAG, "Worker rejected readId='$readId' as invalid (400)")
                null
            }
            else -> {
                // 404 / 500 / anything else — fall back to cache silently.
                cache.takeIf { it.exists() }?.readText()
            }
        }
    }

    private fun cacheFile(): File = File(context.filesDir, "cal.json")

    private fun readReadId(): String? {
        return context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PREFS_READ_ID_KEY, null)
    }

    // ------------------------------------------------------------------
    // Minimal JSON traversal
    // ------------------------------------------------------------------

    /** The two fields we care about from `payload.settings`. */
    internal data class Settings(val country: String, val customDates: String)

    /**
     * Hand-rolled JSON walk to avoid pulling in a serialization library.
     * The worker returns a small object — `country` is a short string and
     * `customDates` is a free-text block that we want byte-for-byte intact.
     * Using `org.json.JSONObject` (in the Android framework, no extra dep)
     * is enough.
     */
    internal fun extractSettings(body: String): Settings? {
        return try {
            val root = org.json.JSONObject(body)
            val payload = root.optJSONObject("payload") ?: return null
            val settings = payload.optJSONObject("settings") ?: return null
            Settings(
                country = settings.optString("country", ""),
                customDates = settings.optString("customDates", ""),
            )
        } catch (e: org.json.JSONException) {
            Log.w(TAG, "Could not parse worker JSON: ${e.message}")
            null
        }
    }

    private fun parseIsoOrNull(iso: String): LocalDate? =
        runCatching { LocalDate.parse(iso) }.getOrNull()

    // ------------------------------------------------------------------
    // Companions and HTTP transport
    // ------------------------------------------------------------------

    /** Minimal wrapper so tests can inject canned responses for [httpGet]. */
    data class HttpResult(val code: Int, val body: String)

    companion object {
        internal const val PREFS_NAME = "printcal_widget"
        internal const val PREFS_READ_ID_KEY = "readId"
        internal const val DEFAULT_WORKER_BASE_URL = "https://printcal-share.daniel-cregg.workers.dev"
        internal const val TAG = "WorkerWidgetDS"
    }
}

private const val CONNECT_TIMEOUT_MS = 5_000
private const val READ_TIMEOUT_MS = 5_000

/**
 * Production HTTP transport for [WorkerWidgetDataSource]. Lives at file scope so the
 * primary constructor's default-arg can take a callable reference without companion-object
 * visibility shenanigans.
 */
internal fun defaultWorkerHttpGet(url: String): WorkerWidgetDataSource.HttpResult {
    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = CONNECT_TIMEOUT_MS
        readTimeout = READ_TIMEOUT_MS
        doInput = true
        useCaches = false
    }
    return try {
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.use { it.readBytes().toString(Charsets.UTF_8) }.orEmpty()
        WorkerWidgetDataSource.HttpResult(code, body)
    } finally {
        conn.disconnect()
    }
}
