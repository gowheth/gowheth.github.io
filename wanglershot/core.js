export const CATEGORIES = ['body', 'lens', 'filter', 'support', 'accessory'];
export const CORE_LABELS = ['Mode', 'Aperture', 'Shutter', 'ISO', 'White Balance', 'Focus', 'Drive', 'IS', 'Metering'];
export const BACKUP_FORMAT = 'wanglershot-backup';

export const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export function emptyState() {
  return { seedVersion: 0, guides: [], gear: [], notes: [] };
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const clone = v => (v == null ? null : JSON.parse(JSON.stringify(v)));

export function seedValue(item, kind) {
  if (kind === 'gear') {
    return { id: item.id, name: item.name, category: item.category, filterThread: item.filterThread ?? null, details: item.details ?? '' };
  }
  return {
    id: item.id, title: item.title, symbol: item.symbol, summary: item.summary ?? '',
    settings: (item.settings ?? []).map(r => ({ label: r.label, value: r.value })),
    gear: (item.gear ?? []).map(u => ({ gearID: u.gearID, role: u.role, note: u.note ?? '' })),
    steps: [...(item.steps ?? [])], tips: [...(item.tips ?? [])], warnings: [...(item.warnings ?? [])]
  };
}

function normalizeSeed(s, kind) {
  return seedValue(s, kind);
}

export function apply(item, s, kind) {
  if (kind === 'gear') {
    item.name = s.name;
    item.category = s.category;
    item.filterThread = s.filterThread ?? null;
    item.details = s.details ?? '';
    return;
  }
  item.title = s.title;
  item.symbol = s.symbol;
  item.summary = s.summary ?? '';
  item.settings = s.settings.map(r => ({ id: uid(), label: r.label, value: r.value }));
  item.gear = s.gear.map(u => ({ id: uid(), gearID: u.gearID, role: u.role, note: u.note ?? '' }));
  item.steps = [...s.steps];
  item.tips = [...s.tips];
  item.warnings = [...s.warnings];
}

function makeItem(s, kind, sortOrder) {
  const base = { id: s.id, isBuiltIn: true, isUserModified: false, isRemoved: false, bundledSnapshot: null, pendingUpdate: null };
  const item = kind === 'gear' ? base : { ...base, sortOrder };
  apply(item, s, kind);
  return item;
}

function merge(list, seeds, kind, { keep = () => false, nextOrder } = {}) {
  const byId = new Map(list.map(i => [i.id, i]));
  const ids = new Set(seeds.map(s => s.id));
  for (const raw of seeds) {
    const s = normalizeSeed(raw, kind);
    const item = byId.get(s.id);
    if (!item) {
      const created = makeItem(s, kind, nextOrder?.());
      created.bundledSnapshot = clone(s);
      list.push(created);
      byId.set(s.id, created);
      continue;
    }
    const previous = item.bundledSnapshot;
    item.isBuiltIn = true;
    if (item.isRemoved) {
      item.bundledSnapshot = clone(s);
    } else if (item.isUserModified) {
      if (!same(previous, s) && !same(seedValue(item, kind), s)) item.pendingUpdate = clone(s);
    } else {
      apply(item, s, kind);
      item.bundledSnapshot = clone(s);
      item.pendingUpdate = null;
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    if (!item.isBuiltIn || ids.has(item.id)) continue;
    if ((item.isUserModified && !item.isRemoved) || keep(item)) {
      item.isBuiltIn = false;
      item.isRemoved = false;
      item.bundledSnapshot = null;
      item.pendingUpdate = null;
    } else {
      list.splice(i, 1);
    }
  }
}

export function importSeed(state, seed, { hasCover = () => false } = {}) {
  if (!seed || !(seed.version > state.seedVersion)) return false;
  merge(state.gear, seed.gear ?? [], 'gear');
  let next = Math.max(-1, ...state.guides.map(g => g.sortOrder)) + 1;
  merge(state.guides, seed.guides ?? [], 'guide', {
    keep: g => hasCover(g.id) || notesFor(state, g.id).length > 0,
    nextOrder: () => next++
  });
  state.seedVersion = seed.version;
  return true;
}

export function markEdited(item) {
  item.isUserModified = true;
}

export function applyPending(item, kind) {
  if (!item.pendingUpdate) return;
  apply(item, item.pendingUpdate, kind);
  item.bundledSnapshot = item.pendingUpdate;
  item.pendingUpdate = null;
  item.isUserModified = false;
}

export function keepMine(item) {
  if (item.pendingUpdate) item.bundledSnapshot = item.pendingUpdate;
  item.pendingUpdate = null;
}

export function resetToDefault(item, kind) {
  const s = item.pendingUpdate ?? item.bundledSnapshot;
  if (!s) return;
  apply(item, s, kind);
  item.bundledSnapshot = clone(s);
  item.pendingUpdate = null;
  item.isUserModified = false;
}

export function editSession(item, kind) {
  const saved = {
    content: clone(item),
    isUserModified: item.isUserModified,
    bundledSnapshot: clone(item.bundledSnapshot),
    pendingUpdate: clone(item.pendingUpdate)
  };
  const original = seedValue(item, kind);
  return {
    cancel(target) {
      Object.assign(target, clone(saved.content));
      target.isUserModified = saved.isUserModified;
      target.bundledSnapshot = clone(saved.bundledSnapshot);
      target.pendingUpdate = clone(saved.pendingUpdate);
    },
    save(target) {
      if (target.isBuiltIn) {
        target.isUserModified = !same(seedValue(target, kind), target.bundledSnapshot);
      } else if (!same(seedValue(target, kind), original)) {
        target.isUserModified = true;
      }
    }
  };
}

export function restore(state, item, kind) {
  if (kind === 'guide') item.sortOrder = Math.max(-1, ...state.guides.map(g => g.sortOrder)) + 1;
  item.isRemoved = false;
  if (!item.isUserModified) resetToDefault(item, kind);
}

export function visibleGuides(state) {
  return state.guides.filter(g => !g.isRemoved).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function visibleGear(state) {
  return state.gear.filter(g => !g.isRemoved).sort((a, b) => a.name.localeCompare(b.name));
}

export function guidesUsing(state, gearID) {
  return visibleGuides(state).filter(g => g.gear.some(u => u.gearID === gearID));
}

export function deleteGear(state, item) {
  for (const g of state.guides) g.gear = g.gear.filter(u => u.gearID !== item.id);
  if (item.isBuiltIn) {
    item.isRemoved = true;
  } else {
    state.gear = state.gear.filter(x => x !== item);
  }
}

export function deleteGuide(state, guide) {
  if (guide.isBuiltIn) {
    guide.isRemoved = true;
    return null;
  }
  state.notes = state.notes.filter(n => n.guideID !== guide.id);
  state.guides = state.guides.filter(g => g !== guide);
  return guide.id;
}

export function notesFor(state, guideID) {
  return state.notes.filter(n => n.guideID === guideID).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addNote(state, text, guideID) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const now = new Date().toISOString();
  const n = { id: uid(), guideID, text: t, createdAt: now, updatedAt: now };
  state.notes.push(n);
  return n;
}

export function updateNote(note, text) {
  const t = String(text ?? '').trim();
  if (!t || t === note.text) return;
  note.text = t;
  note.updatedAt = new Date().toISOString();
}

export function deleteNote(state, note) {
  state.notes = state.notes.filter(n => n !== note);
}

export function reorder(state, orderedIDs) {
  orderedIDs.forEach((id, i) => {
    const g = state.guides.find(x => x.id === id);
    if (g) g.sortOrder = i;
  });
}

export function resolveGear(state, guide) {
  const byId = new Map(state.gear.filter(g => !g.isRemoved).map(g => [g.id, g]));
  return guide.gear.flatMap(u => (byId.has(u.gearID) ? [[u, byId.get(u.gearID)]] : []));
}

export function newGuide(state) {
  const g = {
    id: `user-${uid()}`, title: 'New photo type', symbol: 'camera', summary: '',
    sortOrder: Math.max(-1, ...state.guides.map(x => x.sortOrder)) + 1,
    settings: CORE_LABELS.map(label => ({ id: uid(), label, value: '' })),
    gear: [], steps: [], tips: [], warnings: [],
    isBuiltIn: false, isUserModified: false, isRemoved: false, bundledSnapshot: null, pendingUpdate: null
  };
  state.guides.push(g);
  return g;
}

export function newGear(state) {
  const g = { id: `user-${uid()}`, name: 'New item', category: 'accessory', filterThread: null, details: '', isBuiltIn: false, isUserModified: false, isRemoved: false, bundledSnapshot: null, pendingUpdate: null };
  state.gear.push(g);
  return g;
}

export function makeBackup(state, covers) {
  return { format: BACKUP_FORMAT, backupVersion: 1, exportedAt: new Date().toISOString(), state: clone(state), covers: { ...covers } };
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a WanglerShot backup.');
  }
  if (!data || data.format !== BACKUP_FORMAT) throw new Error('This file is not a WanglerShot backup.');
  const s = data.state;
  const ok = s && typeof s.seedVersion === 'number' && Array.isArray(s.guides) && Array.isArray(s.gear) && Array.isArray(s.notes)
    && s.guides.every(g => typeof g.id === 'string' && Array.isArray(g.settings) && Array.isArray(g.gear))
    && s.notes.every(n => typeof n.guideID === 'string' && typeof n.text === 'string');
  if (!ok) throw new Error('The backup file is damaged and was not imported.');
  const covers = data.covers && typeof data.covers === 'object' ? data.covers : {};
  return { state: s, covers: Object.fromEntries(Object.entries(covers).filter(([, v]) => typeof v === 'string' && v.startsWith('data:image/'))) };
}
