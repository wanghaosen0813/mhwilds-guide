(() => {
  'use strict';
  const source = document.currentScript;
  const id = source?.dataset.measurementId;
  const host = source?.dataset.host;
  if (!/^G-[A-Z0-9]{6,}$/.test(id || '') || !host) return;
  const panel = document.getElementById('analytics-consent');
  if (!panel) return;
  const key = 'wilds-analytics-consent-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const production = location.protocol === 'https:' && [host, `www.${host}`].includes(location.hostname);
  const disabledKey = `ga-disable-${id}`;
  const denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  const allowButton = panel.querySelector('[data-analytics-allow]');
  const denyButton = panel.querySelector('[data-analytics-deny]');
  const closeButton = panel.querySelector('[data-analytics-close]');
  let memoryChoice = null;
  let storageAvailable = true;
  let requested = false;
  let expiryTimer;
  let opener;

  function readChoice() {
    let value;
    try { value = storageAvailable ? JSON.parse(localStorage.getItem(key)) : memoryChoice; }
    catch { storageAvailable = false; value = memoryChoice; }
    if (!value || !['granted', 'denied'].includes(value.choice) || !Number.isFinite(value.expiresAt)) return null;
    if (value.expiresAt <= Date.now() || value.expiresAt > Date.now() + lifetime + 60000) return null;
    return value;
  }
  function saveChoice(choice) {
    memoryChoice = { choice, expiresAt: Date.now() + lifetime };
    try { localStorage.setItem(key, JSON.stringify(memoryChoice)); storageAvailable = true; }
    catch { storageAvailable = false; }
  }
  function clearCookies() {
    for (const name of ['_ga', `_ga_${id.slice(2)}`]) {
      for (const domain of ['', `; domain=${location.hostname}`, `; domain=${host}`, `; domain=.${host}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      }
    }
  }
  function stop() {
    // Disable collection before updating consent: denied consent alone may still send pings.
    window[disabledKey] = true;
    if (requested && typeof window.gtag === 'function') window.gtag('consent', 'update', { ...denied });
    clearCookies();
  }
  function safeReferrer() {
    try { const url = new URL(document.referrer); return /^https?:$/.test(url.protocol) ? `${url.origin}/` : ''; }
    catch { return ''; }
  }
  function start() {
    if (!production || readChoice()?.choice !== 'granted') return;
    window[disabledKey] = false;
    if (requested) return;
    requested = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { ...denied });
    window.gtag('consent', 'update', { ...denied, analytics_storage: 'granted' });
    const page = {
      page_location: `${location.origin}${location.pathname}`,
      page_referrer: safeReferrer(),
      page_title: document.title
    };
    const settings = {
      ...page,
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: host,
      cookie_expires: lifetime / 1000,
      cookie_update: false,
      cookie_flags: 'SameSite=Lax;Secure'
    };
    // Apply defaults before auto-initialization; stream configuration may already exist remotely.
    window.gtag('set', settings);
    window.gtag('js', new Date());
    window.gtag('config', id, settings);
    window.gtag('event', 'page_view', { ...page, send_to: id });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    tag.referrerPolicy = 'strict-origin-when-cross-origin';
    tag.onload = () => {
      if (readChoice()?.choice !== 'granted') stop();
    };
    document.head.appendChild(tag);
  }
  function paint() {
    const choice = readChoice();
    const status = choice?.choice === 'granted' ? '当前选择：允许访问统计。' : choice ? '当前选择：仅必要，访问统计已关闭。' : '当前尚未启用访问统计。';
    document.querySelectorAll('[data-analytics-status]').forEach(el => { el.textContent = status; });
    closeButton.hidden = !choice;
    clearTimeout(expiryTimer);
    if (choice) expiryTimer = setTimeout(synchronize, Math.min(choice.expiresAt - Date.now() + 10, 86400000));
  }
  function hide() { panel.hidden = true; opener?.focus(); }
  function choose(choice) {
    if (choice === 'denied') stop();
    saveChoice(choice);
    paint();
    hide();
    if (choice === 'granted') start();
    else if (requested) location.reload();
  }
  function synchronize() {
    const choice = readChoice();
    if (choice?.choice === 'granted') start();
    else {
      stop();
      if (requested) { location.reload(); return; }
    }
    panel.hidden = Boolean(choice);
    paint();
  }
  window[disabledKey] = true;
  document.querySelectorAll('[data-analytics-settings]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      opener = button;
      paint();
      panel.hidden = false;
      denyButton.focus();
    });
  });
  allowButton.addEventListener('click', () => choose('granted'));
  denyButton.addEventListener('click', () => choose('denied'));
  closeButton.addEventListener('click', hide);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape' && readChoice()) hide(); });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { storageAvailable = true; synchronize(); } });
  window.addEventListener('pageshow', synchronize);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') synchronize(); });
  synchronize();
})();
