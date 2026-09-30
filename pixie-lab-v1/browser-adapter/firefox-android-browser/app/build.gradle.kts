import org.gradle.api.tasks.Copy

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.ergasterionbrowser"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.ergasterionbrowser"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

val geckoviewVersion = "157.0.20260924084938"

val factoryEyeSource = projectDir.parentFile.resolve("firefox-tab-observer")
val syncFactoryEye = tasks.register<Copy>("syncFactoryEyeExtension") {
    from(factoryEyeSource)
    into(layout.projectDirectory.dir("src/main/assets/factory-eye"))
}

tasks.named("preBuild") {
    dependsOn(syncFactoryEye)
}

dependencies {
    implementation("org.mozilla.geckoview:geckoview-omni:$geckoviewVersion")
}
