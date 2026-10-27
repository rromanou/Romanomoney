/* Romanomoney - liaison entre l'extension et le site Communicer (sync.js)
 *
 * Ce fichier tourne dans trois contextes :
 *   1. le jeu chargé dans Communicer (iframe) : stockage en mémoire fourni par le site, sauvegardé dans son Supabase ;
 *   2. la fenêtre de l'extension (popup) : option « Charger automatiquement » et bouton « Actualiser » ;
 *   3. un script de contenu injecté sur https://rromanou.github.io/Communicer/ : échange la progression avec la page.
 * L'extension seule (hors du site) ne contacte jamais Supabase ni aucun autre serveur.
 */
(() => {
  'use strict';

  const SITE_URL = 'https://rromanou.github.io/Communicer/';
  const SAVE_KEY = 'makeMoneySave';
  const META_KEY = 'romanomoneyMeta';
  const AUTO_KEY = 'rmnSyncAuto';
  const SECRET = 'rmn-v1|Romanomoney|k7Qz#92';
  const hasChrome = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local;

  /* ---------- Chiffrement : identique à celui de popup.js ---------- */
  function hash32(str, seed) {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function prng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
  }
  const toB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
  const fromB64 = (str) => { const bin = atob(str); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  const put32 = (arr, off, v) => { arr[off] = v >>> 24; arr[off + 1] = (v >>> 16) & 255; arr[off + 2] = (v >>> 8) & 255; arr[off + 3] = v & 255; };
  const get32 = (arr, off) => ((arr[off] << 24) | (arr[off + 1] << 16) | (arr[off + 2] << 8) | arr[off + 3]) >>> 0;

  function encode(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    const nonce = new Uint8Array(8);
    crypto.getRandomValues(nonce);
    const rnd = prng(hash32(SECRET + Array.from(nonce).join(','), 7));
    const out = new Uint8Array(16 + bytes.length);
    out.set(nonce, 0);
    put32(out, 8, hash32(SECRET + json, 11));
    put32(out, 12, hash32(json + SECRET, 13));
    for (let i = 0; i < bytes.length; i++) {
      const k = rnd();
      out[16 + i] = ((bytes[i] + (k & 255)) & 255) ^ ((k >>> 8) & 255);
    }
    return 'RMN1.' + toB64(out);
  }
  function decode(text) {
    const t = String(text || '').replace(/\s+/g, '');
    if (t.indexOf('RMN1.') !== 0) throw new Error('format');
    let raw;
    try { raw = fromB64(t.slice(5)); } catch (e) { throw new Error('format'); }
    if (raw.length < 17) throw new Error('format');
    const nonce = raw.slice(0, 8);
    const rnd = prng(hash32(SECRET + Array.from(nonce).join(','), 7));
    const bytes = new Uint8Array(raw.length - 16);
    for (let i = 0; i < bytes.length; i++) {
      const k = rnd();
      bytes[i] = (((raw[16 + i] ^ ((k >>> 8) & 255)) - (k & 255)) & 255);
    }
    const json = new TextDecoder().decode(bytes);
    if (get32(raw, 8) !== hash32(SECRET + json, 11) || get32(raw, 12) !== hash32(json + SECRET, 13)) throw new Error('altered');
    return JSON.parse(json);
  }

  /* ---------- Comparaison de deux progressions ----------
   * Ordre de priorité : rebirths, prestiges, améliorations, argent. La plus avancée l'emporte. */
  function bigParts(v) {
    const s = String(v === undefined || v === null ? '0' : v);
    if (s === '0' || s === '') return [0, 0];
    const k = s.toLowerCase().replace(',', '.').split('e');
    const m = parseFloat(k[0]);
    if (!(m > 0)) return [0, 0];
    return [parseInt(k[1] || '0', 10) || 0, m];
  }
  function cmpBig(a, b) {
    const x = bigParts(a), y = bigParts(b);
    if (x[1] === 0 && y[1] === 0) return 0;
    if (x[1] === 0) return -1;
    if (y[1] === 0) return 1;
    if (x[0] !== y[0]) return x[0] > y[0] ? 1 : -1;
    return x[1] === y[1] ? 0 : (x[1] > y[1] ? 1 : -1);
  }
  const sumMap = (o) => Object.keys(o || {}).reduce((n, k) => n + (Number(o[k]) || 0), 0);
  const nKeys = (o) => Object.keys(o || {}).filter((k) => o[k]).length;
  function upgradeCount(s) { return sumMap(s.clicks) + sumMap(s.gens) + sumMap(s.rb) + nKeys(s.ups) + nKeys(s.tech); }
  function compare(a, b) { // >0 : a plus avancée ; <0 : b plus avancée ; 0 : égales
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    const f = [
      (Number(a.rebirths) || 0) - (Number(b.rebirths) || 0),
      (Number(a.resets) || 0) - (Number(b.resets) || 0),
      upgradeCount(a) - upgradeCount(b),
      cmpBig(a.money, b.money)
    ];
    for (let i = 0; i < f.length; i++) if (f[i] !== 0) return f[i] > 0 ? 1 : -1;
    return 0;
  }
  function packedFromCode(code) {
    const d = decode(code);
    if (!d || d.g !== 'romanomoney' || !d.s || typeof d.s !== 'object') throw new Error('format');
    return d.s;
  }
  const codeFromPacked = (p, dev) => encode({ g: 'romanomoney', ver: (window.__rmn && window.__rmn.ver) || '', dev: dev || '', t: Date.now(), s: p });

  window.RMNSYNC = { encode, decode, compare, packedFromCode, codeFromPacked };

  const store = {
    get(key) { return new Promise((res) => chrome.storage.local.get(key, (o) => res((o && o[key]) || null))); },
    set(key, v) { return new Promise((res) => chrome.storage.local.set({ [key]: v }, res)); }
  };

  /* =====================================================================
   * 1. Jeu chargé dans Communicer (iframe) : le site fournit la sauvegarde dans l'adresse (fragment, jamais envoyé à un serveur)
   * ===================================================================== */
  const inFrame = /[?&]cm=1(&|$)/.test(location.search) && window.parent !== window;
  if (inFrame) {
    const mem = {};
    try {
      const code = decodeURIComponent((location.hash || '').replace(/^#rmn=/, ''));
      if (code) mem[SAVE_KEY] = JSON.stringify(packedFromCode(code));
    } catch (e) { /* sauvegarde du site absente ou illisible : nouvelle partie */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    // Le stockage local de ce domaine est partagé entre tous les comptes : on ne l'utilise pas pour ces deux clés.
    const proto = Storage.prototype, g = proto.getItem, s = proto.setItem, r = proto.removeItem;
    proto.getItem = function (k) { return (k === SAVE_KEY || k === META_KEY) ? (k in mem ? mem[k] : null) : g.call(this, k); };
    proto.setItem = function (k, v) { if (k === SAVE_KEY || k === META_KEY) { mem[k] = String(v); if (k === SAVE_KEY) queue(); } else s.call(this, k, v); };
    proto.removeItem = function (k) { if (k === SAVE_KEY || k === META_KEY) delete mem[k]; else r.call(this, k); };

    let timer = null, lastSent = '', lastAt = 0;
    const flush = (force) => {
      timer = null;
      const raw = mem[SAVE_KEY];
      if (!raw) return;
      try {
        const p = JSON.parse(raw);
        const code = codeFromPacked(p, '');
        const sig = String(p.rebirths) + '|' + String(p.resets) + '|' + upgradeCount(p) + '|' + p.money;
        if (!force && sig === lastSent && Date.now() - lastAt < 60000) return;
        lastSent = sig; lastAt = Date.now();
        window.parent.postMessage({ rmn: 'save', code }, '*');
      } catch (e) { /* ignore */ }
    };
    function queue() { if (!timer) timer = setTimeout(() => flush(false), 4000); }
    window.addEventListener('pagehide', () => flush(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
    window.addEventListener('message', (e) => {
      if (e.source !== window.parent || !e.data) return;
      if (e.data.rmn === 'load' && window.__rmn) { try { window.__rmn.importCode(e.data.code); flush(true); } catch (x) { /* ignore */ } }
      if (e.data.rmn === 'flush') flush(true);
    });
    const markSite = () => { if (window.__rmn && window.__rmn.setSite) window.__rmn.setSite(true); };
    window.addEventListener('load', () => { markSite(); setTimeout(markSite, 400); setTimeout(markSite, 1500); });
    const st = document.createElement('style'); st.textContent = 'body{margin:0 auto}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
    window.parent.postMessage({ rmn: 'ready' }, '*');
    return;
  }

  if (!hasChrome) return; // page web ordinaire : rien à faire, aucun réseau

  /* =====================================================================
   * 2. Fenêtre de l'extension : option automatique + bouton Actualiser
   * ===================================================================== */
  const isPopup = !!document.getElementById('exp-file');
  if (isPopup) {
    const $ = (s) => document.querySelector(s);
    const boot = () => {
      const auto = $('#sync-auto'), now = $('#sync-now'), msg = $('#sync-msg');
      if (!auto || !now) return;
      const say = (cls, t) => { msg.className = 'datamsg ' + cls; msg.textContent = t; };
      store.get(AUTO_KEY).then((v) => { auto.checked = !!v; });
      auto.addEventListener('change', () => {
        store.set(AUTO_KEY, auto.checked);
        say('good', auto.checked ? 'La progression sera comparée à chaque visite du site.' : 'Chargement automatique désactivé.');
      });
      let tabId = null;
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const t = tabs && tabs[0], url = (t && t.url) || '';
          if (t && url.indexOf(SITE_URL) === 0) { tabId = t.id; now.disabled = false; } else now.disabled = true;
        });
      } catch (e) { now.disabled = true; }
      now.addEventListener('click', () => {
        if (tabId === null || !window.__rmn) return;
        let code;
        try { code = window.__rmn.exportCode(); } catch (e) { return say('bad', 'Export impossible.'); }
        now.disabled = true;
        chrome.tabs.sendMessage(tabId, { rmn: 'push', code }, (resp) => {
          const err = chrome.runtime.lastError;
          now.disabled = false;
          if (err || !resp || !resp.ok) return say('bad', 'Le site n\'a pas répondu. Recharge la page du site et connecte-toi.');
          say('good', 'Progression transmise au site.');
        });
      });
      // Une progression écrite par le script de contenu pendant que la fenêtre est ouverte
      let lastBridge = 0;
      store.get(SAVE_KEY).then((v) => { lastBridge = (v && v._bridge) || 0; });
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local' || !ch[SAVE_KEY] || !ch[SAVE_KEY].newValue) return;
        const nv = ch[SAVE_KEY].newValue;
        if (nv && nv._bridge && nv._bridge !== lastBridge && window.__rmn) {
          lastBridge = nv._bridge;
          try { window.__rmn.applyPacked(nv); say('good', 'Progression du site importée.'); } catch (e) { /* ignore */ }
        }
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    return;
  }

  /* =====================================================================
   * 3. Script de contenu sur le site Communicer
   * ===================================================================== */
  if (location.href.indexOf(SITE_URL) !== 0) return;
  let siteCode = null, siteLogged = false, decided = false, tries = 0, pollTimer = null;

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.rmn === 'site-info') {
      siteLogged = !!e.data.logged; siteCode = e.data.code || null;
      if (siteLogged) { clearInterval(pollTimer); decide(); }
    }
    if (e.data.rmn === 'site-ready') hello();
  });

  function hello() { window.postMessage({ rmn: 'ext-hello' }, location.origin); }

  async function decide() {
    if (decided) return;
    const auto = await store.get(AUTO_KEY);
    if (!auto) return;
    decided = true;
    const ext = await store.get(SAVE_KEY);
    let site = null;
    try { site = siteCode ? packedFromCode(siteCode) : null; } catch (e) { site = null; }
    const c = compare(ext, site);
    if (c > 0 && ext) {
      const meta = await store.get(META_KEY);
      window.postMessage({ rmn: 'ext-push', code: codeFromPacked(ext, (meta && meta.id) || '') }, location.origin);
    } else if (c < 0 && site) {
      site._bridge = Date.now();
      await store.set(SAVE_KEY, site);
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (msg && msg.rmn === 'push' && msg.code) {
      try { packedFromCode(msg.code); } catch (e) { send({ ok: false }); return; }
      window.postMessage({ rmn: 'ext-push', code: msg.code }, location.origin);
      send({ ok: true });
    }
  });

  hello();
  pollTimer = setInterval(() => { if (++tries > 20) clearInterval(pollTimer); else hello(); }, 3000);
})();
