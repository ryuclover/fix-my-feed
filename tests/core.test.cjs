const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../extension/core.js');
const id = 'abcdefghijk';
const now = 200 * core.DAY;
const fresh = () => ({ settings: { ...core.defaults }, seen: {}, blocked: {} });
test('repetições somem na próxima visita, nunca durante a exposição atual', () => {
  const state = fresh();
  for (let i = 0; i < 3; i++) core.apply(state, { type: 'events', events: [{ id, kind: 'impression', view: String(i) }] }, now + i);
  assert.equal(core.reason(state.seen[id], false, state.settings, now + 4, false, false), 'repeat');
  assert.equal(core.reason(state.seen[id], false, state.settings, now + 4, true, false), null);
  assert.equal(core.reason(state.seen[id], false, state.settings, now + 8 * core.DAY, false, false), null);
});
test('reenvio não duplica impressão e nova visita conta', () => {
  const state = fresh();
  const op = { type: 'events', events: [{ id, kind: 'impression', view: 'first' }] };
  core.apply(state, op, now); core.apply(state, op, now);
  assert.equal(state.seen[id].count, 1);
  core.apply(state, { type: 'events', events: [{ id, kind: 'impression', view: 'second' }] }, now);
  assert.equal(state.seen[id].count, 2);
});
test('assistidos expiram, bloqueio explícito persiste e desfazer restaura', () => {
  const state = fresh();
  core.apply(state, { type: 'events', events: [{ id, kind: 'watch' }] }, now);
  assert.equal(core.reason(state.seen[id], false, state.settings, now, false, false), 'watched');
  assert.equal(core.reason(state.seen[id], false, state.settings, now + 181 * core.DAY, false, false), null);
  core.apply(state, { type: 'block', id, on: true }, now);
  assert.equal(core.reason(null, state.blocked[id], state.settings, now, false, false), 'blocked');
  core.apply(state, { type: 'block', id, on: false }, now);
  assert.equal(state.blocked[id], undefined);
});
test('limite de memória, limpeza e configurações inválidas', () => {
  const state = fresh(); state.settings.memoryLimit = 100;
  for (let i = 0; i < 150; i++) state.seen[String(i).padStart(11, 'a')] = { count: 1, last: now + i };
  core.apply(state, { type: 'events' }, now);
  assert.equal(Object.keys(state.seen).length, 100);
  assert.equal(core.settings({ threshold: -1, waitMs: 999999, mode: 'invalid' }).threshold, 1);
  assert.equal(core.settings({ waitMs: 999999 }).waitMs, 10000);
  core.apply(state, { type: 'clearSeen' }, now);
  assert.equal(Object.keys(state.seen).length, 0);
});
test('somente URLs válidas de vídeos do YouTube', () => {
  assert.equal(core.parseVideo('/watch?v=abcdefghijk&x=1').id, id);
  assert.equal(core.parseVideo('/shorts/abcdefghijk').short, true);
  assert.equal(core.parseVideo('https://evil.example/watch?v=abcdefghijk'), null);
  assert.equal(core.parseVideo('/watch?v=bad'), null);
});
test('background serializa gravações concorrentes de abas diferentes', async () => {
  let listener, data = {}, writes = 0;
  const chrome = { runtime: { id: 'test', onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: {
      async get() { await new Promise(resolve => setTimeout(resolve, 5)); return structuredClone(data); },
      async set(value) { writes++; data = structuredClone(value); }
    } } };
  vm.runInNewContext(fs.readFileSync('extension/background.js', 'utf8'), { chrome, FMF: core, Date, Promise });
  const send = view => new Promise(resolve => listener({ target: 'fmf-store', op: { type: 'events', events: [{ id, kind: 'impression', view }] } }, { id: 'test' }, resolve));
  await Promise.all([send('tab-a'), send('tab-b')]);
  assert.equal(data.state.seen[id].count, 2); assert.equal(writes, 2);
});
