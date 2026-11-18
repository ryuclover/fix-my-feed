/* Fix My Feed: shared, browser-independent policy. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const defaults = Object.freeze({ enabled: true, threshold: 3, expiryDays: 7,
    hideWatched: true, home: true, sidebar: true, shorts: true, mode: 'hide',
    autoFill: true, minFresh: 24, maxAttempts: 6, waitMs: 1500, memoryLimit: 10000 });
  const bounds = { threshold: [1, 50], expiryDays: [1, 365], minFresh: [1, 100],
    maxAttempts: [1, 20], waitMs: [500, 10000], memoryLimit: [100, 30000] };
  function settings(input = {}) {
    const out = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (bounds[key]) {
        const n = Number(input[key]);
        if (Number.isFinite(n)) out[key] = Math.min(bounds[key][1], Math.max(bounds[key][0], Math.round(n)));
      } else if (typeof defaults[key] === 'boolean' && typeof input[key] === 'boolean') out[key] = input[key];
    }
    out.mode = input.mode === 'dim' ? 'dim' : 'hide';
    return out;
  }
  function parseVideo(href, origin = 'https://www.youtube.com') {
    try {
      const url = new URL(href, origin);
      if (url.hostname !== 'www.youtube.com' && url.hostname !== 'youtube.com') return null;
      const short = url.pathname.startsWith('/shorts/');
      const id = short ? url.pathname.split('/')[2] : url.pathname === '/watch' ? url.searchParams.get('v') : null;
      return /^[\w-]{11}$/.test(id || '') ? { id, short } : null;
    } catch { return null; }
  }
  function reason(entry, blocked, s, now, shown, progress) {
    if (blocked) return 'blocked';
    if (s.hideWatched && (progress || (entry?.watched && now - entry.watched < 180 * DAY))) return 'watched';
    if (!shown && entry && now - entry.last < s.expiryDays * DAY && entry.count >= s.threshold) return 'repeat';
    return null;
  }
  function apply(state, op, now) {
    const s = settings(state.settings);
    state.seen ||= {};
    state.blocked ||= {};
    if (op.type === 'settings') state.settings = settings({ ...s, ...op.value });
    else if (op.type === 'clearSeen') state.seen = {};
    else if (op.type === 'clearBlocked') state.blocked = {};
    else if (op.type === 'events') {
      for (const event of (op.events || []).slice(0, 500)) {
        if (!/^[\w-]{11}$/.test(event.id || '')) continue;
        const entry = state.seen[event.id] ||= { count: 0, last: 0 };
        if (event.kind === 'impression') {
          // A view token makes retries idempotent, including across worker restarts.
          if (!event.view || entry.views?.includes(event.view)) continue;
          if (now - entry.last >= s.expiryDays * DAY) entry.count = 0;
          entry.count++;
          entry.last = now;
          entry.views = [...(entry.views || []).slice(-15), event.view];
        } else if (event.kind === 'watch') entry.watched = now;
      }
    } else if (op.type === 'block' && /^[\w-]{11}$/.test(op.id || '')) {
      if (op.on) state.blocked[op.id] = now;
      else delete state.blocked[op.id];
    }
    const current = settings(state.settings);
    for (const [id, entry] of Object.entries(state.seen)) {
      if (now - entry.last >= current.expiryDays * DAY && (!entry.watched || now - entry.watched >= 180 * DAY)) delete state.seen[id];
    }
    const ordered = Object.keys(state.seen).sort((a, b) => Math.max(state.seen[b].last, state.seen[b].watched || 0) - Math.max(state.seen[a].last, state.seen[a].watched || 0));
    for (const id of ordered.slice(current.memoryLimit)) delete state.seen[id];
    state.settings = current;
    return state;
  }
  const api = { DAY, defaults, settings, parseVideo, reason, apply };
  root.FMF = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
