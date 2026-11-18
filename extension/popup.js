'use strict';
const ext = globalThis.browser || globalThis.chrome;
const feedback = document.getElementById('feedback');
async function store(op) {
  const result = await ext.runtime.sendMessage({ target: 'fmf-store', op });
  if (result.error) throw new Error(result.error);
  return result.state;
}
function report(error) { feedback.textContent = `Erro: ${error.message}`; }
async function activeTabMessage(type) {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Abra o YouTube para usar este botão.');
  return ext.tabs.sendMessage(tab.id, { type });
}
async function stats() {
  const state = await store();
  let page = '';
  try { const result = await activeTabMessage('fmf-stats'); page = `${result.hidden} filtrados nesta aba · `; } catch { /* not a YouTube tab */ }
  document.getElementById('stats').textContent = `${page}${Object.keys(state.seen).length} lembrados · ${Object.keys(state.blocked).length} bloqueados`;
}
async function init() {
  const state = await store();
  const settings = FMF.settings(state.settings);
  for (const key of Object.keys(FMF.defaults)) {
    const field = document.getElementById(key);
    if (field.type === 'checkbox') field.checked = settings[key]; else field.value = settings[key];
    field.addEventListener('change', async () => {
      const value = field.type === 'checkbox' ? field.checked : field.type === 'number' ? Number(field.value) : field.value;
      try {
        const saved = await store({ type: 'settings', value: { [key]: value } });
        if (field.type !== 'checkbox') field.value = saved.settings[key];
        feedback.textContent = 'Configurações salvas.';
      } catch (error) { report(error); }
    });
  }
  await stats();
}
document.getElementById('renew').addEventListener('click', async () => {
  try { await activeTabMessage('fmf-renew'); feedback.textContent = 'Solicitação enviada. Use na página inicial do YouTube.'; await stats(); }
  catch { feedback.textContent = 'Abra a página inicial do YouTube e recarregue a aba.'; }
});
for (const type of ['clearSeen', 'clearBlocked']) {
  const button = document.getElementById(type), original = button.textContent;
  button.addEventListener('click', async () => {
    if (!button.dataset.confirm) {
      button.dataset.confirm = 'yes'; button.textContent = 'Clique novamente para confirmar';
      setTimeout(() => { delete button.dataset.confirm; button.textContent = original; }, 5000); return;
    }
    delete button.dataset.confirm; button.textContent = original;
    try { await store({ type }); feedback.textContent = 'Memória atualizada.'; await stats(); }
    catch (error) { report(error); }
  });
}
init().catch(report);
