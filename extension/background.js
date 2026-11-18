'use strict';
if (typeof importScripts === 'function') importScripts('core.js');
const ext = globalThis.browser || globalThis.chrome;
// All tabs mutate through one queue: no read/modify/write races between tabs.
let queue = Promise.resolve();
ext.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.target !== 'fmf-store' || sender.id !== ext.runtime.id) return;
  const task = queue.then(async () => {
    const { state: stored } = await ext.storage.local.get('state');
    const state = stored || { settings: FMF.defaults, seen: {}, blocked: {} };
    if (msg.op && ['settings', 'events', 'block', 'clearSeen', 'clearBlocked'].includes(msg.op.type)) {
      FMF.apply(state, msg.op, Date.now());
      await ext.storage.local.set({ state });
    }
    return state;
  });
  queue = task.catch(() => {});
  task.then(state => respond({ state }), error => respond({ error: error.message }));
  return true;
});
