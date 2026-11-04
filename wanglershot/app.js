import * as core from './core.js';
import { drawCover, emojiFor, SYMBOL_EMOJI } from './art.js';

const ROLE_ORDER = ['lens', 'filter', 'support', 'accessory', 'body'];
const ROLE_TITLE = { body: 'Body', lens: 'Lens', filter: 'Filter', support: 'Support', accessory: 'Accessory' };
const TABS = [['settings', 'Settings'], ['gear', 'Gear'], ['steps', 'Steps'], ['notes', 'Notes']];
const ICON = {
  aperture: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M14.3 8l5.7 9.9M9.7 8h11.4M7.4 12l5.7-9.9M9.7 16L4 6.1M14.3 16H2.9M16.6 12l-5.7 9.9"/></svg>',
  more: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>'
};

let state = core.emptyState();
let covers = {};
let seed = null;
let storageOK = true;
const ui = { tab: 'settings', pagerID: null };
const layers = [];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = html => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const findGuide = id => state.guides.find(g => g.id === id);
const findGear = id => state.gear.find(g => g.id === id);

let dbPromise = null;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('wanglershot', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function dbGet(key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function dbPut(entries) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('kv', 'readwrite');
    for (const [k, v] of entries) t.objectStore('kv').put(v, k);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

let saveTimer = null;
let coversDirty = false;
function save({ withCovers = false } = {}) {
  coversDirty ||= withCovers;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

async function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!storageOK) return;
  const entries = [['state', JSON.parse(JSON.stringify(state))]];
  if (coversDirty) entries.push(['covers', { ...covers }]);
  try {
    await dbPut(entries);
    coversDirty = false;
  } catch {
    storageOK = false;
    toast('Saving failed. Export a backup from Settings.');
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && saveTimer) saveNow();
});

function toast(msg) {
  const el = h(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function dialog(message, actions) {
  return new Promise(resolve => {
    const el = h(`<div class="dialog-backdrop"><div class="dialog">${message ? `<p>${esc(message)}</p>` : ''}<div class="actions">${actions.map((a, i) => `<button class="btn ${a.style ?? ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}<button class="btn" data-i="-1">Cancel</button></div></div></div>`);
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (!b && e.target !== el) return;
      const i = b ? Number(b.dataset.i) : -1;
      el.remove();
      resolve(i >= 0 ? actions[i].value : null);
    });
    document.body.appendChild(el);
  });
}

const confirmDialog = (message, label, style = 'danger') => dialog(message, [{ label, value: true, style }]).then(v => v === true);

function pushLayer(el, onPop) {
  document.body.appendChild(el);
  layers.push({ el, onPop });
  history.pushState({ depth: layers.length }, '');
}

function closeLayer() {
  history.back();
}

window.addEventListener('popstate', () => {
  const top = layers.pop();
  if (!top) return;
  top.onPop?.();
  top.el.remove();
  paintArt(document);
});

function coverHTML(g) {
  const src = covers[g.id];
  return src ? `<img src="${esc(src)}" alt="" data-fallback="${esc(g.id)}" data-symbol="${esc(g.symbol)}">` : `<canvas data-art="${esc(g.id)}" data-symbol="${esc(g.symbol)}"></canvas>`;
}

document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
  const canvas = document.createElement('canvas');
  canvas.dataset.art = img.dataset.fallback;
  canvas.dataset.symbol = img.dataset.symbol ?? '';
  img.replaceWith(canvas);
  paintArt(canvas.parentElement ?? document);
}, true);

function paintArt(root) {
  requestAnimationFrame(() => {
    root.querySelectorAll('canvas[data-art]').forEach(c => {
      if (c.offsetParent !== null || c.getClientRects().length) drawCover(c, c.dataset.art, c.dataset.symbol);
    });
  });
}

function renderHome() {
  const guides = core.visibleGuides(state);
  const app = document.getElementById('app');
  app.innerHTML = '';
  const el = h(`<div class="screen" id="home">
    <div class="bar">
      <button class="round" data-act="gear" aria-label="My gear">${ICON.aperture}</button>
      <div class="title"></div>
      <button class="round" data-act="menu" aria-label="More">${ICON.more}</button>
    </div>
    <div class="scroll">
      <h1 class="big-title">WanglerShot</h1>
      <div class="grid">${guides.map(g => `<button class="tile" data-act="open" data-id="${esc(g.id)}" aria-label="${esc(g.title)}">${coverHTML(g)}${g.pendingUpdate ? '<span class="badge">Update</span>' : ''}<span class="label">${esc(g.title)}</span></button>`).join('')}</div>
      ${guides.length ? '' : '<p class="muted" style="padding:0 16px">No photo types. Add one from the ⋯ menu or restore built-ins in Settings.</p>'}
    </div>
  </div>`);
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'open') openPager(b.dataset.id);
    if (act === 'gear') openGearList();
    if (act === 'menu') {
      const choice = await dialog('', [
        { label: 'Add photo type', value: 'add' },
        { label: 'Reorder photo types', value: 'reorder' },
        { label: 'Settings & backup', value: 'settings' }
      ]);
      if (choice === 'add') openGuideEditor(core.newGuide(state), true);
      if (choice === 'reorder') openReorder();
      if (choice === 'settings') openSettings();
    }
  });
  app.appendChild(el);
  paintArt(el);
}

function settingsHTML(g) {
  const rows = g.settings.filter(r => String(r.value).trim());
  return `<div class="cards">${rows.map(r => `<div class="card${r.value.length > 48 ? ' wide' : ''}"><small>${esc(r.label)}</small><b>${esc(r.value)}</b></div>`).join('')}</div>
    ${g.warnings.map(w => `<div class="warn"><span>⚠️</span><span>${esc(w)}</span></div>`).join('')}`;
}

function gearHTML(g) {
  const resolved = core.resolveGear(state, g);
  if (!resolved.length) return '<p class="muted">No gear assigned. Tap Edit to pick gear from your inventory.</p>';
  return ROLE_ORDER.map(role => {
    const items = resolved.filter(([u]) => u.role === role);
    if (!items.length) return '';
    return `<div class="section-title">${ROLE_TITLE[role]}${items.length > 1 ? 's' : ''}</div>${items.map(([u, item]) => `<div class="gear-item">
      <div class="top"><span>${esc(item.name)}</span>${item.filterThread ? `<span class="thread">${esc(item.filterThread)}</span>` : ''}</div>
      ${u.note ? `<div class="use">${esc(u.note)}</div>` : ''}
      ${item.details ? `<div class="details">${esc(item.details)}</div>` : ''}
    </div>`).join('')}`;
  }).join('');
}

function stepsHTML(g) {
  return `<ol class="steps">${g.steps.map(s => `<li><span>${esc(s)}</span></li>`).join('')}</ol>
    ${g.tips.length ? `<div class="section-title">Tips</div>${g.tips.map(t => `<div class="tip"><span>💡</span><span>${esc(t)}</span></div>`).join('')}` : ''}`;
}

function notesHTML(g) {
  const notes = core.notesFor(state, g.id);
  const fmt = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `<textarea data-draft placeholder="Add a note for this shot…" rows="3"></textarea>
    <div style="text-align:right;margin-top:8px"><button class="btn primary" data-act="add-note">Add note</button></div>
    ${notes.length ? '' : '<p class="muted">No notes yet. Jot down what worked, locations, or settings you tweaked.</p>'}
    ${notes.map(n => `<button class="note" data-act="note" data-id="${esc(n.id)}"><p>${esc(n.text)}</p><time>${esc(fmt(n.updatedAt))}</time></button>`).join('')}`;
}

function tabHTML(g) {
  return { settings: settingsHTML, gear: gearHTML, steps: stepsHTML, notes: notesHTML }[ui.tab](g);
}

function pageInner(g) {
  return `<div class="hero">${coverHTML(g)}<div class="label">${esc(emojiFor(g.symbol))} ${esc(g.title)}${g.summary ? `<span>${esc(g.summary)}</span>` : ''}</div></div>
    ${g.pendingUpdate ? `<div class="banner"><b>An updated version of this guide is available.</b><div class="row"><button class="btn primary" data-act="apply-update">Use update</button><button class="btn" data-act="keep-mine">Keep mine</button></div></div>` : ''}
    <div class="seg">${TABS.map(([k, label]) => `<button data-act="tab" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}">${label}</button>`).join('')}</div>
    <div class="tabbody">${tabHTML(g)}</div>`;
}

function pagerEl() {
  return layers.find(l => l.el.id === 'pager')?.el ?? null;
}

function openPager(id) {
  ui.pagerID = id;
  const el = h(`<div class="screen" id="pager">
    <div class="bar">
      <button class="round" data-act="back" aria-label="Back">${ICON.back}</button>
      <div class="title"><b></b><small></small></div>
      <button class="pill" data-act="edit">Edit</button>
    </div>
    <div class="pager"></div>
  </div>`);
  const strip = el.querySelector('.pager');
  let scrollTimer = null;
  strip.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const guides = core.visibleGuides(state);
      const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
      const g = guides[Math.min(Math.max(i, 0), guides.length - 1)];
      if (g && g.id !== ui.pagerID) {
        ui.pagerID = g.id;
        updatePagerHeader();
      }
    }, 60);
  });
  el.addEventListener('click', e => onPagerClick(e, el));
  pushLayer(el, () => renderHome());
  renderPages(true);
}

function updatePagerHeader() {
  const el = pagerEl();
  if (!el) return;
  const guides = core.visibleGuides(state);
  const i = guides.findIndex(g => g.id === ui.pagerID);
  el.querySelector('.title b').textContent = guides[i]?.title ?? '';
  el.querySelector('.title small').textContent = i >= 0 ? `${i + 1} of ${guides.length}` : '';
}

function renderPages(jump = false, fallbackIndex = 0) {
  const el = pagerEl();
  if (!el) return;
  const guides = core.visibleGuides(state);
  if (!guides.length) {
    closeLayer();
    return;
  }
  if (!guides.some(g => g.id === ui.pagerID)) {
    ui.pagerID = guides[Math.min(Math.max(fallbackIndex, 0), guides.length - 1)].id;
    jump = true;
  }
  const strip = el.querySelector('.pager');
  const left = strip.scrollLeft;
  strip.innerHTML = guides.map(g => `<section class="page" data-id="${esc(g.id)}">${pageInner(g)}</section>`).join('');
  const i = guides.findIndex(g => g.id === ui.pagerID);
  requestAnimationFrame(() => {
    strip.scrollLeft = jump ? i * strip.clientWidth : left;
  });
  updatePagerHeader();
  paintArt(strip);
}

function renderPage(id) {
  const page = pagerEl()?.querySelector(`.page[data-id="${CSS.escape(id)}"]`);
  const g = findGuide(id);
  if (!page || !g) return;
  const top = page.scrollTop;
  page.innerHTML = pageInner(g);
  page.scrollTop = top;
  paintArt(page);
}

function onPagerClick(e, el) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  const page = b.closest('.page');
  const g = page ? findGuide(page.dataset.id) : findGuide(ui.pagerID);
  if (act === 'back') closeLayer();
  if (act === 'edit' && g) openGuideEditor(g, false);
  if (act === 'tab') {
    ui.tab = b.dataset.tab;
    el.querySelectorAll('.page').forEach(p => {
      const pg = findGuide(p.dataset.id);
      if (!pg) return;
      p.querySelector('.tabbody').innerHTML = tabHTML(pg);
      p.querySelectorAll('.seg button').forEach(s => s.classList.toggle('on', s.dataset.tab === ui.tab));
    });
  }
  if (!g) return;
  if (act === 'apply-update') { core.applyPending(g, 'guide'); save(); renderPage(g.id); updatePagerHeader(); }
  if (act === 'keep-mine') { core.keepMine(g); save(); renderPage(g.id); }
  if (act === 'add-note') {
    const ta = page.querySelector('[data-draft]');
    if (core.addNote(state, ta.value, g.id)) {
      save();
      renderPage(g.id);
    }
  }
  if (act === 'note') {
    const note = state.notes.find(n => n.id === b.dataset.id);
    if (note) openNoteEditor(note, () => renderPage(g.id));
  }
}

function openNoteEditor(note, done) {
  const el = h(`<div class="screen sheet">
    <div class="bar"><button class="pill" data-act="cancel">Cancel</button><div class="title"><b>Note</b></div><button class="pill" data-act="save">Save</button></div>
    <div class="form"><h3>Text</h3><textarea rows="10" data-text>${esc(note.text)}</textarea>
    <p><button class="btn danger" data-act="delete">Delete note</button></p></div>
  </div>`);
  el.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cancel') closeLayer();
    if (act === 'save') {
      core.updateNote(note, el.querySelector('[data-text]').value);
      save();
      closeLayer();
      done();
    }
    if (act === 'delete' && await confirmDialog('Delete this note?', 'Delete')) {
      core.deleteNote(state, note);
      save();
      closeLayer();
      done();
    }
  });
  pushLayer(el);
}

async function resizeImage(file, max = 1400) {
  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = source.width, hgt = source.height;
  const scale = Math.min(1, max / Math.max(w, hgt));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(hgt * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function listEditor(title, key, items, placeholder) {
  return `<h3>${title}</h3><div class="group">${items.map((v, i) => `<div class="row1">
      <textarea rows="2" data-list="${key}" data-index="${i}" placeholder="${esc(placeholder)}">${esc(v)}</textarea>
      <div style="display:grid;gap:4px"><button class="icon-btn" data-act="up" data-list="${key}" data-index="${i}" aria-label="Move up">↑</button><button class="icon-btn del" data-act="del" data-list="${key}" data-index="${i}" aria-label="Delete">✕</button></div>
    </div>`).join('')}<button class="btn link" data-act="add" data-list="${key}">＋ Add</button></div>`;
}

function openGuideEditor(g, isNew) {
  const session = core.editSession(g, 'guide');
  let staged;
  let finished = false;
  const el = h(`<div class="screen sheet">
    <div class="bar"><button class="pill" data-act="cancel">Cancel</button><div class="title"><b>${isNew ? 'New photo type' : 'Edit'}</b></div><button class="pill" data-act="done">Done</button></div>
    <div class="scroll"><div class="form"></div></div>
  </div>`);
  const form = el.querySelector('.form');
  const scroller = el.querySelector('.scroll');

  const previewHTML = () => {
    const src = staged === undefined ? covers[g.id] : staged;
    return src ? `<img src="${esc(src)}" alt="" data-fallback="${esc(g.id)}" data-symbol="${esc(g.symbol)}">` : `<canvas data-art="${esc(g.id)}" data-symbol="${esc(g.symbol)}"></canvas>`;
  };

  const render = () => {
    const top = scroller.scrollTop;
    const inventory = core.visibleGear(state);
    const hasPhoto = staged === undefined ? !!covers[g.id] : !!staged;
    form.innerHTML = `
      <h3>Photo type</h3>
      <div class="group">
        <input type="text" data-field="title" placeholder="Title" value="${esc(g.title)}">
        <textarea rows="2" data-field="summary" placeholder="Summary">${esc(g.summary)}</textarea>
        <div class="icons">${Object.keys(SYMBOL_EMOJI).map(s => `<button data-act="symbol" data-symbol="${s}" class="${g.symbol === s ? 'on' : ''}" aria-label="${s}">${SYMBOL_EMOJI[s]}</button>`).join('')}</div>
      </div>
      <h3>Tile picture</h3>
      <div class="group">
        <div class="preview">${previewHTML()}</div>
        <label class="btn link" style="display:block">📷 ${hasPhoto ? 'Change photo' : 'Use my photo'}<input type="file" accept="image/*" data-photo hidden></label>
        ${hasPhoto ? '<button class="btn danger" data-act="clear-photo">Use built-in picture</button>' : ''}
      </div>
      <h3>Settings</h3>
      <div class="group">${g.settings.map((r, i) => `<div class="row2">
          <input type="text" data-list="settings" data-index="${i}" data-key="label" placeholder="Label" value="${esc(r.label)}">
          <textarea rows="1" data-list="settings" data-index="${i}" data-key="value" placeholder="Value">${esc(r.value)}</textarea>
          <button class="icon-btn del" data-act="del" data-list="settings" data-index="${i}" aria-label="Delete">✕</button>
        </div>`).join('')}<button class="btn link" data-act="add" data-list="settings">＋ Add setting</button></div>
      <h3>Gear</h3>
      <div class="group">${g.gear.map((u, i) => `<div class="use-row">
          <div class="line">
            <select data-list="gear" data-index="${i}" data-key="gearID">
              ${inventory.some(x => x.id === u.gearID) ? '' : `<option value="${esc(u.gearID)}" selected>Missing item</option>`}
              ${inventory.map(x => `<option value="${esc(x.id)}" ${x.id === u.gearID ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
            </select>
            <select data-list="gear" data-index="${i}" data-key="role">${core.CATEGORIES.map(c => `<option value="${c}" ${u.role === c ? 'selected' : ''}>${ROLE_TITLE[c]}</option>`).join('')}</select>
            <button class="icon-btn del" data-act="del" data-list="gear" data-index="${i}" aria-label="Delete">✕</button>
          </div>
          <input type="text" data-list="gear" data-index="${i}" data-key="note" placeholder="How to use it here" value="${esc(u.note)}">
        </div>`).join('')}<button class="btn link" data-act="add" data-list="gear" ${inventory.length ? '' : 'disabled'}>＋ Add gear</button></div>
      ${listEditor('Warnings', 'warnings', g.warnings, 'Gotcha to watch for')}
      ${listEditor('Steps', 'steps', g.steps, 'Step')}
      ${listEditor('Tips', 'tips', g.tips, 'Tip')}
      ${isNew ? '' : `<h3>&nbsp;</h3><div class="group">
        ${g.isBuiltIn && g.isUserModified ? '<button class="btn" data-act="reset">Reset to default</button>' : ''}
        <button class="btn danger" data-act="delete">Delete photo type</button></div>`}
      <div style="height:40px"></div>`;
    scroller.scrollTop = top;
    paintArt(form);
  };

  const finish = () => {
    finished = true;
    renderHome();
    if (pagerEl()) renderPages();
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    if (isNew) core.deleteGuide(state, g);
    else session.cancel(g);
    save();
    renderHome();
    if (pagerEl()) renderPages();
  };

  form.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.field) g[t.dataset.field] = t.value;
    if (t.dataset.list) {
      const list = g[t.dataset.list];
      const i = Number(t.dataset.index);
      if (i >= list.length) return;
      if (t.dataset.key) list[i][t.dataset.key] = t.value;
      else list[i] = t.value;
    }
  });
  form.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset.list === 'gear' && t.tagName === 'SELECT') {
      const i = Number(t.dataset.index);
      if (i < g.gear.length) g.gear[i][t.dataset.key] = t.value;
    }
    if (t.matches('[data-photo]') && t.files?.[0]) {
      try {
        staged = await resizeImage(t.files[0]);
        render();
      } catch {
        toast('That image could not be read.');
      }
    }
  });

  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const key = b.dataset.list;
    const i = Number(b.dataset.index);
    if (act === 'symbol') { g.symbol = b.dataset.symbol; render(); }
    if (act === 'clear-photo') { staged = null; render(); }
    if (act === 'add') {
      if (key === 'settings') g.settings.push({ id: core.uid(), label: '', value: '' });
      else if (key === 'gear') {
        const first = core.visibleGear(state)[0];
        if (first) g.gear.push({ id: core.uid(), gearID: first.id, role: first.category, note: '' });
      } else g[key].push('');
      render();
    }
    if (act === 'del' && i < g[key].length) { g[key].splice(i, 1); render(); }
    if (act === 'up' && i > 0 && i < g[key].length) { [g[key][i - 1], g[key][i]] = [g[key][i], g[key][i - 1]]; render(); }
    if (act === 'reset') { core.resetToDefault(g, 'guide'); render(); }
    if (act === 'cancel') closeLayer();
    if (act === 'done') {
      if (!g.title.trim()) { toast('Give the photo type a title.'); return; }
      g.settings = g.settings.filter(r => r.label.trim() || r.value.trim());
      for (const k of ['steps', 'tips', 'warnings']) g[k] = g[k].filter(s => s.trim());
      session.save(g);
      if (staged !== undefined) {
        if (staged) covers[g.id] = staged;
        else delete covers[g.id];
      }
      save({ withCovers: staged !== undefined });
      finished = true;
      closeLayer();
      finish();
    }
    if (act === 'delete') {
      const count = core.notesFor(state, g.id).length;
      const msg = g.isBuiltIn
        ? `Hide this built-in photo type? Your ${count} note(s) are kept and you can restore it in Settings.`
        : count ? `Delete this photo type and its ${count} note(s)?` : 'Delete this photo type?';
      if (!await confirmDialog(msg, g.isBuiltIn ? 'Hide' : 'Delete')) return;
      const index = core.visibleGuides(state).findIndex(x => x.id === g.id);
      session.cancel(g);
      const removed = core.deleteGuide(state, g);
      if (removed) delete covers[removed];
      save({ withCovers: !!removed });
      finished = true;
      closeLayer();
      renderHome();
      if (pagerEl()) renderPages(false, index);
    }
  });

  pushLayer(el, cancel);
  render();
}

function openGearList() {
  const el = h(`<div class="screen sheet">
    <div class="bar"><button class="pill" data-act="close">Done</button><div class="title"><b>My Gear</b></div><button class="pill" data-act="add">＋</button></div>
    <div class="scroll"><div class="form"></div></div>
  </div>`);
  const form = el.querySelector('.form');
  const render = () => {
    const items = core.visibleGear(state);
    form.innerHTML = core.CATEGORIES.map(cat => {
      const group = items.filter(x => x.category === cat);
      if (!group.length) return '';
      return `<h3>${ROLE_TITLE[cat]}</h3>${group.map(x => `<div class="list-row">
        <button class="grow" style="all:unset;flex:1;min-width:0" data-act="edit" data-id="${esc(x.id)}">
          <div><b>${esc(x.name)}</b> ${x.filterThread ? `<span class="muted">${esc(x.filterThread)}</span>` : ''} ${x.pendingUpdate ? '<span style="color:var(--accent)">• update</span>' : ''}</div>
          ${x.details ? `<div class="sub">${esc(x.details)}</div>` : ''}
        </button>
        <button class="icon-btn del" data-act="delete" data-id="${esc(x.id)}" aria-label="Delete">✕</button>
      </div>`).join('')}`;
    }).join('') + '<div style="height:40px"></div>';
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') closeLayer();
    if (act === 'add') openGearEditor(core.newGear(state), true, render);
    if (act === 'edit') {
      const item = findGear(b.dataset.id);
      if (item) openGearEditor(item, false, render);
    }
    if (act === 'delete') {
      const item = findGear(b.dataset.id);
      if (!item) return;
      const used = core.guidesUsing(state, item.id).map(x => x.title);
      const msg = `Delete ${item.name}? ${used.length ? `It will be removed from: ${used.join(', ')}.` : 'Not used by any photo type.'}`;
      if (await confirmDialog(msg, 'Delete')) {
        core.deleteGear(state, item);
        save();
        render();
      }
    }
  });
  pushLayer(el, () => { if (pagerEl()) renderPages(); });
  render();
}

function openGearEditor(item, isNew, done) {
  const session = core.editSession(item, 'gear');
  let finished = false;
  const el = h(`<div class="screen sheet">
    <div class="bar"><button class="pill" data-act="cancel">Cancel</button><div class="title"><b>${isNew ? 'New gear' : 'Edit gear'}</b></div><button class="pill" data-act="done">Done</button></div>
    <div class="scroll"><div class="form"></div></div>
  </div>`);
  const form = el.querySelector('.form');
  const render = () => {
    form.innerHTML = `
      ${item.pendingUpdate ? `<div class="banner"><b>An updated version of this item is available.</b><div class="row"><button class="btn primary" data-act="apply-update">Use update</button><button class="btn" data-act="keep-mine">Keep mine</button></div></div>` : ''}
      <h3>Item</h3>
      <div class="group">
        <input type="text" data-field="name" placeholder="Name" value="${esc(item.name)}">
        <select data-field="category">${core.CATEGORIES.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${ROLE_TITLE[c]}</option>`).join('')}</select>
        <input type="text" data-field="filterThread" placeholder="Filter thread (e.g. 72mm)" value="${esc(item.filterThread ?? '')}">
      </div>
      <h3>Details</h3>
      <div class="group"><textarea rows="5" data-field="details" placeholder="Notes about this item">${esc(item.details)}</textarea></div>
      ${item.isBuiltIn && item.isUserModified ? '<h3>&nbsp;</h3><div class="group"><button class="btn" data-act="reset">Reset to default</button></div>' : ''}`;
  };
  const onField = e => {
    const f = e.target.dataset.field;
    if (!f) return;
    item[f] = f === 'filterThread' ? (e.target.value.trim() || null) : e.target.value;
  };
  form.addEventListener('input', onField);
  form.addEventListener('change', onField);
  const cancel = () => {
    if (finished) return;
    finished = true;
    if (isNew) core.deleteGear(state, item);
    else session.cancel(item);
    save();
    done();
  };
  el.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'apply-update') { core.applyPending(item, 'gear'); render(); }
    if (act === 'keep-mine') { core.keepMine(item); render(); }
    if (act === 'reset') { core.resetToDefault(item, 'gear'); render(); }
    if (act === 'cancel') closeLayer();
    if (act === 'done') {
      if (!item.name.trim()) { toast('Give the item a name.'); return; }
      session.save(item);
      save();
      finished = true;
      closeLayer();
      done();
    }
  });
  pushLayer(el, cancel);
  render();
}

function openReorder() {
  const el = h(`<div class="screen sheet">
    <div class="bar"><div class="title" style="text-align:left"><b>Reorder</b></div><button class="pill" data-act="close">Done</button></div>
    <div class="scroll"><div class="form"></div></div>
  </div>`);
  const form = el.querySelector('.form');
  const render = () => {
    const guides = core.visibleGuides(state);
    form.innerHTML = '<h3>Photo types</h3>' + guides.map((g, i) => `<div class="list-row">
      <span style="font-size:22px">${esc(emojiFor(g.symbol))}</span><span class="grow">${esc(g.title)}</span>
      <button class="icon-btn" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
      <button class="icon-btn" data-act="down" data-i="${i}" ${i === guides.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
    </div>`).join('');
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'close') { closeLayer(); return; }
    const ids = core.visibleGuides(state).map(g => g.id);
    const i = Number(b.dataset.i);
    const j = b.dataset.act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    core.reorder(state, ids);
    save();
    render();
  });
  pushLayer(el, () => renderHome());
  render();
}

async function exportBackup() {
  await saveNow();
  const name = `wanglershot-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(core.makeBackup(state, covers))], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'WanglerShot backup' });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = h(`<a href="${url}" download="${name}"></a>`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function importBackup(file) {
  let parsed;
  try {
    parsed = core.parseBackup(await file.text());
  } catch (err) {
    toast(err.message);
    return false;
  }
  const notes = parsed.state.notes.length;
  if (!await confirmDialog(`Replace everything in the app with this backup (${notes} note${notes === 1 ? '' : 's'})? Current notes and edits will be overwritten.`, 'Replace with backup')) return false;
  state = parsed.state;
  covers = parsed.covers;
  if (seed) core.importSeed(state, seed, { hasCover: id => !!covers[id] });
  coversDirty = true;
  await saveNow();
  toast('Backup restored.');
  return true;
}

function openSettings() {
  const el = h(`<div class="screen sheet">
    <div class="bar"><div class="title" style="text-align:left"><b>Settings</b></div><button class="pill" data-act="close">Done</button></div>
    <div class="scroll"><div class="form"></div></div>
  </div>`);
  const form = el.querySelector('.form');
  const render = () => {
    const rg = state.guides.filter(g => g.isRemoved);
    const rgear = state.gear.filter(g => g.isRemoved);
    form.innerHTML = `
      <h3>Backup</h3>
      <div class="group">
        <button class="btn primary" data-act="export">Export backup</button>
        <label class="btn" style="text-align:center">Import backup<input type="file" accept="application/json,.json" data-import hidden></label>
        <p class="muted" style="margin:4px 2px">Export saves your notes, edits, gear and photos to one file. Save it to Files or iCloud Drive. Import replaces everything in the app.</p>
        ${storageOK ? '' : '<p style="color:var(--danger);margin:4px 2px">Storage is unavailable — changes will be lost when the app closes. Export a backup now.</p>'}
      </div>
      <h3>Deleted built-in photo types</h3>
      <div class="group">${rg.length ? rg.map(g => `<div class="row1"><span>${esc(emojiFor(g.symbol))} ${esc(g.title)}</span><button class="btn link" data-act="restore-guide" data-id="${esc(g.id)}">Restore</button></div>`).join('') : '<span class="muted">None</span>'}</div>
      <h3>Deleted built-in gear</h3>
      <div class="group">${rgear.length ? rgear.map(g => `<div class="row1"><span>${esc(g.name)}</span><button class="btn link" data-act="restore-gear" data-id="${esc(g.id)}">Restore</button></div>`).join('') : '<span class="muted">None</span>'}
        <span class="muted">Restored gear is not re-added to photo types automatically.</span></div>
      <h3>About</h3>
      <div class="group"><span>Camera: Canon EOS R8</span><span class="muted">Content version ${state.seedVersion}</span></div>
      <div style="height:40px"></div>`;
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') closeLayer();
    if (act === 'export') exportBackup();
    if (act === 'restore-guide') {
      const g = findGuide(b.dataset.id);
      if (g) { core.restore(state, g, 'guide'); save(); render(); }
    }
    if (act === 'restore-gear') {
      const g = findGear(b.dataset.id);
      if (g) { core.restore(state, g, 'gear'); save(); render(); }
    }
  });
  el.addEventListener('change', async e => {
    if (!e.target.matches('[data-import]')) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && await importBackup(file)) render();
  });
  pushLayer(el, () => renderHome());
  render();
}

async function boot() {
  try {
    state = (await dbGet('state')) ?? core.emptyState();
    covers = (await dbGet('covers')) ?? {};
  } catch {
    storageOK = false;
  }
  try {
    const res = await fetch('seed.json', { cache: 'no-cache' });
    seed = await res.json();
    if (core.importSeed(state, seed, { hasCover: id => !!covers[id] })) await saveNow();
  } catch {
    if (!state.guides.length) toast('Could not load the built-in guides. Open once with a connection.');
  }
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) toast('Update installed. Close and reopen WanglerShot to use it.');
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  history.replaceState({ depth: 0 }, '');
  renderHome();
  const params = new URLSearchParams(location.search);
  const open = params.get('open');
  if (open && findGuide(open)) {
    ui.tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'settings';
    openPager(open);
  }
  if (params.get('edit') && findGuide(params.get('edit'))) openGuideEditor(findGuide(params.get('edit')), false);
  if (params.get('screen') === 'settings') openSettings();
  if (params.get('screen') === 'gear') openGearList();
  window.addEventListener('resize', () => paintArt(document));
}

boot();
