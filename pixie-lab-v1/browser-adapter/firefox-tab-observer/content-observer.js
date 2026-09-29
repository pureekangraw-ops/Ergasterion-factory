(() => {
  const clean = (value, max = 240) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  function visible(element) {
    if (!element || !(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function labelFor(element) {
    const aria = clean(element.getAttribute('aria-label'));
    if (aria) return aria;
    const labelledBy = clean(element.getAttribute('aria-labelledby'));
    if (labelledBy) {
      const value = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '')
        .map((value) => clean(value))
        .filter(Boolean)
        .join(' ');
      if (value) return clean(value);
    }
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) return clean(label.textContent);
    }
    const wrapping = element.closest('label');
    if (wrapping) return clean(wrapping.textContent);
    return clean(element.getAttribute('placeholder') || element.getAttribute('name') || '');
  }

  function safeHref(anchor) {
    const raw = anchor?.href || '';
    try {
      const url = new URL(raw, location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return url.href.slice(0, 800);
    } catch {
      return null;
    }
  }

  function collectHeadings(limit = 24) {
    return [...document.querySelectorAll('h1,h2,h3')]
      .filter(visible)
      .map((element) => ({
        level: Number(element.tagName.slice(1)),
        text: clean(element.innerText || element.textContent, 320),
      }))
      .filter((item) => item.text)
      .slice(0, limit);
  }

  function collectButtons(limit = 30) {
    return [...document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')]
      .filter(visible)
      .map((element) => ({
        label: clean(element.innerText || element.textContent || labelFor(element), 220),
        disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
      }))
      .filter((item) => item.label)
      .slice(0, limit);
  }

  function collectLinks(limit = 40) {
    return [...document.querySelectorAll('a[href]')]
      .filter(visible)
      .map((anchor) => ({
        label: clean(anchor.innerText || anchor.textContent, 220),
        href: safeHref(anchor),
      }))
      .filter((item) => item.label || item.href)
      .slice(0, limit);
  }

  function collectFields(limit = 40) {
    return [...document.querySelectorAll('input,textarea,select,[contenteditable="true"]')]
      .filter(visible)
      .map((element) => {
        const tag = element.tagName.toLowerCase();
        const type = tag === 'input' ? clean(element.getAttribute('type') || 'text', 60).toLowerCase() : tag;
        const sensitive = ['password'].includes(type) ||
          /password|passcode|otp|one[- ]?time|verification code|cvv|cvc|card number/i.test(
            [labelFor(element), element.getAttribute('name'), element.getAttribute('autocomplete')].filter(Boolean).join(' ')
          );
        return {
          tag,
          type,
          name: clean(element.getAttribute('name'), 140) || null,
          label: clean(labelFor(element), 220) || null,
          placeholder: sensitive ? null : clean(element.getAttribute('placeholder'), 220) || null,
          disabled: Boolean(element.disabled),
          readOnly: Boolean(element.readOnly),
          sensitive,
        };
      })
      .slice(0, limit);
  }

  function collectLandmarks(limit = 20) {
    return [...document.querySelectorAll('main,nav,header,footer,aside,[role="main"],[role="navigation"],[role="dialog"]')]
      .filter(visible)
      .map((element) => ({
        role: clean(element.getAttribute('role') || element.tagName.toLowerCase(), 80),
        label: clean(element.getAttribute('aria-label') || element.getAttribute('title') || '', 220) || null,
      }))
      .slice(0, limit);
  }

  function pageSummary() {
    const description = document.querySelector('meta[name="description"]')?.content || '';
    return {
      schema: 'ERGASTERION_BROWSER_PAGE_SUMMARY_V1',
      url: location.href,
      title: document.title || '',
      readyState: document.readyState,
      language: document.documentElement.lang || null,
      description: clean(description, 500) || null,
      headings: collectHeadings(),
      buttons: collectButtons(),
      links: collectLinks(),
      fields: collectFields(),
      landmarks: collectLandmarks(),
      capturedAt: new Date().toISOString(),
      capturesInputValues: false,
      createsAuthority: false,
    };
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'ERGASTERION_OBSERVE_PAGE') return undefined;
    try {
      return Promise.resolve({ ok: true, page: pageSummary() });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: error?.message || 'PAGE_SUMMARY_FAILED',
      });
    }
  });

  const CONTENT_PULSE_MS = 8000;
  let pulseBusy = false;
  let lastPulseAt = 0;

  async function sendVisiblePulse(reason, { force = false } = {}) {
    if (pulseBusy || document.visibilityState !== 'visible') return;
    if (!['http:', 'https:'].includes(location.protocol)) return;

    const now = Date.now();
    if (!force && now - lastPulseAt < 2500) return;

    pulseBusy = true;
    lastPulseAt = now;
    try {
      await browser.runtime.sendMessage({
        type: 'ERGASTERION_FACTORY_EYE_CONTENT_PULSE',
        reason,
        visible: true,
        page: pageSummary(),
      });
    } catch {
      // Background/event-page availability is best-effort; the next pulse retries.
    } finally {
      pulseBusy = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void sendVisiblePulse('visibilitychange', { force: true });
    }
  });

  window.addEventListener('pageshow', () => {
    void sendVisiblePulse('pageshow', { force: true });
  });

  window.addEventListener('focus', () => {
    void sendVisiblePulse('focus');
  });

  setInterval(() => {
    void sendVisiblePulse('foreground-keepalive');
  }, CONTENT_PULSE_MS);

  setTimeout(() => {
    void sendVisiblePulse('content-ready', { force: true });
  }, 250);
})();
