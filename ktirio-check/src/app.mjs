import { SOURCES, CATEGORIES, STATUSES, checksForMode } from './catalog.mjs';
import { STORAGE_KEY, createCase, makeDemo, itemState, getSummary, filterChecks, escapeHtml as h, exportBundle, importBundle, sanitizeCase } from './engine.mjs';

const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
  layers: '<rect width="15" height="15" x="4.5" y="4.5" rx="3"/><path d="M8 2h8M8 22h8"/>',
  checklist: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 1.5 1.5L12 8M14 9h3M8 16h9"/>',
  scale: '<path d="M12 3v18M6 7h12M3 11l3-4 3 4m-6 0a3 3 0 0 0 6 0m6 0 3-4 3 4m-6 0a3 3 0 0 0 6 0M7 21h10"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 6h1m4 0h1M9 10h1m4 0h1M9 14h1m4 0h1m-5 8v-4h6v4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',
  wrench: '<path d="M14.7 6.3a5 5 0 0 0-6.8 6.8L3 18l3 3 4.9-4.9a5 5 0 0 0 6.8-6.8l-3.4 3.4-3-3z"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18m-6 5h3"/>',
  alert: '<path d="M10.3 3.5 2.5 17A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  external: '<path d="M13 5h6v6m0-6-9 9"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 15h12v7H6z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 19h14"/>',
  upload: '<path d="M12 21V9m-5 5 5-5 5 5M5 5h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/>',
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
  moon: '<path d="M20 16.5A8.5 8.5 0 0 1 7.5 4a8.5 8.5 0 1 0 12.5 12.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9 6.3 6.3m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  filter: '<path d="M4 6h16M7 12h10m-7 6h4"/>'
};
const svg = (name, cls='') => `<svg class="icon ${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const app = document.getElementById('app');
const dialog = document.getElementById('new-case-dialog');
const reportDialog = document.getElementById('report-dialog');
const fileInput = document.getElementById('import-file');
const toastElement = document.getElementById('toast');
let toastTimeout;

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { const p=makeDemo(); return { cases: [p], activeId: p.id, category: 'all', status: 'all', query: '', expandedId: null, theme: localStorage.getItem('ktirio-check:theme') === 'dark' ? 'dark':'light' }; }
    const stored = JSON.parse(raw);
    if (stored?.schema !== 1 || !Array.isArray(stored.cases)) throw new Error('Invalid');
    const cases = stored.cases.slice(0, 100).map(data => {
      const p = sanitizeCase(data);
      if (typeof data.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(data.id)) p.id = data.id;
      p.demo = Boolean(data.demo);
      if (typeof data.createdAt === 'string') p.createdAt = data.createdAt;
      if (typeof data.updatedAt === 'string') p.updatedAt = data.updatedAt;
      return p;
    });
    const activeId = cases.some(c => c.id === stored.activeId) ? stored.activeId : cases[0]?.id || null;
    return { cases: cases.length ? cases : [makeDemo()], activeId, category: 'all', status: 'all', query: '', expandedId: null, theme: localStorage.getItem('ktirio-check:theme') === 'dark' ? 'dark':'light' };
  } catch {
    const p = makeDemo(); return {cases:[p], activeId:p.id, category:'all', status:'all', query:'', expandedId:null, theme:'light'};
  }
}
let state = restore();
const active = () => state.cases.find(c => c.id === state.activeId) || state.cases[0];
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({schema:1,cases:state.cases,activeId:state.activeId})); }
  catch { toast('Δεν ήταν δυνατή η αποθήκευση στον browser. Κάνε εξαγωγή JSON.'); }
}
function toast(message) {
  clearTimeout(toastTimeout);
  toastElement.textContent = message;
  toastElement.classList.add('visible');
  toastTimeout = setTimeout(() => toastElement.classList.remove('visible'), 3900);
}
function dateShort(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('el-GR', {day:'2-digit',month:'short',year:'numeric'}).format(d);
}
function mark(property, id, status, note, documentReceived) {
  if (!checksForMode(property.mode).some(check=>check.id===id)) return;
  const previous = itemState(property, id);
  property.items[id] = { status: status ?? previous.status, note: note ?? previous.note, documentReceived: documentReceived ?? previous.documentReceived, updatedAt: new Date().toISOString() };
  property.updatedAt = new Date().toISOString();
  // A sample dossier stays visibly marked DEMO even if edited.
  save();
}
function statusName(id) { return STATUSES.find(s=>s.id===id)?.name || 'Εκκρεμεί'; }
function categoryLabel(id) { return CATEGORIES.find(c=>c.id===id)?.label || 'Άλλο'; }

function render() {
  document.documentElement.dataset.theme = state.theme;
  const p = active();
  if (!p) return;
  const summary = getSummary(p);
  const modeName = p.mode === 'buy' ? 'Αγορά' : 'Ενοικίαση';
  const casesHtml = state.cases.map(c => {
    const s = getSummary(c);
    return `<button type="button" class="property-item ${c.id === p.id ? 'selected' : ''}" data-case-id="${h(c.id)}" aria-current="${c.id === p.id ? 'page' : 'false'}"><span class="property-emblem">${svg('home')}</span><span class="property-details"><strong>${h(c.name)}</strong><small>${c.mode==='buy'?'Αγορά':'Ενοικίαση'} ${c.area ? '· '+h(c.area):''}</small></span><span class="property-percent">${s.percent}%</span></button>`;
  }).join('');
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#top" aria-label="KtirioCheck - Αρχική"><span class="brand-icon">${svg('home')}</span><span><span class="brand-title">ktirio<span>check.</span></span><span class="brand-sub">PROPERTY DUE DILIGENCE</span></span></a>
        <div class="nav-caption">ΕΦΑΡΜΟΓΗ</div>
        <a class="nav-link active" href="#top">${svg('layers')} <span>Επισκόπηση</span></a>
        <a class="nav-link" href="#checklist">${svg('checklist')} <span>Λίστα ελέγχου</span></a>
        <a class="nav-link" href="#resources">${svg('file')} <span>Επίσημες πηγές</span></a>
        <div class="sidebar-rule"></div>
        <div class="sidebar-head"><span>ΟΙ ΦΑΚΕΛΟΙ ΜΟΥ</span><button class="plain-icon" type="button" data-action="new" aria-label="Προσθήκη φακέλου">${svg('plus')}</button></div>
        <div class="properties">${casesHtml}</div>
        <button type="button" class="add-property" data-action="new">${svg('plus')} Προσθήκη ακινήτου</button>
        <div class="sidebar-bottom"><div class="privacy-icon">${svg('lock')}</div><strong>Privacy by design</strong><p>Τα δεδομένα μένουν σε αυτόν τον browser. Δεν γίνεται αποστολή σε server.</p><button class="sidebar-theme" type="button" data-action="theme">${svg(state.theme === 'dark' ? 'sun':'moon')} ${state.theme === 'dark' ? 'Φωτεινή':'Σκοτεινή'} εμφάνιση</button></div>
      </aside>
      <div class="content-area" id="top">
        <header class="topbar"><div class="mobile-brand"><span class="mobile-brand-icon">${svg('home')}</span> ktirio<span>check.</span></div><div class="breadcrumbs">Workspace <span>/</span> Επισκόπηση <span>/</span> <b>${h(p.name)}</b></div><div class="topbar-actions"><span class="online-tag"><span></span> Local workspace</span><button type="button" class="top-icon" data-action="theme" title="Εναλλαγή θέματος" aria-label="Εναλλαγή θέματος">${svg(state.theme === 'dark' ? 'sun':'moon')}</button><button type="button" class="top-icon mobile-only" data-action="sidebar" title="Μενού" aria-label="Άνοιγμα μενού">${svg('menu')}</button></div></header>
        <main class="dashboard">
          <div class="page-intro"><div><div class="eyebrow"><span class="tiny-square"></span> DASHBOARD <span class="eyebrow-separator">/</span> GREECE</div><h1>Ο έλεγχος πριν<br><span>από την απόφαση.</span></h1><p>Οργάνωσε τους απαραίτητους ελέγχους, εντόπισε εκκρεμότητες και προχώρησε με μεγαλύτερη σαφήνεια.</p></div><button type="button" class="btn outline new-cta" data-action="new">${svg('plus')} Νέος φάκελος</button></div>
          <section class="case-panel" aria-label="Σύνοψη φακέλου"><div class="case-head"><div class="case-icon">${svg('building')}</div><div><div class="case-kicker">ΕΝΕΡΓΟΣ ΦΑΚΕΛΟΣ ${p.demo ? '<span class="demo-badge">DEMO</span>' : ''}</div><h2>${h(p.name)}</h2><div class="case-meta"><span>${svg('home')} ${modeName} ακινήτου</span><span class="dot-sep">•</span><span>${h(p.area || 'Χωρίς περιοχή')}</span><span class="dot-sep">•</span><span>Ενημ. ${dateShort(p.updatedAt)}</span></div><div class="doc-track">${svg('file')} Έγγραφα που δηλώθηκαν ως παραληφθέντα: ${summary.docsReceived}/${summary.docsTotal}</div></div></div><div class="case-panel-actions"><button class="btn light" type="button" data-action="report">${svg('printer')} Αναφορά</button><button class="btn white-outline" type="button" data-action="export">${svg('download')} Εξαγωγή</button></div><div class="case-panel-decoration"></div></section>
          <section class="metrics" aria-label="Σύνοψη προόδου"><div class="metric"><span class="metric-label">ΠΡΟΟΔΟΣ ΦΑΚΕΛΟΥ ${svg('check')}</span><div class="metric-main">${summary.percent}<span>%</span></div><div class="progress"><div class="progress-fill" data-progress="${summary.percent}"></div></div><div class="metric-help">${summary.resolved} από ${summary.total} σημεία καταχωρίστηκαν ως ελεγμένα ή μη εφαρμόσιμα</div></div><div class="metric"><span class="metric-label">ΣΗΜΕΙΑ ΠΡΟΣ ΔΙΕΡΕΥΝΗΣΗ ${svg('alert')}</span><div class="metric-main ${summary.concerns.length ? 'attention-text':''}">${summary.concerns.length.toString().padStart(2,'0')}</div><div class="metric-help">Καταχωρισμένες επισημάνσεις που χρειάζονται διερεύνηση</div></div><div class="metric"><span class="metric-label">ΑΝΟΙΧΤΟΙ ΕΛΕΓΧΟΙ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ ${svg('clock')}</span><div class="metric-main">${summary.urgent.length.toString().padStart(2,'0')}</div><div class="metric-help">Σημεία υψηλής ή κρίσιμης προτεραιότητας που δεν έχουν κλείσει</div></div></section>
          <div class="work-grid"><section id="checklist" class="checks-column"><div class="section-heading"><div><div class="eyebrow small">STEP BY STEP</div><h2>Λίστα ελέγχου <span class="section-count">${summary.total}</span></h2><p>Κάθε σημείο καταχωρίζεται από εσένα. Δεν εκτελείται αυτόματος έλεγχος εγκυρότητας.</p></div><button type="button" class="btn subtle" data-action="import">${svg('upload')} Εισαγωγή JSON</button></div>
            <div class="filters"><div class="search-box">${svg('search')}<input id="query" type="search" aria-label="Αναζήτηση ελέγχων" placeholder="Αναζήτηση σε ελέγχους..." value="${h(state.query)}"></div><label class="select-wrap">${svg('filter')}<select id="status-filter" aria-label="Φίλτρο κατάστασης"><option value="all">Όλες οι καταστάσεις</option>${STATUSES.map(s=>`<option value="${s.id}" ${state.status===s.id?'selected':''}>${s.name}</option>`).join('')}</select>${svg('down')}</label></div>
            <div class="category-tabs" id="category-tabs"><button data-category="all" class="category-tab ${state.category==='all'?'selected':''}" type="button">Όλα <span>${summary.total}</span></button>${CATEGORIES.map(c=>`<button data-category="${c.id}" class="category-tab ${state.category===c.id?'selected':''}" type="button">${h(c.label)}</button>`).join('')}</div>
            <div id="checks-list" class="checks-list"></div>
            <div class="checks-footer">${svg('info')} Οι επισημάνσεις δεν αποτελούν νομική γνωμάτευση ή τεχνική πιστοποίηση.</div>
          </section>
          <aside class="context-column"><section class="next-panel"><div class="aside-title">${svg('alert')} ΤΙ ΧΡΕΙΑΖΕΤΑΙ ΠΡΟΣΟΧΗ</div><h3>${summary.concerns.length ? 'Σημεία για διερεύνηση' : 'Πρώτα οι κρίσιμοι έλεγχοι'}</h3><p>${summary.concerns.length ? 'Έχεις επισημάνει ζητήματα στον φάκελο. Μην τα αφήσεις χωρίς αξιολόγηση από κατάλληλο επαγγελματία.' : 'Από τους σημαντικότερους ελέγχους που παραμένουν ανοιχτοί στον φάκελό σου.'}</p>${renderAttention(p,summary)}<button class="simple-link" type="button" data-action="report">Δες τη συνολική αναφορά ${svg('arrow')}</button></section>
            <section class="professionals-panel"><div class="professional-icon">${svg('shield')}</div><h3>Ο σωστός έλεγχος θέλει ειδικούς.</h3><p>Ο δικηγόρος εξετάζει τίτλους και βάρη. Ο μηχανικός τη νομιμότητα και την τεχνική κατάσταση. Ο συμβολαιογράφος συντονίζει τη μεταβίβαση.</p><span class="help-chip">Δεν αντικαθιστά επαγγελματική συμβουλή</span></section>
            <section class="resources-panel" id="resources"><div class="aside-title">${svg('external')} ΕΠΙΣΗΜΕΣ ΠΗΓΕΣ</div><p>Σύνδεσμοι προς αρμόδιους φορείς, χωρίς πρόσβαση στα προσωπικά σου δεδομένα.</p><div class="source-links">${['cadastreCopy','buildingIdentity','energy','enfia','lease','propertyTransfer'].map(k=>`<a href="${SOURCES[k].url}" target="_blank" rel="noopener noreferrer">${h(SOURCES[k].name)} ${svg('external')}</a>`).join('')}</div><span class="source-updated">Πηγές ελέγχθηκαν: 15/10/2026</span></section>
            <section class="data-panel"><div>${svg('lock')} <strong>Τοπική αποθήκευση</strong></div><p>Δεν αποθηκεύονται αρχεία PDF/τίτλοι. Για αντίγραφο ασφαλείας κάνε εξαγωγή JSON και φύλαξέ το με ασφάλεια.</p><button class="simple-link" type="button" data-action="export">Λήψη αντιγράφου ${svg('download')}</button><button class="delete-link" type="button" data-action="delete">${svg('trash')} Διαγραφή αυτού του φακέλου</button></section>
          </aside></div>
          <footer class="footer"><span>© 2026 KtirioCheck · Open-source MVP</span><span>Made for better questions, not automatic approvals. <span class="footer-dot">✳</span></span></footer>
        </main>
      </div>
    </div>`;
  // Progress fill is intentionally assigned through CSSOM, not an unsafe inline style.
  const fill = app.querySelector('.progress-fill');
  if (fill) fill.style.width = `${summary.percent}%`;
  renderList();
}

function renderAttention(property, summary) {
  const targets = summary.concerns.length ? summary.concerns : summary.urgent;
  if (!targets.length) return '<div class="all-clear">'+svg('check')+' Δεν υπάρχουν ανοιχτοί έλεγχοι υψηλής προτεραιότητας στις καταχωρίσεις σου. Αυτό δεν πιστοποιεί την ασφάλεια της συναλλαγής.</div>';
  return `<div class="attention-list">${targets.slice(0,4).map((c,i)=>`<button type="button" data-focus-check="${h(c.id)}" class="attention-row"><span class="priority-number">${String(i+1).padStart(2,'0')}</span><span><strong>${h(c.title)}</strong><small>${h(c.role)}</small></span>${svg('arrow')}</button>`).join('')}</div>`;
}
function renderList() {
  const holder = document.getElementById('checks-list');
  if (!holder) return;
  const p = active();
  const rows = filterChecks(p, state);
  if (!rows.length) { holder.innerHTML = `<div class="empty-state">${svg('search')}<h3>Δεν βρέθηκαν έλεγχοι</h3><p>Δοκίμασε άλλο φίλτρο ή διαφορετική αναζήτηση.</p><button type="button" class="btn ghost" data-action="clear-filters">Καθαρισμός φίλτρων</button></div>`; return; }
  holder.innerHTML = rows.map((check, index)=>{
    const record = itemState(p, check.id);
    const open = state.expandedId===check.id;
    const priority = check.priority==='critical' ? '<span class="tag tag-critical">Κρίσιμο</span>' : check.priority==='high' ? '<span class="tag tag-high">Υψηλή προτεραιότητα</span>' : '';
    const source = check.source ? SOURCES[check.source] : null;
    return `<article class="check-card ${record.status==='issue'?'check-issue':''} ${open?'expanded':''}" id="check-${check.id}"><div class="check-top"><span class="check-number">${String(checksForMode(p.mode).findIndex(c=>c.id===check.id)+1).padStart(2,'0')}</span><div class="check-text"><div class="check-tags"><span class="category-small">${h(categoryLabel(check.category))}</span>${priority}${record.documentReceived ? '<span class="tag tag-document">Έγγραφο παραλήφθηκε</span>' : ''}</div><h3>${h(check.title)}</h3><p>${h(check.description)}</p><span class="role">${svg('shield')} ${h(check.role)}</span></div><div class="check-controls"><label class="sr-only" for="status-${check.id}">Κατάσταση: ${h(check.title)}</label><select id="status-${check.id}" class="status-select status-${record.status}" data-status-id="${h(check.id)}">${STATUSES.map(s=>`<option value="${s.id}" ${record.status===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select><button class="expand-button" data-expand-id="${h(check.id)}" aria-label="${open?'Κλείσιμο':'Λεπτομέρειες'} για ${h(check.title)}" aria-expanded="${open}" type="button">${svg(open?'up':'down')}</button></div></div>${open ? `<div class="check-details"><div class="detail-tip"><strong>${svg('info')} Τι να προσέξεις</strong><p>${h(check.tip)}</p></div>${check.document ? `<label class="document-received"><input type="checkbox" data-document-id="${h(check.id)}" ${record.documentReceived ? 'checked':''}><span>${svg('file')} Παρέλαβα το σχετικό έγγραφο <small>(καταγραφή μόνο — χωρίς αποθήκευση αρχείου)</small></span></label>` : ''}<label for="note-${check.id}">Σημειώσεις / εκκρεμότητες</label><textarea id="note-${check.id}" maxlength="1200" rows="3" data-note-id="${h(check.id)}" placeholder="Σημείωσε τι εκκρεμεί ή τι ανέφερε ο ειδικός...">${h(record.note)}</textarea><div class="detail-bottom"><span>Οι αλλαγές αποθηκεύονται στον browser.</span>${source ? `<a href="${source.url}" target="_blank" rel="noopener noreferrer">Επίσημη πηγή ${svg('external')}</a>` : ''}</div></div>` : ''}</article>`;
  }).join('');
}
function openReport() {
  const p = active();
  const s = getSummary(p);
  const date = new Intl.DateTimeFormat('el-GR', {dateStyle:'long'}).format(new Date());
  const groups = CATEGORIES.map(category=>{
    const checks = checksForMode(p.mode).filter(c=>c.category===category.id);
    if (!checks.length) return '';
    return `<section class="print-group"><h3>${h(category.label)}</h3><table><thead><tr><th>Σημείο</th><th>Κατάσταση</th><th>Ρόλος</th></tr></thead><tbody>${checks.map(c=>{
      const st = itemState(p,c.id);
      return `<tr><td><strong>${h(c.title)}</strong>${st.note?`<div class="print-note">${h(st.note)}</div>`:''}</td><td>${h(statusName(st.status))}</td><td>${h(c.role)}</td></tr>`;
    }).join('')}</tbody></table></section>`;
  }).join('');
  document.getElementById('report-body').innerHTML = `<div class="print-header"><div class="print-brand">⌂ <strong>ktirio<span>check.</span></strong></div><span>ΣΥΝΟΠΤΙΚΗ ΑΝΑΦΟΡΑ ΠΡΟΕΛΕΓΧΟΥ</span></div><div class="report-hero"><div class="eyebrow small">ΦΑΚΕΛΟΣ ΑΚΙΝΗΤΟΥ</div><h1 id="report-title">${h(p.name)}</h1><p>${h(p.area || 'Μη καταχωρισμένη περιοχή')} · ${p.mode==='buy'?'Αγορά':'Ενοικίαση'} · ${date}</p>${p.demo?'<p><strong>DEMO — τα δεδομένα του φακέλου είναι ενδεικτικά.</strong></p>':''}</div><div class="report-stats"><span><strong>${s.resolved} / ${s.total}</strong> καταχωρίσεις κλειστές</span><span><strong>${s.concerns.length}</strong> σημεία διερεύνησης</span><span><strong>${s.urgent.length}</strong> ανοικτά προτεραιότητας</span><span><strong>${s.docsReceived}/${s.docsTotal}</strong> έγγραφα που δηλώθηκαν παραληφθέντα</span></div><p class="report-warning"><strong>Σημαντικό:</strong> Πρόκειται για αυτοκαταγραφή ελέγχων, όχι πιστοποιητικό, αξιολόγηση νομικής ασφάλειας, επαλήθευση εγγράφων ή έγκριση συναλλαγής. Η ένδειξη «Ελέγχθηκε» δηλώνεται από τον χρήστη και δεν επαληθεύεται από την εφαρμογή.</p>${groups}<div class="print-end"><strong>Απαραίτητη επαγγελματική αξιολόγηση</strong><p>Ζήτησε από ανεξάρτητο δικηγόρο, μηχανικό ή/και συμβολαιογράφο να επιβεβαιώσει τους ελέγχους που εφαρμόζονται στη δική σου περίπτωση. Οι κατάλογοι είναι ενδεικτικοί, όχι εξαντλητικοί.</p><small>KtirioCheck v0.1.0 · Έκθεση που δημιουργήθηκε τοπικά · ${date}</small></div>`;
  reportDialog.showModal();
}
function downloadJSON() {
  const p = active();
  const json = exportBundle(p);
  const blob = new Blob([json], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`ktirio-check-${p.mode}-${new Date().toISOString().slice(0,10)}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Έγινε εξαγωγή JSON. Φύλαξε το αρχείο με ασφάλεια.');
}
function onAction(action) {
  if (action==='new') { document.getElementById('new-case-form').reset(); dialog.showModal(); document.getElementById('case-name').focus(); }
  if (action==='export') downloadJSON();
  if (action==='import') fileInput.click();
  if (action==='report') openReport();
  if (action==='print') window.print();
  if (action==='theme') { state.theme=state.theme==='dark'?'light':'dark'; try{localStorage.setItem('ktirio-check:theme',state.theme);}catch{} render(); }
  if (action==='clear-filters') {state.category='all';state.status='all';state.query='';render();}
  if (action==='sidebar') document.getElementById('sidebar')?.classList.toggle('sidebar-open');
  if (action==='delete') {
    const p=active();
    if (!confirm(`Να διαγραφεί ο φάκελος «${p.name}» από αυτόν τον browser; Η ενέργεια δεν αναιρείται.`)) return;
    state.cases = state.cases.filter(c=>c.id!==p.id);
    if (!state.cases.length) { const demo=makeDemo();state.cases=[demo]; }
    state.activeId=state.cases[0].id;
    state.category='all';state.status='all';state.query='';state.expandedId=null;
    save(); render(); toast('Ο φάκελος διαγράφηκε τοπικά.');
  }
}
app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  // Prevent document-level dialog handler from acting on a detached button after render().
  event.stopPropagation();
  if (button.dataset.action) {onAction(button.dataset.action);return;}
  if (button.dataset.caseId) {
    state.activeId=button.dataset.caseId;state.category='all';state.status='all';state.query='';state.expandedId=null;save();render();return;
  }
  if (button.dataset.category) {state.category=button.dataset.category;render();return;}
  if (button.dataset.expandId) {state.expandedId=state.expandedId===button.dataset.expandId?null:button.dataset.expandId;renderList();return;}
  if (button.dataset.focusCheck) {
    const selected=checksForMode(active().mode).find(c=>c.id===button.dataset.focusCheck);
    if (!selected) return;
    state.category='all';state.status='all';state.query='';state.expandedId=selected.id;render();
    document.getElementById('check-'+selected.id)?.scrollIntoView({behavior:'smooth',block:'center'});
  }
});
app.addEventListener('change', event => {
  const target=event.target;
  if (target.id==='status-filter') {state.status=target.value;renderList();return;}
  if (target.dataset.statusId) {mark(active(),target.dataset.statusId,target.value);render();return;}
  if (target.dataset.documentId) {mark(active(),target.dataset.documentId,null,null,target.checked);render();return;}
  if (target.dataset.noteId) {mark(active(),target.dataset.noteId,null,target.value.slice(0,1200));render();}
});
app.addEventListener('input', event => {
  if (event.target.id==='query') {state.query=event.target.value;renderList();}
});
document.addEventListener('click', event => {
  const closeButton=event.target.closest('[data-close-dialog]');
  if (closeButton) document.getElementById(closeButton.dataset.closeDialog)?.close();
  const actionButton=event.target.closest('[data-action]');
  if (actionButton && !app.contains(actionButton)) onAction(actionButton.dataset.action);
});
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
reportDialog.addEventListener('click',e=>{if(e.target===reportDialog)reportDialog.close();});
document.getElementById('new-case-form').addEventListener('submit',e=>{
  e.preventDefault();
  const data=new FormData(e.currentTarget);
  const name=String(data.get('name')||'').trim();
  if (!name) {toast('Συμπλήρωσε το όνομα φακέλου.');return;}
  const property=createCase(name,String(data.get('area')||''),String(data.get('mode')||'buy'));
  state.cases.unshift(property);state.activeId=property.id;state.category='all';state.status='all';state.query='';state.expandedId=null;
  save();dialog.close();render();toast('Ο νέος φάκελος δημιουργήθηκε.');
});
fileInput.addEventListener('change',async e=>{
  const file=e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size>2_000_000) throw new Error('Το αρχείο είναι πολύ μεγάλο (έως 2 MB).');
    const imported=importBundle(await file.text());
    state.cases.unshift(imported);state.activeId=imported.id;state.category='all';state.status='all';state.query='';state.expandedId=null;
    save();render();toast('Ο φάκελος εισήχθη με επιτυχία.');
  } catch(err) {toast(err instanceof Error?err.message:'Αποτυχία εισαγωγής.');}
  finally {e.target.value='';}
});
render();
