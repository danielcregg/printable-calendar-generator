# Keep TWA launcher metadata intact when minification is later enabled.
-keep class com.google.androidbrowserhelper.** { *; }
-keep class androidx.browser.** { *; }

# Glance / AppWidget — receivers are looked up by name from the manifest.
-keep class com.danielcregg.printablecalendar.widget.** { *; }
