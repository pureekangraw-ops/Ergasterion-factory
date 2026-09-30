package com.example.ergasterionbrowser

import org.mozilla.geckoview.GeckoRuntime

class FactoryEyeHost(
    private val runtime: GeckoRuntime,
    private val onResult: (installed: Boolean, error: Throwable?) -> Unit,
) {
    companion object {
        const val EXTENSION_ID = "ergasterion-factory-eye@pureekangraw.local"
        private const val ASSET_URI = "resource://android/assets/factory-eye/"
    }

    fun install() {
        runtime.webExtensionController
            .ensureBuiltIn(ASSET_URI, EXTENSION_ID)
            .accept(
                { extension -> onResult(extension != null, null) },
                { error -> onResult(false, error) },
            )
    }
}
