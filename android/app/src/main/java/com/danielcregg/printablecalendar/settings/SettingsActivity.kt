package com.danielcregg.printablecalendar.settings

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.isSystemInDarkTheme
import com.danielcregg.printablecalendar.widget.CalendarWidgetReceiver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * One-screen Compose activity that lets the user point the widget at a published
 * calendar by pasting a viewer URL (or just the `readId`) from the web app's
 * "Save & share" panel.
 *
 * Persists the result to `SharedPreferences("printcal_widget", MODE_PRIVATE)` under
 * the keys agreed with the parallel `WorkerWidgetDataSource` agent:
 *
 *  - `readId`           — 16-40 char base64url string
 *  - `calendarName`     — name from the last successful `GET /view/<id>` response
 *  - `lastConnectedAt`  — epoch milliseconds when that fetch succeeded
 *
 * After save/disconnect the activity broadcasts an `ACTION_APPWIDGET_UPDATE` so any
 * placed widgets re-render against the new state.
 *
 * Why plain `SharedPreferences` rather than `EncryptedSharedPreferences`? The viewer
 * readId is a public-ish secret: anyone who has the share link has it. It is not a
 * credential and encrypting it would be theatre.
 */
class SettingsActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PrintCalTheme {
                SettingsScreen()
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

private const val PREFS_NAME = "printcal_widget"
private const val KEY_READ_ID = "readId"
private const val KEY_CALENDAR_NAME = "calendarName"
private const val KEY_LAST_CONNECTED_AT = "lastConnectedAt"

private const val WORKER_BASE = "https://printcal-share.daniel-cregg.workers.dev"
private const val WEB_APP_URL = "https://danielcregg.is-a.dev/printable-calendar-generator/"

/** Strict base64url validation matching `worker/share.js`'s readId shape (16-40 chars). */
private val READ_ID_REGEX = Regex("^[A-Za-z0-9_-]{16,40}$")

private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

private data class StoredConnection(
    val readId: String?,
    val calendarName: String?,
    val lastConnectedAt: Long,
)

private fun readConnection(context: Context): StoredConnection {
    val p = prefs(context)
    return StoredConnection(
        readId = p.getString(KEY_READ_ID, null)?.takeIf { it.isNotBlank() },
        calendarName = p.getString(KEY_CALENDAR_NAME, null)?.takeIf { it.isNotBlank() },
        lastConnectedAt = p.getLong(KEY_LAST_CONNECTED_AT, 0L),
    )
}

private fun writeConnection(context: Context, readId: String, calendarName: String?) {
    prefs(context).edit().apply {
        putString(KEY_READ_ID, readId)
        if (calendarName.isNullOrBlank()) {
            remove(KEY_CALENDAR_NAME)
        } else {
            putString(KEY_CALENDAR_NAME, calendarName)
        }
        putLong(KEY_LAST_CONNECTED_AT, System.currentTimeMillis())
        apply()
    }
}

private fun clearConnection(context: Context) {
    prefs(context).edit().apply {
        remove(KEY_READ_ID)
        remove(KEY_CALENDAR_NAME)
        remove(KEY_LAST_CONNECTED_AT)
        apply()
    }
}

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/**
 * Extract a readId from anything the user might paste: a bare id, a `?view=…` viewer
 * URL, a fragment with `#cal=` (no — that is the payload form, not a readId), or the
 * id with stray whitespace. Returns null if no plausible 16-40 base64url string is
 * found.
 */
internal fun parseReadId(input: String): String? {
    val trimmed = input.trim()
    if (trimmed.isEmpty()) return null

    // Bare id form.
    if (READ_ID_REGEX.matches(trimmed)) return trimmed

    // URL form: pull the `view` query param (allowing for `&` or `#` separators and
    // tolerating an absent scheme).
    val candidate = trimmed
        .substringAfter("view=", missingDelimiterValue = "")
        .takeWhile { it != '&' && it != '#' && it != ' ' }

    if (candidate.isNotEmpty() && READ_ID_REGEX.matches(candidate)) return candidate

    // Last resort: scan for the first base64url-looking token of the right length.
    val token = Regex("[A-Za-z0-9_-]{16,40}").find(trimmed)?.value
    return token?.takeIf { READ_ID_REGEX.matches(it) }
}

// ---------------------------------------------------------------------------
// Worker verification
// ---------------------------------------------------------------------------

private sealed interface VerifyResult {
    data class Ok(val calendarName: String?) : VerifyResult
    data class NotFound(val readId: String) : VerifyResult
    data class Error(val message: String) : VerifyResult
}

/**
 * Best-effort verification against `GET /view/<readId>`. On 200 we try to lift the
 * top-level `name` field out of the JSON payload (the same `{ v, name, settings }`
 * shape the web app saves). Any I/O error or non-200 still lets us save the readId,
 * but the UI surfaces the failure so the user knows the worker did not confirm.
 */
private fun verifyReadId(readId: String): VerifyResult {
    val url = URL("$WORKER_BASE/view/$readId")
    val conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 8_000
        readTimeout = 8_000
        setRequestProperty("Accept", "application/json")
        instanceFollowRedirects = true
    }
    return try {
        val code = conn.responseCode
        when {
            code == 200 -> {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val name = runCatching { JSONObject(body).optString("name").ifBlank { null } }
                    .getOrNull()
                VerifyResult.Ok(name)
            }
            code == 404 -> VerifyResult.NotFound(readId)
            else -> VerifyResult.Error("Worker returned HTTP $code")
        }
    } catch (t: Throwable) {
        VerifyResult.Error(t.message ?: t.javaClass.simpleName)
    } finally {
        conn.disconnect()
    }
}

// ---------------------------------------------------------------------------
// Widget broadcast
// ---------------------------------------------------------------------------

/**
 * Send an `ACTION_APPWIDGET_UPDATE` broadcast to every placed [CalendarWidgetReceiver]
 * widget so it recomposes against the updated SharedPreferences. No-op if no widgets
 * are placed yet.
 */
private fun broadcastWidgetUpdate(context: Context) {
    val mgr = AppWidgetManager.getInstance(context)
    val cn = ComponentName(context, CalendarWidgetReceiver::class.java)
    val ids = mgr.getAppWidgetIds(cn) ?: return
    if (ids.isEmpty()) return
    val intent = Intent(context, CalendarWidgetReceiver::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
    }
    context.sendBroadcast(intent)
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

private val BrandPrimary = Color(0xFF1A56DB)

@Composable
private fun PrintCalTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val scheme = if (dark) {
        darkColorScheme(primary = BrandPrimary)
    } else {
        lightColorScheme(primary = BrandPrimary)
    }
    MaterialTheme(colorScheme = scheme, content = content)
}

@Composable
private fun SettingsScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var input by remember { mutableStateOf("") }
    var stored by remember { mutableStateOf(readConnection(context)) }
    var status by remember { mutableStateOf<StatusUi>(StatusUi.fromStored(stored)) }
    var busy by remember { mutableStateOf(false) }

    // If a readId was saved on a previous launch, prefill the field so the user can
    // see what is configured. Disconnect clears it.
    LaunchedEffect(stored.readId) {
        if (stored.readId != null && input.isEmpty()) {
            input = stored.readId!!
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets.systemBars,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            BrandRow()

            ConnectSection(
                input = input,
                onInputChange = { input = it },
                busy = busy,
                status = status,
                onConnect = {
                    val readId = parseReadId(input)
                    if (readId == null) {
                        status = StatusUi.Error(
                            "That doesn't look like a viewer link or readId. " +
                                "Paste the full ?view=… URL or just the id.",
                        )
                        return@ConnectSection
                    }
                    busy = true
                    status = StatusUi.Connecting
                    scope.launch {
                        val result = withContext(Dispatchers.IO) { verifyReadId(readId) }
                        when (result) {
                            is VerifyResult.Ok -> {
                                withContext(Dispatchers.IO) {
                                    writeConnection(context, readId, result.calendarName)
                                    broadcastWidgetUpdate(context)
                                }
                                stored = readConnection(context)
                                status = StatusUi.fromStored(stored)
                            }
                            is VerifyResult.NotFound -> {
                                // Don't persist — there is nothing to fetch.
                                status = StatusUi.Error(
                                    "No published calendar at that id. Double-check " +
                                        "you copied the link from Save & share.",
                                )
                            }
                            is VerifyResult.Error -> {
                                // Save anyway — offline-tolerant; the widget worker can
                                // retry. But surface what happened.
                                withContext(Dispatchers.IO) {
                                    val current = readConnection(context)
                                    prefs(context).edit().apply {
                                        putString(KEY_READ_ID, readId)
                                        // Keep an existing name if we already had one
                                        // for the same id; otherwise leave it absent.
                                        if (current.readId != readId) {
                                            remove(KEY_CALENDAR_NAME)
                                            remove(KEY_LAST_CONNECTED_AT)
                                        }
                                        apply()
                                    }
                                    broadcastWidgetUpdate(context)
                                }
                                stored = readConnection(context)
                                status = StatusUi.Error(
                                    "Saved, but couldn't reach the worker: " +
                                        result.message,
                                )
                            }
                        }
                        busy = false
                    }
                },
            )

            if (stored.readId != null) {
                HorizontalDivider()
                ResetSection(
                    onDisconnect = {
                        scope.launch {
                            withContext(Dispatchers.IO) {
                                clearConnection(context)
                                broadcastWidgetUpdate(context)
                            }
                            stored = readConnection(context)
                            input = ""
                            status = StatusUi.fromStored(stored)
                        }
                    },
                )
            }

            HorizontalDivider()
            Footer(
                onOpenWebApp = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(WEB_APP_URL))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                },
            )
        }
    }
}

@Composable
private fun BrandRow() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        BrandMark(size = 28.dp, color = BrandPrimary)
        Spacer(Modifier.width(10.dp))
        Text(
            text = "PrintCal",
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = MaterialTheme.colorScheme.onBackground,
        )
    }
}

/**
 * Reproduction of the brand mark in `docs/index.html` lines 23-28: a rounded rectangle
 * with a horizontal divider line and two short vertical "binding clips" at the top.
 * Stroked, no fill, drawn in the primary blue.
 */
@Composable
private fun BrandMark(size: androidx.compose.ui.unit.Dp, color: Color) {
    Canvas(modifier = Modifier.size(size)) {
        // The source SVG uses a 24x24 viewbox with stroke-width 2.
        val scale = this.size.minDimension / 24f
        val strokePx = 2f * scale
        // Rounded outer rectangle: x=3 y=5 width=18 height=16 rx=2
        drawRoundRect(
            color = color,
            topLeft = Offset(3f * scale, 5f * scale),
            size = androidx.compose.ui.geometry.Size(18f * scale, 16f * scale),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f * scale, 2f * scale),
            style = Stroke(width = strokePx),
        )
        // Horizontal divider: x1=3 y1=10 x2=21 y2=10
        drawLine(
            color = color,
            start = Offset(3f * scale, 10f * scale),
            end = Offset(21f * scale, 10f * scale),
            strokeWidth = strokePx,
        )
        // Left binding clip: x1=8 y1=3 x2=8 y2=7
        drawLine(
            color = color,
            start = Offset(8f * scale, 3f * scale),
            end = Offset(8f * scale, 7f * scale),
            strokeWidth = strokePx,
            cap = StrokeCap.Round,
        )
        // Right binding clip: x1=16 y1=3 x2=16 y2=7
        drawLine(
            color = color,
            start = Offset(16f * scale, 3f * scale),
            end = Offset(16f * scale, 7f * scale),
            strokeWidth = strokePx,
            cap = StrokeCap.Round,
        )
    }
}

@Composable
private fun ConnectSection(
    input: String,
    onInputChange: (String) -> Unit,
    busy: Boolean,
    status: StatusUi,
    onConnect: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Connect your calendar",
            fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            text = "Paste a viewer link (or just the readId) from the web app's " +
                "Save & share panel.",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        OutlinedTextField(
            value = input,
            onValueChange = onInputChange,
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Viewer link or readId") },
            placeholder = { Text("…?view=abc123… or just abc123…") },
            enabled = !busy,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Button(
                onClick = onConnect,
                enabled = !busy && input.isNotBlank(),
            ) {
                Text("Connect")
            }
            if (busy) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                )
            }
        }

        StatusText(status)
    }
}

@Composable
private fun ResetSection(onDisconnect: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Reset",
            fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            text = "Clear the saved readId. The widget will go back to its empty state.",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedButton(onClick = onDisconnect) {
            Text("Disconnect")
        }
    }
}

@Composable
private fun Footer(onOpenWebApp: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        TextButton(onClick = onOpenWebApp, contentPadding = PaddingValues(0.dp)) {
            Text("Open the web app")
        }
    }
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

private sealed interface StatusUi {
    data object Empty : StatusUi
    data object Connecting : StatusUi
    data class Connected(val name: String?, val lastConnectedAt: Long) : StatusUi
    data class Error(val message: String) : StatusUi

    companion object {
        fun fromStored(stored: StoredConnection): StatusUi = when {
            stored.readId == null -> Empty
            else -> Connected(stored.calendarName, stored.lastConnectedAt)
        }
    }
}

@Composable
private fun StatusText(status: StatusUi) {
    val color: Color
    val text: String
    when (status) {
        is StatusUi.Empty -> {
            color = MaterialTheme.colorScheme.onSurfaceVariant
            text = "Not configured"
        }
        is StatusUi.Connecting -> {
            color = MaterialTheme.colorScheme.onSurfaceVariant
            text = "Checking the worker…"
        }
        is StatusUi.Connected -> {
            color = MaterialTheme.colorScheme.onBackground
            val nameLabel = status.name ?: "your calendar"
            val rel = if (status.lastConnectedAt > 0) {
                relativeFromNow(status.lastConnectedAt)
            } else {
                "never"
            }
            text = "Connected to $nameLabel  •  last synced $rel"
        }
        is StatusUi.Error -> {
            color = MaterialTheme.colorScheme.error
            text = status.message
        }
    }
    Text(
        text = text,
        color = color,
        fontSize = 13.sp,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
    )
}

/**
 * Compact relative timestamp ("just now", "5m ago", "2h ago", "Tue 14:05"). Local-time
 * only — the worker call already happened on this device so no timezone juggling needed.
 */
internal fun relativeFromNow(epochMillis: Long, now: Instant = Instant.now()): String {
    if (epochMillis <= 0) return "never"
    val then = Instant.ofEpochMilli(epochMillis)
    val seconds = Duration.between(then, now).seconds
    return when {
        seconds < 0 -> "just now"
        seconds < 60 -> "just now"
        seconds < 60 * 60 -> "${seconds / 60}m ago"
        seconds < 24 * 60 * 60 -> "${seconds / 3600}h ago"
        seconds < 7 * 24 * 60 * 60 -> {
            val local = LocalDateTime.ofInstant(then, ZoneId.systemDefault())
            local.format(DateTimeFormatter.ofPattern("EEE HH:mm"))
        }
        else -> {
            val local = LocalDateTime.ofInstant(then, ZoneId.systemDefault())
            local.format(DateTimeFormatter.ofPattern("d MMM"))
        }
    }
}

// ---------------------------------------------------------------------------
// Previews
// ---------------------------------------------------------------------------

@Preview(showBackground = true, name = "Empty state")
@Composable
private fun PreviewEmpty() {
    PrintCalTheme {
        Surface(color = MaterialTheme.colorScheme.background) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                BrandRow()
                ConnectSection(
                    input = "",
                    onInputChange = {},
                    busy = false,
                    status = StatusUi.Empty,
                    onConnect = {},
                )
                Spacer(Modifier.height(0.dp))
                Footer(onOpenWebApp = {})
            }
        }
    }
}

@Preview(showBackground = true, name = "Connected")
@Composable
private fun PreviewConnected() {
    PrintCalTheme {
        Surface(color = MaterialTheme.colorScheme.background) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                BrandRow()
                ConnectSection(
                    input = "abc123-readId_example",
                    onInputChange = {},
                    busy = false,
                    status = StatusUi.Connected(
                        name = "Family calendar",
                        lastConnectedAt = System.currentTimeMillis() - 7 * 60_000,
                    ),
                    onConnect = {},
                )
                ResetSection(onDisconnect = {})
                Footer(onOpenWebApp = {})
            }
        }
    }
}

@Preview(showBackground = true, name = "Error")
@Composable
private fun PreviewError() {
    PrintCalTheme {
        Surface(color = MaterialTheme.colorScheme.background) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                BrandRow()
                ConnectSection(
                    input = "nope",
                    onInputChange = {},
                    busy = false,
                    status = StatusUi.Error(
                        "That doesn't look like a viewer link or readId.",
                    ),
                    onConnect = {},
                )
                Footer(onOpenWebApp = {})
            }
        }
    }
}
