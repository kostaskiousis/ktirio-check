import { CHECKS, checksForMode } from './catalog.mjs';

export const STORAGE_KEY = 'ktirio-check:v1';
export const VALID_STATUSES = ['todo', 'requested', 'checked', 'issue', 'na'];
export const VALID_MODES = ['buy', 'rent'];

export function makeId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createCase(name, area, mode = 'buy', demo = false) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    name: String(name || 'Νέο ακίνητο').trim().slice(0, 100),
    area: String(area || '').trim().slice(0, 100),
    mode: VALID_MODES.includes(mode) ? mode : 'buy',
    demo: Boolean(demo),
    createdAt: now,
    updatedAt: now,
    items: {}
  };
}

export function makeDemo() {
  const example = createCase('Διαμέρισμα · Παράδειγμα', 'Αθήνα', 'buy', true);
  example.items = {
    'title-deed': { status: 'requested', note: 'Αναμονή αντιγράφων από τον πωλητή.', updatedAt: example.updatedAt },
    'cadastre-record': { status: 'checked', note: 'Ενδεικτική καταχώριση demo — όχι πραγματικός έλεγχος.', updatedAt: example.updatedAt },
    encumbrances: { status: 'issue', note: 'Ενδεικτικό ζήτημα demo για συζήτηση με δικηγόρο.', updatedAt: example.updatedAt },
    energy: { status: 'checked', note: '', updatedAt: example.updatedAt }
  };
  return example;
}

export function itemState(property, id) {
  const item = property?.items?.[id] || {};
  return {
    status: VALID_STATUSES.includes(item.status) ? item.status : 'todo',
    note: typeof item.note === 'string' ? item.note : '',
    documentReceived: item.documentReceived === true
  };
}

export function getSummary(property) {
  const all = checksForMode(property.mode);
  const counts = Object.fromEntries(VALID_STATUSES.map(s => [s, 0]));
  const concerns = [];
  const urgent = [];
  let docsTotal = 0;
  let docsReceived = 0;
  for (const check of all) {
    const state = itemState(property, check.id);
    counts[state.status]++;
    if (check.document) {docsTotal++; if (state.documentReceived) docsReceived++;}
    if (state.status === 'issue') concerns.push(check);
    if ((check.priority === 'critical' || check.priority === 'high') && state.status !== 'checked' && state.status !== 'na') urgent.push(check);
  }
  const resolved = counts.checked + counts.na;
  return {
    total: all.length,
    resolved,
    percent: all.length ? Math.round(resolved * 100 / all.length) : 0,
    counts,
    concerns,
    urgent,
    outstanding: all.length - resolved,
    docsTotal, docsReceived,
    hasCriticalIssues: concerns.some(item => item.priority === 'critical')
  };
}

export function filterChecks(property, options = {}) {
  const q = (options.query || '').trim().toLocaleLowerCase('el-GR');
  return checksForMode(property.mode).filter(item => {
    if (options.category && options.category !== 'all' && item.category !== options.category) return false;
    if (options.status && options.status !== 'all' && itemState(property, item.id).status !== options.status) return false;
    return !q || [item.title, item.description, item.role, item.tip].some(text => String(text).toLocaleLowerCase('el-GR').includes(q));
  });
}

function cleanText(text, max = 1200) {
  return typeof text === 'string' ? text.slice(0, max) : '';
}

export function sanitizeCase(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Μη έγκυρα δεδομένα ακινήτου.');
  if (!VALID_MODES.includes(data.mode)) throw new Error('Μη έγκυρος τύπος ελέγχου.');
  const property = createCase(cleanText(data.name, 100) || 'Εισαγόμενο ακίνητο', cleanText(data.area, 100), data.mode, false);
  const validIds = new Set(CHECKS.filter(c => c.modes.includes(data.mode)).map(c => c.id));
  if (data.items && typeof data.items === 'object' && !Array.isArray(data.items)) {
    for (const [id, row] of Object.entries(data.items)) {
      if (!validIds.has(id) || !row || typeof row !== 'object' || Array.isArray(row)) continue;
      const status = VALID_STATUSES.includes(row.status) ? row.status : 'todo';
      property.items[id] = { status, note: cleanText(row.note), documentReceived: row.documentReceived === true, updatedAt: property.updatedAt };
    }
  }
  return property;
}

export function loadStore(raw) {
  try {
    const data = JSON.parse(raw);
    if (data?.schema !== 1 || !Array.isArray(data.cases)) throw new Error('schema');
    const cases = data.cases.slice(0, 100).map(sanitizeCase);
    const current = cases.find(c => c.name === data.activeName && c.area === data.activeArea) || cases[0];
    return { cases, activeId: current?.id ?? null };
  } catch {
    return { cases: [makeDemo()], activeId: null };
  }
}

export function exportBundle(property) {
  const { id: _id, ...rest } = property;
  return JSON.stringify({ app: 'KtirioCheck', schema: 1, exportedAt: new Date().toISOString(), property: rest }, null, 2);
}

export function importBundle(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Το αρχείο δεν είναι έγκυρο JSON.'); }
  if (data?.app !== 'KtirioCheck' || data.schema !== 1 || !data.property) throw new Error('Το αρχείο δεν είναι συμβατό με το KtirioCheck.');
  return sanitizeCase(data.property);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
