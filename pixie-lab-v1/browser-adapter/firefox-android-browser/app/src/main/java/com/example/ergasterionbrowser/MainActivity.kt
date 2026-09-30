package com.example.ergasterionbrowser

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoView

class MainActivity : Activity() {
    companion object {
        private const val HOME_URL = "https://www.mozilla.org"
        private val WATCH_URLS = listOf(
            "https://github.com/pureekangraw-ops/Ergasterion-factory",
            "https://dash.cloudflare.com/",
        )
        private var runtime: GeckoRuntime? = null
    }

    private data class BrowserTab(
        val session: GeckoSession,
        var currentUrl: String,
    )

    private lateinit var geckoView: GeckoView
    private lateinit var tabBar: LinearLayout
    private lateinit var urlInput: EditText
    private lateinit var observerStatus: TextView
    private val tabs = mutableListOf<BrowserTab>()
    private var activeTabIndex = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        geckoView = findViewById(R.id.geckoview)
        tabBar = findViewById(R.id.tabBar)
        urlInput = findViewById(R.id.urlInput)
        observerStatus = findViewById(R.id.observerStatus)

        if (runtime == null) {
            runtime = GeckoRuntime.create(this)
        }

        FactoryEyeHost(runtime!!) { installed, error ->
            runOnUiThread {
                observerStatus.text = if (installed) {
                    "Factory Eye: installed · watch ready"
                } else {
                    "Factory Eye: unavailable · ${error?.message ?: "UNKNOWN"}"
                }
            }
        }.install()

        findViewById<Button>(R.id.goButton).setOnClickListener { navigate() }
        findViewById<Button>(R.id.backButton).setOnClickListener {
            currentSession()?.goBack()
        }
        findViewById<Button>(R.id.forwardButton).setOnClickListener {
            currentSession()?.goForward()
        }
        findViewById<Button>(R.id.reloadButton).setOnClickListener {
            currentSession()?.reload()
        }
        findViewById<Button>(R.id.watchButton).setOnClickListener {
            openDedicatedWatchMode()
        }
        urlInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
                navigate()
                true
            } else {
                false
            }
        }

        createTab(HOME_URL)
    }

    private fun createTab(url: String) {
        val session = GeckoSession()
        session.contentDelegate = object : GeckoSession.ContentDelegate {}
        session.navigationDelegate = object : GeckoSession.NavigationDelegate {
            override fun onLocationChange(
                session: GeckoSession,
                url: String?,
                permissions: List<GeckoSession.PermissionDelegate.ContentPermission>,
                hasUserGesture: Boolean,
            ) {
                val tab = tabs.firstOrNull { it.session === session } ?: return
                if (!url.isNullOrBlank()) tab.currentUrl = url
                if (currentSession() === session) {
                    urlInput.setText(tab.currentUrl)
                }
            }
        }
        session.open(runtime!!)

        tabs += BrowserTab(session, url)
        activeTabIndex = tabs.lastIndex
        refreshTabBar()
        attachActiveSession()
        session.loadUri(url)
    }

    private fun openDedicatedWatchMode() {
        val existing = tabs.map { it.currentUrl }.toSet()
        WATCH_URLS.filterNot(existing::contains).forEach { createTab(it) }
        observerStatus.text = "Factory Eye: dedicated watch mode · ${WATCH_URLS.size} targets"
    }

    private fun closeTab(index: Int) {
        if (tabs.size == 1) {
            finish()
            return
        }
        tabs[index].session.close()
        tabs.removeAt(index)
        activeTabIndex = activeTabIndex.coerceAtMost(tabs.lastIndex)
        refreshTabBar()
        attachActiveSession()
    }

    private fun selectTab(index: Int) {
        if (index !in tabs.indices) return
        activeTabIndex = index
        refreshTabBar()
        attachActiveSession()
    }

    private fun attachActiveSession() {
        val tab = tabs.getOrNull(activeTabIndex) ?: return
        geckoView.setSession(tab.session)
        urlInput.setText(tab.currentUrl)
    }

    private fun currentSession(): GeckoSession? = tabs.getOrNull(activeTabIndex)?.session

    private fun navigate() {
        val input = urlInput.text.toString().trim()
        if (input.isEmpty()) return

        val target = when {
            input.startsWith("http://") || input.startsWith("https://") -> input
            input.contains(" ") -> "https://www.google.com/search?q=${java.net.URLEncoder.encode(input, "UTF-8")}"
            else -> "https://$input"
        }
        tabs.getOrNull(activeTabIndex)?.currentUrl = target
        currentSession()?.loadUri(target)
    }

    private fun refreshTabBar() {
        tabBar.removeAllViews()

        tabs.forEachIndexed { index, _ ->
            val tabContainer = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            val tabButton = Button(this).apply {
                text = if (index == activeTabIndex) "● แท็บ ${index + 1}" else "แท็บ ${index + 1}"
                isAllCaps = false
                minWidth = 0
                setPadding(16, 0, 16, 0)
                setOnClickListener { selectTab(index) }
            }
            val closeButton = Button(this).apply {
                text = "×"
                isAllCaps = false
                minWidth = 0
                setPadding(8, 0, 8, 0)
                setOnClickListener { closeTab(index) }
            }
            tabContainer.addView(tabButton)
            tabContainer.addView(closeButton)
            tabBar.addView(tabContainer)
        }

        val addButton = Button(this).apply {
            text = "+"
            isAllCaps = false
            minWidth = 0
            gravity = Gravity.CENTER
            setOnClickListener { createTab(HOME_URL) }
        }
        tabBar.addView(addButton)
    }

    override fun onDestroy() {
        tabs.forEach { it.session.close() }
        tabs.clear()
        super.onDestroy()
    }
}
