// Smoke test: run the real web/app.js against a live server with a stub DOM, and check it drives the game.
//   node tests/web/smoke.test.js http://127.0.0.1:8765
// (`make test-web` starts a server for you.)  Catches reference errors, API-contract drift and render-time exceptions.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const base = process.argv[2];
if (!base) { console.error('usage: node smoke.test.js <server url>'); process.exit(2); }

// A permissive element stub: any property read is a no-op function/value, `children` bookkeeping is minimal.
function el(id) {
  const listeners = {};
  const e = new Proxy({
    id, listeners, style: { setProperty() {} }, dataset: {}, children: [], textContent: '', innerHTML: '', value: '12', checked: true,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); },
    setAttribute() {}, remove() {}, querySelector: () => el('q'), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 480, height: 480, left: 0, top: 0 }), offsetWidth: 100, parentElement: null,
    getContext: () => ctx2d,
  }, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });
  return e;
}
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
const els = {};
const document = {
  getElementById: id => (els[id] = els[id] || el(id)),
  createElement: () => el('new'), querySelectorAll: () => [], addEventListener() {}, hidden: false,
};
const toasts = [];
const calls = [];
let raf = 0;
const sandbox = {
  document, console, Math, JSON, Promise, Array, Object, Number, String, Uint8Array, Error, TypeError, isFinite, Infinity, NaN,
  window: null, navigator: {}, localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} },
  crypto: { getRandomValues: a => { a.fill(7); return a; } }, AbortController, performance: { now: () => Date.now() },
  setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: cb => { if (raf++ < 30) setTimeout(() => cb(Date.now()), 30); return 0; }, matchMedia: () => ({ matches: true }),
  fetch: (u, o) => { calls.push((o && o.method || 'GET') + ' ' + u.replace(/\?.*/, '')); return fetch(base + u, o); },
};
sandbox.window = Object.assign(sandbox, { devicePixelRatio: 1, addEventListener() {} });
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../web/app.js'), 'utf8'), sandbox, { filename: 'web/app.js' });

(async () => {
  await new Promise(r => setTimeout(r, 1500));          // init() + the first AI ticks
  const seen = new Set(calls);
  assert(seen.has('GET /api/model') && seen.has('GET /api/metrics') && seen.has('GET /api/state'), 'init requests: ' + [...seen]);
  assert(seen.has('POST /api/ai-step'), 'the AI loop never ticked: ' + [...seen]);
  assert(els.score.textContent !== '0' || Number(els.steps.textContent) > 0, 'HUD was not updated');
  assert(els.modelName.textContent.includes('Double DQN'), 'model name: ' + els.modelName.textContent);
  assert(raf > 5, 'the render loop never ran');
  console.log('web smoke ok —', calls.length, 'requests, steps shown:', els.steps.textContent);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
