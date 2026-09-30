package com.example.ergasterionbrowser

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoView

class MainActivity : Activity() {
    companion object {
        private const val HOME_URL = "https://www.mozilla.org"
        private var runtime: GeckoRuntime? = null
    }

    private data class BrowserTab(
        val session: GeckoSession,
        var currentUrl: String
    )

    private lateinit var geckoView: GeckoView
    private lateinit var tabBar: LinearLayout
    private lateinit var urlInput: EditText
    private val tabs = mutableListOf<BrowserTab>()
    private var activeTabIndex = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        geckoView = findViewById(R.id.geckoview)
        tabBar = findViewById(R.id.tabBar)
        urlInput = findViewById(R.id.urlInput)

        if (runtime == null) {
            runtime = GeckoRuntime.create(this)
        }

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
        // Required workaround for some GeckoView versions.
        session.contentDelegate = object : GeckoSession.ContentDelegate {}
        session.open(runtime!!)

        tabs += BrowserTab(session, url)
        activeTabIndex = tabs.lastIndex
        refreshTabBar()
        attachActiveSession()
        session.loadUri(url)
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
            input.contains(" ") -> "https://www.google.com/search?q=${input.replace(" ", "+")}"
            else -> "https://$input"
        }
        tabs.getOrNull(activeTabIndex)?.currentUrl = target
        currentSession()?.loadUri(target)
    }

    private fun refreshTabBar() {
        tabBar.removeAllViews()

        tabs.forEachIndexed { index, _ ->
            val tabButton = Button(this).apply {
                text = if (index == activeTabIndex) "● แท็บ ${index + 1}  ×" else "แท็บ ${index + 1}  ×"
                isAllCaps = false
                minWidth = 0
                setPadding(16, 0, 16, 0)
                setOnClickListener {
                    if (index == activeTabIndex) closeTab(index) else selectTab(index)
                }
            }
            tabBar.addView(tabButton)
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
