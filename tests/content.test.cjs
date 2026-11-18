const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const core = require('../extension/core.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const id = 'abcdefghijk', other = 'lmnopqrstuv';
const card = video => `<ytd-rich-item-renderer><yt-lockup-view-model><a href="/watch?v=${video}">Vídeo</a></yt-lockup-view-model></ytd-rich-item-renderer>`;
async function setup({ settings = {}, seen = {}, blocked = {}, url = 'https://www.youtube.com/', markup } = {}) {
  const dom = new JSDOM(`<body>${markup || `<ytd-browse page-subtype="home">${card(id)}${card(other)}</ytd-browse>`}</body>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  let state = { settings: { ...core.defaults, autoFill: false, ...settings }, seen, blocked };
  const changes = [], messages = [], observers = [], calls = [];
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 200, width: 300, height: 200 });
  w.HTMLElement.prototype.getClientRects = function () { return this.dataset.fmf === 'hide' ? [] : [{}]; };
  w.HTMLElement.prototype.scrollIntoView = function () { calls.push('load'); };
  w.scrollTo = () => calls.push('restore');
  w.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.elements = new Set(); observers.push(this); }
    observe(el) { this.elements.add(el); }
    unobserve(el) { this.elements.delete(el); }
  };
  function changed() { for (const fn of changes) fn({ state: { newValue: structuredClone(state) } }, 'local'); }
  w.chrome = { runtime: { id: 'test',
    onMessage: { addListener(fn) { messages.push(fn); } },
    async sendMessage(message) {
      if (message.op) { core.apply(state, message.op, Date.now()); changed(); }
      return { state: structuredClone(state) };
    }
  }, storage: { onChanged: { addListener(fn) { changes.push(fn); } } } };
  w.eval(fs.readFileSync('extension/core.js', 'utf8'));
  w.eval(fs.readFileSync('extension/content.js', 'utf8'));
  await wait(250);
  return { w, dom, calls, get state() { return state; },
    async settings(value) { core.apply(state, { type: 'settings', value }, Date.now()); changed(); await wait(250); },
    message(type) { for (const fn of messages) fn({ type }, { id: 'test' }, () => {}); },
    intersect(ratio = 1) { for (const ob of observers) ob.callback([...ob.elements].map(target => ({ target, isIntersecting: ratio > 0, intersectionRatio: ratio }))); }
  };
}
test('filtra cartão externo, observa somente os novos e conta após tempo visível', async t => {
  const h = await setup({ seen: { [id]: { count: 3, last: Date.now() } } }); t.after(() => h.dom.window.close());
  const cards = h.w.document.querySelectorAll('ytd-rich-item-renderer');
  assert.equal(cards[0].dataset.fmf, 'hide'); assert.equal(cards[1].dataset.fmf, undefined);
  assert.equal(h.w.document.querySelectorAll('.fmf-hide').length, 2);
  h.intersect(0.2); await wait(850); assert.equal(h.state.seen[other], undefined);
  h.intersect(); await wait(850); assert.equal(h.state.seen[other].count, 1);
  h.intersect(); await wait(850); assert.equal(h.state.seen[other].count, 1);
  assert.equal(cards[1].dataset.fmf, undefined);
});
test('bloqueio, desfazer, modo esmaecido e desativação', async t => {
  const h = await setup(); t.after(() => h.dom.window.close());
  h.w.document.querySelector('.fmf-hide').click(); await wait(250);
  assert.ok(h.state.blocked[id]);
  assert.equal(h.w.document.querySelector('ytd-rich-item-renderer').dataset.fmf, 'hide');
  h.w.document.querySelector('#fmf-toast button').click(); await wait(250);
  assert.equal(h.state.blocked[id], undefined);
  await h.settings({ threshold: 1, mode: 'dim' });
  h.intersect(); await wait(850);
  h.w.history.pushState({}, '', '/?visit=2'); h.w.document.dispatchEvent(new h.w.Event('yt-navigate-finish')); await wait(250);
  assert.equal(h.w.document.querySelector('ytd-rich-item-renderer').dataset.fmf, 'dim');
  await h.settings({ enabled: false });
  assert.equal(h.w.document.querySelectorAll('[data-fmf],.fmf-hide,#fmf-bar').length, 0);
});
test('não toca busca, inscrições ou página de canal', async t => {
  for (const path of ['/results?search_query=x', '/feed/subscriptions', '/@channel']) {
    const h = await setup({ url: `https://www.youtube.com${path}`, blocked: { [id]: Date.now() } });
    try { assert.equal(h.w.document.querySelectorAll('[data-fmf],.fmf-hide,#fmf-bar').length, 0); }
    finally { h.dom.window.close(); }
  }
});
test('cartão reciclado troca identidade e perde filtro anterior', async t => {
  const h = await setup({ blocked: { [id]: Date.now() } }); t.after(() => h.dom.window.close());
  const first = h.w.document.querySelector('ytd-rich-item-renderer');
  assert.equal(first.dataset.fmf, 'hide');
  first.querySelector('a').href = `/watch?v=${other}`; await wait(250);
  assert.equal(first.dataset.fmf, undefined); assert.equal(first.dataset.fmfId, other);
});
test('reposição respeita limite e restaura a posição', async t => {
  const h = await setup({ settings: { autoFill: true, maxAttempts: 1, waitMs: 500 }, markup: `<ytd-browse page-subtype="home">${card(id)}<ytd-continuation-item-renderer></ytd-continuation-item-renderer></ytd-browse>` });
  t.after(() => h.dom.window.close());
  await wait(1400); assert.deepEqual(h.calls, ['load', 'restore']);
  await wait(600); assert.equal(h.calls.length, 2);
});
test('renovar oculta apenas cartões que apareceram nesta visita', async t => {
  const h = await setup(); t.after(() => h.dom.window.close());
  h.intersect(); await wait(850); h.message('fmf-renew'); await wait(250);
  assert.equal(h.w.document.querySelectorAll('[data-fmf="hide"]').length, 2);
  assert.equal(Object.keys(h.state.blocked).length, 0);
});
test('interação durante reposição interrompe tentativas e não move usuário de volta', async t => {
  const h = await setup({ settings: { autoFill: true, maxAttempts: 3, waitMs: 500 }, markup: `<ytd-browse page-subtype="home">${card(id)}<ytd-continuation-item-renderer></ytd-continuation-item-renderer></ytd-browse>` });
  t.after(() => h.dom.window.close());
  await wait(400); h.w.dispatchEvent(new h.w.Event('wheel')); await wait(1200);
  assert.deepEqual(h.calls, ['load']);
});
test('assistido exige reprodução e lateral é filtrada apenas dentro de related', async t => {
  const h = await setup({ url: `https://www.youtube.com/watch?v=${id}`, blocked: { [other]: Date.now() }, markup: `<ytd-watch-flexy><div id="movie_player"><video></video></div><div id="related">${card(other)}</div><div id="comments">${card(other)}</div></ytd-watch-flexy>` });
  t.after(() => h.dom.window.close());
  assert.equal(h.state.seen[id], undefined);
  assert.equal(h.w.document.querySelector('#related ytd-rich-item-renderer').dataset.fmf, 'hide');
  assert.equal(h.w.document.querySelector('#comments ytd-rich-item-renderer').dataset.fmf, undefined);
  h.w.document.querySelector('video').dispatchEvent(new h.w.Event('playing')); await wait(250);
  assert.ok(h.state.seen[id].watched);
});
