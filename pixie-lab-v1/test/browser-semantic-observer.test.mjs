import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../browser-adapter/firefox-tab-observer/', import.meta.url);

class FakeElement {
  constructor(tagName, { text = '', attrs = {}, children = [], width = 100, height = 20 } = {}) {
    this.tagName = tagName.toUpperCase();
    this.textContent = text;
    this.innerText = text;
    this.attrs = new Map(Object.entries(attrs));
    this.children = children;
    this.parentElement = null;
    this.width = width;
    this.height = height;
    this.disabled = false;
    this.readOnly = false;
    for (const child of children) child.parentElement = this;
  }

  get id() { return this.getAttribute('id') || ''; }
  get href() { return this.getAttribute('href') || ''; }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  getBoundingClientRect() { return { width: this.width, height: this.height }; }

  matches(selector) {
    return selector.split(',').map((item) => item.trim()).some((part) => match(this, part));
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelectorAll(selector) {
    const result = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (child.matches(selector)) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function match(element, selector) {
  const tag = element.tagName.toLowerCase();
  if (selector === '*') return true;
  if (/^[a-z][a-z0-9-]*$/.test(selector)) return tag === selector;
  const tagMatch = selector.match(/^([a-z][a-z0-9-]*)?(.*)$/i);
  if (!tagMatch) return false;
  if (tagMatch[1] && tag !== tagMatch[1].toLowerCase()) return false;
  const remainder = tagMatch[2];
  const attributes = [...remainder.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)];
  if (attributes.length !== (remainder.match(/\[/g) || []).length) return false;
  for (const [, name, expected] of attributes) {
    const actual = element.getAttribute(name);
    if (actual === null || (expected !== undefined && actual !== expected)) return false;
  }
  return Boolean(tagMatch[1] || attributes.length);
}

function makePage() {
  const heading = new FakeElement('h1', { text: 'Semantic Example' });
  const paragraph = new FakeElement('p', { text: 'A useful visible paragraph.' });
  const list = new FakeElement('ol', {
    children: [new FakeElement('li', { text: 'First item' }), new FakeElement('li', { text: 'Second item' })],
  });
  const table = new FakeElement('table', {
    children: [
      new FakeElement('caption', { text: 'Summary table' }),
      new FakeElement('tr', { children: [new FakeElement('th', { text: 'Name' }), new FakeElement('th', { text: 'State' })] }),
      new FakeElement('tr', { children: [new FakeElement('td', { text: 'Alpha' }), new FakeElement('td', { text: 'Ready' })] }),
    ],
  });
  const image = new FakeElement('img', { attrs: { alt: 'A safe diagram', title: 'Context diagram' } });
  const figure = new FakeElement('figure', { children: [image, new FakeElement('figcaption', { text: 'Diagram caption' })] });
  const button = new FakeElement('button', { text: 'More details', attrs: { 'aria-expanded': 'false' } });
  const link = new FakeElement('a', { text: 'Documentation', attrs: { href: 'https://example.test/docs' } });
  const privateParagraph = new FakeElement('p', { text: 'password: do-not-capture' });
  const privateEditor = new FakeElement('div', {
    text: 'private editor contents',
    attrs: { contenteditable: 'true' },
  });
  const privateInput = new FakeElement('input', { attrs: { type: 'password', name: 'password' } });
  const form = new FakeElement('form', { children: [privateParagraph, privateEditor, privateInput] });
  const section = new FakeElement('section', {
    attrs: { 'aria-label': 'Overview' },
    children: [heading, paragraph, list, table, figure, button, link, form],
  });
  const main = new FakeElement('main', { children: [section] });
  const meta = new FakeElement('meta', { attrs: { name: 'description', content: 'A neutral test page' } });
  const html = new FakeElement('html', { attrs: { lang: 'en' }, children: [main, meta] });
  const all = () => [html, ...html.querySelectorAll('*')];
  const document = {
    documentElement: html,
    title: 'Semantic Example',
    readyState: 'complete',
    visibilityState: 'visible',
    hasFocus: () => true,
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: (selector) => all().filter((element) => element.matches(selector)),
    querySelector: (selector) => all().find((element) => element.matches(selector)) || null,
  };
  return { document, paragraph, button };
}

async function loadObserver() {
  const source = await readFile(new URL('content-observer.js', root), 'utf8');
  const page = makePage();
  const context = {
    ...page,
    Element: FakeElement,
    CSS: { escape: (value) => value },
    URL,
    location: { href: 'https://example.test/' },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    browser: { runtime: { onMessage: { addListener: () => {} }, sendMessage: async () => {} } },
    window: { addEventListener: () => {} },
    setInterval: () => {},
    setTimeout: () => {},
    __ERGASTERION_FACTORY_EYE_TEST__: true,
  };
  vm.runInNewContext(source, context, { filename: 'content-observer.js' });
  return { page, context, summary: context.__ERGASTERION_FACTORY_EYE_PAGE_SUMMARY_TEST__() };
}

test('semantic observer emits bounded neutral structure and section relationships', async () => {
  const { summary } = await loadObserver();

  assert.equal(summary.schema, 'ERGASTERION_BROWSER_PAGE_SUMMARY_V2');
  assert.equal(summary.capturesInputValues, false);
  assert.equal(summary.createsAuthority, false);
  const overview = summary.sections.find((section) => section.label === 'Overview');
  assert.ok(overview);
  assert.equal(summary.textBlocks[0].sectionId, overview.id);
  assert.deepEqual(JSON.parse(JSON.stringify(summary.lists[0])), {
    id: 'list-1', ordered: true, items: ['First item', 'Second item'], sectionId: overview.id,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(summary.tables[0].rows)), [['Name', 'State'], ['Alpha', 'Ready']]);
  assert.equal(summary.images[0].alt, 'A safe diagram');
  assert.equal(summary.images[0].caption, 'Diagram caption');
  assert.deepEqual(JSON.parse(JSON.stringify(summary.states[0].state)), { expanded: false });
  assert.ok(summary.contentGeneration.startsWith('GEN-'));
  assert.equal(summary.textBlocks.some((item) => item.text.includes('private')), false);
  assert.equal(summary.tables.some((item) => JSON.stringify(item).includes('password')), false);
});

test('semantic observer reports a minimal diff without raw DOM or private values', async () => {
  const { page, context, summary } = await loadObserver();
  page.paragraph.innerText = 'A changed visible paragraph.';
  page.paragraph.textContent = 'A changed visible paragraph.';
  page.button.attrs.set('aria-expanded', 'true');

  const current = context.__ERGASTERION_FACTORY_EYE_PAGE_SUMMARY_TEST__();
  assert.notEqual(current.contentGeneration, summary.contentGeneration);
  assert.equal(current.semanticDiff.titleChanged, false);
  assert.equal(current.semanticDiff.urlChanged, false);
  assert.equal(current.semanticDiff.stateChanged, true);
  assert.equal(current.semanticDiff.textBlocks.changed.length, 1);
});

test('semantic observer source keeps the eyes-only privacy boundary', async () => {
  const source = await readFile(new URL('content-observer.js', root), 'utf8');
  assert.doesNotMatch(source, /\.value\b/);
  assert.match(source, /contentGeneration/);
});
