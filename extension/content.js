(() => {
  'use strict';
  const ext = globalThis.browser || globalThis.chrome;
  const containers = 'ytd-rich-item-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,ytd-reel-item-renderer,ytm-shorts-lockup-view-model-v2,ytm-shorts-lockup-view-model,yt-lockup-view-model';
  const progress = 'ytd-thumbnail-overlay-resume-playback-renderer,yt-thumbnail-overlay-progress-bar-view-model,.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment';
  let state = { settings: FMF.defaults, seen: {}, blocked: {} };
  let shown = new Set(), sessionHidden = new Set(), view = crypto.randomUUID(), lastUrl = '', scanTimer, toastTimer;
  let attempts = 0, filling = false, generation = 0, interaction = 0, fillTimer;
  let status = 'Pronto', loaded = false;
  const dwell = new Map();
  const observed = new Set();
  const reasons = { blocked: 'Ocultado por você', watched: 'Já assistido', repeat: 'Recomendação repetida' };
  const s = () => state.settings;
  async function store(op) {
    const result = await ext.runtime.sendMessage({ target: 'fmf-store', op });
    if (result?.error) throw new Error(result.error);
    return result.state;
  }
  function fail(error) {
    status = 'Falha ao salvar. Recarregue a aba.';
    console.warn('Fix My Feed:', error);
    updateToolbar();
  }
  function scope(el) {
    if (location.pathname === '/' && el.closest('ytd-browse[page-subtype="home"]')) return 'home';
    if (location.pathname === '/watch' && el.closest('#related')) return 'sidebar';
    return null;
  }
  function info(el) {
    return FMF.parseVideo(el.querySelector('a[href*="/watch?v="],a[href*="/shorts/"]')?.getAttribute('href'));
  }
  function cards() {
    return [...document.querySelectorAll(containers)].filter(el => !el.parentElement?.closest(containers));
  }
  function cancelDwell(el) {
    clearTimeout(dwell.get(el));
    dwell.delete(el);
  }
  function unobserve(el) {
    cancelDwell(el);
    io.unobserve(el);
    observed.delete(el);
  }
  function countImpression(el) {
    const id = el.dataset.fmfId;
    const area = scope(el), video = info(el);
    const rect = el.getBoundingClientRect();
    const intersection = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)) * Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    if (!s().enabled || !area || !s()[area] || !video || (video.short && !s().shorts) || !id || shown.has(id) || document.hidden || filling || el.dataset.fmf || video.id !== id || intersection < rect.width * rect.height * 0.5 || rect.width === 0) return;
    shown.add(id);
    store({ type: 'events', events: [{ id, kind: 'impression', view }] }).catch(fail);
  }
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      cancelDwell(entry.target);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !document.hidden && !filling) {
        dwell.set(entry.target, setTimeout(() => { dwell.delete(entry.target); countImpression(entry.target); }, 800));
      }
    }
  }, { threshold: [0, 0.5] });
  function setReason(el, why) {
    if (why) {
      el.dataset.fmf = s().mode;
      el.dataset.fmfReason = reasons[why];
    } else {
      delete el.dataset.fmf;
      delete el.dataset.fmfReason;
    }
  }
  function toast(id) {
    let node = document.getElementById('fmf-toast');
    if (!node) {
      node = document.createElement('div'); node.id = 'fmf-toast'; node.setAttribute('role', 'status');
      const label = document.createElement('span'); label.textContent = 'Vídeo ocultado.';
      const undo = document.createElement('button'); undo.textContent = 'Desfazer';
      undo.addEventListener('click', async () => {
        try { state = await store({ type: 'block', id: node.dataset.video, on: false }); node.hidden = true; schedule(); }
        catch (error) { fail(error); }
      });
      node.append(label, undo); document.body.append(node);
    }
    node.dataset.video = id; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 7000);
  }
  function addButton(el) {
    if (el.querySelector(':scope > .fmf-hide')) return;
    const button = document.createElement('button'); button.className = 'fmf-hide'; button.textContent = '×';
    button.title = 'Ocultar este vídeo'; button.setAttribute('aria-label', button.title);
    button.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation();
      const id = el.dataset.fmfId;
      if (!id) return;
      try { state = await store({ type: 'block', id, on: true }); toast(id); schedule(); }
      catch (error) { fail(error); }
    });
    el.classList.add('fmf-card'); el.append(button);
  }
  function evaluate(el) {
    const video = info(el), area = scope(el);
    const active = loaded && s().enabled && area && s()[area] && video && (!video.short || s().shorts);
    if (!active) {
      setReason(el, null); unobserve(el);
      el.querySelector(':scope > .fmf-hide')?.remove(); el.classList.remove('fmf-card'); return;
    }
    if (el.dataset.fmfId !== video.id) { unobserve(el); el.dataset.fmfId = video.id; }
    addButton(el);
    const why = (area === 'home' && sessionHidden.has(video.id) ? 'repeat' : null) || FMF.reason(state.seen[video.id], state.blocked[video.id], s(), Date.now(), shown.has(video.id), !!el.querySelector(progress));
    setReason(el, why);
    if (why) unobserve(el);
    else if (!observed.has(el)) { io.observe(el); observed.add(el); }
  }
  function freshCount() {
    return cards().filter(el => scope(el) === 'home' && info(el) && !el.dataset.fmf && el.getClientRects().length).length;
  }
  function updateToolbar() {
    const home = location.pathname === '/' && s().enabled && s().home;
    let bar = document.getElementById('fmf-bar');
    if (!home) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'fmf-bar';
      const text = document.createElement('span'); text.className = 'fmf-status'; text.setAttribute('aria-live', 'polite');
      const button = document.createElement('button'); button.textContent = 'Renovar feed';
      button.addEventListener('click', renew);
      bar.append(text, button); document.body.append(bar);
    }
    const hidden = document.querySelectorAll('[data-fmf]').length;
    bar.querySelector('.fmf-status').textContent = `Fix My Feed · ${hidden} filtrados · ${status}`;
  }
  function scan() {
    scanTimer = null;
    for (const el of [...observed]) if (!el.isConnected) unobserve(el);
    cards().forEach(evaluate);
    updateToolbar();
    if (!fillTimer && !filling && s().autoFill && attempts < s().maxAttempts) {
      fillTimer = setTimeout(() => { fillTimer = null; refill().catch(fail); }, 400);
    }
  }
  function schedule() { if (!scanTimer) scanTimer = setTimeout(scan, 180); }
  async function refill() {
    if (filling || !s().enabled || !s().home || !s().autoFill || s().mode !== 'hide' || location.pathname !== '/' || document.hidden || freshCount() >= s().minFresh || attempts >= s().maxAttempts) return;
    const home = document.querySelector('ytd-browse[page-subtype="home"]');
    const sentinel = home && [...home.querySelectorAll('ytd-continuation-item-renderer')].find(el => el.getClientRects().length);
    if (!sentinel) { status = 'Aguardando mais recomendações do YouTube'; updateToolbar(); return; }
    filling = true;
    for (const el of observed) cancelDwell(el);
    const token = generation, touched = interaction, x = scrollX, y = scrollY;
    attempts++;
    status = `Buscando novidades (${attempts}/${s().maxAttempts})`; updateToolbar();
    // YouTube loads its continuation when it enters the viewport. Restore the
    // reading position unless the user interacts or navigation changes meanwhile.
    sentinel.scrollIntoView({ behavior: 'instant', block: 'end' });
    await new Promise(resolve => setTimeout(resolve, s().waitMs));
    if (token === generation && touched === interaction) window.scrollTo({ left: x, top: y, behavior: 'instant' });
    filling = false;
    for (const el of observed) { io.unobserve(el); io.observe(el); }
    if (token !== generation) { schedule(); return; }
    if (touched !== interaction) attempts = s().maxAttempts;
    status = freshCount() >= s().minFresh ? 'Feed atualizado' : attempts >= s().maxAttempts ? 'Busca encerrada; o YouTube pode repetir sugestões' : 'Buscando mais opções';
    schedule();
  }
  function renew() {
    if (filling) return;
    // Renew discards only cards actually seen in this visit, not unseen cards
    // further down the page; setting count to threshold would affect other tabs.
    const discarded = new Set(shown);
    shown = new Set(); attempts = 0;
    for (const id of discarded) sessionHidden.add(id);
    status = 'Renovando';
    scan();
  }
  function navigate() {
    if (lastUrl === location.href) return;
    lastUrl = location.href; generation++; attempts = 0; shown = new Set(); sessionHidden = new Set(); view = crypto.randomUUID(); status = 'Pronto';
    for (const el of [...observed]) unobserve(el);
    // Opening a page is not proof of watching: require real player playback.
    schedule();
  }
  document.addEventListener('playing', event => {
    if (!(event.target instanceof HTMLVideoElement) || !event.target.closest('#movie_player,#shorts-player')) return;
    const video = FMF.parseVideo(location.href);
    if (loaded && s().enabled && video) store({ type: 'events', events: [{ id: video.id, kind: 'watch' }] }).catch(fail);
  }, true);
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(type, () => { interaction++; if (filling) attempts = s().maxAttempts; }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    for (const el of observed) { cancelDwell(el); io.unobserve(el); io.observe(el); }
    schedule();
  });
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.state) {
      state = changes.state.newValue || { settings: FMF.defaults, seen: {}, blocked: {} };
      state.settings = FMF.settings(state.settings); schedule();
    }
  });
  ext.runtime.onMessage.addListener((msg, sender, respond) => {
    if (sender.id !== ext.runtime.id) return;
    if (msg?.type === 'fmf-stats') respond({ hidden: document.querySelectorAll('[data-fmf]').length, tracked: Object.keys(state.seen).length, blocked: Object.keys(state.blocked).length, status });
    if (msg?.type === 'fmf-renew') { renew(); respond({ ok: true }); }
  });
  store().then(data => {
    state = data; state.settings = FMF.settings(state.settings); loaded = true;
    new MutationObserver(records => {
      if (records.some(r => !r.target.closest?.('#fmf-bar,#fmf-toast') && (r.type === 'attributes' || [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && !n.classList?.contains('fmf-hide'))))) schedule();
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
    document.addEventListener('yt-navigate-finish', navigate);
    setInterval(navigate, 1000);
    navigate();
  }).catch(fail);
})();
