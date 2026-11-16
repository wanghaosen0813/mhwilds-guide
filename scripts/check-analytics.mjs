import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { analyticsMarkup } from '../src/analytics.mjs';

const code = await fs.readFile(new URL('../public/assets/analytics.js', import.meta.url), 'utf8');
const id = 'G-RMXH273MTW', key = 'wilds-analytics-consent-v1', lifetime = 180 * 86400000;
const element = () => ({ hidden: true, textContent: '', listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, focus() {} });
function browser({ choice, url = 'https://mhwilds.net/search/?q=private-search&utm_source=private-campaign&gclid=private-click#private-fragment', blocked = false } = {}) {
  let now = Date.now(), timerId = 0, reloads = 0;
  class Clock extends Date { static now() { return now; } }
  const stored = new Map(choice ? [[key, typeof choice === 'string' ? choice : JSON.stringify(choice)]] : []);
  const allow = element(), deny = element(), close = element(), settings = element(), status = element(), panel = element();
  panel.querySelector = selector => ({ '[data-analytics-allow]': allow, '[data-analytics-deny]': deny, '[data-analytics-close]': close })[selector];
  const scripts = [], cookies = [], timers = new Map();
  const document = {
    ...element(), title: '搜索资料 · 荒野手记', visibilityState: 'visible',
    currentScript: { dataset: { measurementId: id, host: 'mhwilds.net' } },
    referrer: 'https://www.google.com/search?q=private-referrer#secret',
    getElementById: name => name === 'analytics-consent' ? panel : null,
    querySelectorAll: selector => selector === '[data-analytics-settings]' ? [settings] : [status],
    createElement: () => ({}), head: { appendChild: script => scripts.push(script) },
    set cookie(value) { cookies.push(value); }
  };
  const window = element(), location = new URL(url);
  location.reload = () => { reloads++; };
  const context = {
    window, document, location, URL, Date: Clock,
    localStorage: {
      getItem(name) { if (blocked) throw Error('Storage blocked'); return stored.get(name) || null; },
      setItem(name, value) { if (blocked) throw Error('Storage blocked'); stored.set(name, value); }
    },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: value => timers.delete(value)
  };
  vm.runInNewContext(code, context);
  return { ...context, stored, scripts, cookies, panel, status, settings, timers,
    allow: () => allow.listeners.click(), deny: () => deny.listeners.click(), open: () => settings.listeners.click(),
    loaded: () => scripts[0]?.onload(), commands: () => (window.dataLayer || []).map(args => Array.from(args)),
    advance: value => { now += value; }, reloads: () => reloads,
    storage: value => { if (value === null) stored.delete(key); else stored.set(key, JSON.stringify(value)); window.listeners.storage({ key }); }
  };
}
let tests = 0;
function test(name, fn) { fn(); tests++; console.log(`PASS ${name}`); }
const granted = () => ({ choice: 'granted', expiresAt: Date.now() + lifetime });
test('No Google tag or queue before a choice; refusal remains inactive', () => {
  const b = browser(); assert.equal(b.scripts.length, 0); assert.equal(b.window.dataLayer, undefined);
  assert.equal(b.window[`ga-disable-${id}`], true); assert.equal(b.panel.hidden, false); assert.equal(b.settings.hidden, false);
  b.deny(); assert.equal(b.scripts.length, 0); assert.equal(b.panel.hidden, true); assert.equal(JSON.parse(b.stored.get(key)).choice, 'denied');
  b.open(); assert.equal(b.panel.hidden, false);
});
test('Allow loads once and configures one sanitized page view with ads denied', () => {
  const b = browser(); b.allow(); b.allow(); assert.equal(b.scripts.length, 1); b.loaded(); b.loaded();
  const commands = b.commands(), configs = commands.filter(([name]) => name === 'config');
  assert.equal(configs.length, 1); assert.equal(configs[0][1], id);
  const options = configs[0][2]; assert.equal(options.send_page_view, true);
  assert.equal(options.page_location, 'https://mhwilds.net/search/'); assert.equal(options.page_referrer, 'https://www.google.com/');
  assert.equal(options.cookie_expires, lifetime / 1000); assert.equal(options.cookie_update, false);
  assert.equal(options.allow_google_signals, false); assert.equal(options.allow_ad_personalization_signals, false);
  assert.equal(JSON.stringify(commands).includes('private-'), false);
  assert.equal(commands[0][1], 'default'); assert.equal(commands[0][2].analytics_storage, 'denied');
  assert.equal(commands[1][2].analytics_storage, 'granted');
  for (const flag of ['ad_storage', 'ad_user_data', 'ad_personalization']) assert.equal(commands[1][2][flag], 'denied');
});
test('Stored grant starts; denied, expired, corrupt and future records stay off', () => {
  assert.equal(browser({ choice: granted() }).scripts.length, 1);
  for (const choice of [{ choice: 'denied', expiresAt: Date.now() + lifetime }, { choice: 'granted', expiresAt: 1 }, '{broken', { choice: 'granted', expiresAt: Date.now() + lifetime * 2 }]) assert.equal(browser({ choice }).scripts.length, 0);
});
test('Withdrawal disables immediately, removes only GA cookies and reloads', () => {
  const b = browser({ choice: granted() }); b.loaded(); b.deny();
  assert.equal(b.window[`ga-disable-${id}`], true); assert.equal(b.reloads(), 1);
  assert.ok(b.cookies.some(cookie => cookie.startsWith('_ga_RMXH273MTW=;')));
  assert.ok(b.cookies.every(cookie => /^_ga(?:_RMXH273MTW)?=; Max-Age=0; path=\//.test(cookie)));
  assert.equal(b.commands().at(-1)[2].analytics_storage, 'denied');
});
test('A pending tag download cannot configure after withdrawal', () => {
  const b = browser(); b.allow(); b.deny(); b.loaded(); assert.equal(b.commands().filter(([name]) => name === 'config').length, 0);
});
test('Another tab rejecting or clearing storage revokes active collection', () => {
  for (const value of [null, { choice: 'denied', expiresAt: Date.now() + lifetime }]) {
    const b = browser({ choice: granted() }); b.loaded(); b.storage(value);
    assert.equal(b.window[`ga-disable-${id}`], true); assert.equal(b.reloads(), 1);
  }
});
test('Expiration is handled by timer, bfcache restore and foreground return', () => {
  for (const event of ['timer', 'pageshow', 'visibilitychange']) {
    const b = browser({ choice: granted() }); b.loaded(); b.advance(lifetime + 100);
    if (event === 'timer') [...b.timers.values()][0].fn(); else if (event === 'pageshow') b.window.listeners.pageshow(); else b.document.listeners.visibilitychange();
    assert.equal(b.window[`ga-disable-${id}`], true); assert.equal(b.reloads(), 1);
  }
});
test('Local previews, other domains and HTTP cannot send', () => {
  for (const url of ['http://127.0.0.1:4176/', 'https://example.com/', 'http://mhwilds.net/']) {
    const b = browser({ url }); b.allow(); assert.equal(b.scripts.length, 0); assert.equal(b.window[`ga-disable-${id}`], true);
  }
});
test('Blocked storage still requires an explicit choice and supports withdrawal', () => {
  const b = browser({ blocked: true }); assert.equal(b.scripts.length, 0); b.allow(); b.loaded();
  assert.equal(b.commands().filter(([name]) => name === 'config').length, 1); b.deny(); assert.equal(b.window[`ga-disable-${id}`], true);
});
test('Build rejects invalid IDs and omits all disabled analytics UI/code', () => {
  assert.throws(() => analyticsMarkup({ url: 'https://mhwilds.net', analytics: { enabled: true, measurementId: 'placeholder' } }));
  assert.deepEqual(analyticsMarkup({ analytics: { enabled: false } }), { head: '', footer: '', panel: '', privacy: '' });
});
console.log(`${tests} analytics checks passed.`);
