plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.danielcregg.printablecalendar"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.danielcregg.printablecalendar"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // Values consumed by AndroidManifest.xml for the TWA host activity.
        // Keep these in sync with the deployed PWA's manifest.json.
        manifestPlaceholders["twaHostName"] = "danielcregg.github.io"
        manifestPlaceholders["twaDefaultUrl"] =
            "https://danielcregg.github.io/printable-calendar-generator/"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // signingConfig is left out — the user generates a key and wires it up
            // (see android/README.md). Until then, only `debug` builds will install.
        }
        debug {
            // debug uses the default debug signing config.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // Core / Compose host activity (the "settings" / launcher screen).
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    debugImplementation(libs.androidx.ui.tooling)

    // TWA — wraps the deployed PWA in a Chrome Custom Tabs / Trusted Web Activity.
    implementation(libs.google.androidbrowserhelper)

    // Glance — Compose-style API for App Widgets.
    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.glance.material3)
}
