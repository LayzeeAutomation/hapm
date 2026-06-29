/**
 * HAPM Pocket Money Panel Card  v0.1.23
 *
 * Changes vs 0.1.22:
 *   - category is now a first-class field on the Chore model (no more getattr hack)
 *   - sensor now exposes complete_chores attribute (non-due, non-paused chores)
 *   - New "All" nav tab shows every chore for the active child with edit + pause actions
 *     so you can manage chores at any time, not just when they're due
 *   - Weekly chores now calendar-align to Monday; monthly to the 1st
 *   - Missed recurring chores silently roll forward instead of stacking
 */

const HAPM_VERSION = '0.1.23';
const CURRENCY_DEFAULT = '\u00a3';
const OPTIMISTIC_TTL_MS = 15000;

const COLOUR_MAP = {
  teal: '#01696f', blue: '#5591c7', purple: '#7c63d1',
  orange: '#fdab43', gold: '#e8af34', green: '#6daa45',
  red: '#db4437', pink: '#e8619a', grey: '#9e9e9e',
};

const CHORE_CATEGORIES = {
  bedroom:   { emoji: '\ud83d\udecf\ufe0f', label: 'Bedroom' },
  kitchen:   { emoji: '\ud83c\udf7d\ufe0f', label: 'Kitchen' },
  bathroom:  { emoji: '\ud83d\udebf',       label: 'Bathroom' },
  tidying:   { emoji: '\ud83e\uddf9',       label: 'Tidying' },
  laundry:   { emoji: '\ud83e\uddfa',       label: 'Laundry' },
  garden:    { emoji: '\ud83c\udf3f',       label: 'Garden' },
  pet:       { emoji: '\ud83d\udc3e',       label: 'Pet Care' },
  homework:  { emoji: '\ud83d\udcda',       label: 'Homework' },
  recycling: { emoji: '\ud83d\uddd1\ufe0f', label: 'Recycling' },
  cooking:   { emoji: '\ud83d\udc68\u200d\ud83c\udf73', label: 'Cooking' },
  shopping:  { emoji: '\ud83d\udecd\ufe0f', label: 'Shopping' },
  exercise:  { emoji: '\ud83c\udfcb\ufe0f', label: 'Exercise' },
  reading:   { emoji: '\ud83d\udcd6',       label: 'Reading' },
  car:       { emoji: '\ud83d\ude97',       label: 'Car' },
  tech:      { emoji: '\ud83d\udcbb',       label: 'Tech / Screens' },
  other:     { emoji: '\u2b50',             label: 'Other' },
};
const CATEGORY_KEYS = Object.keys(CHORE_CATEGORIES);
const DEFAULT_CATEGORY = 'tidying';

const LEGACY_ICONS = ['\ud83e\uddf9','\ud83d\udecf\ufe0f','\ud83c\udf7d\ufe0f','\ud83d\udc36','\ud83c\udf3f','\ud83e\uddfa','\ud83d\udebf','\ud83d\udcda','\ud83d\uddd1\ufe0f','\ud83e\uddfd'];
function choreIcon(c) {
  if (c.category && CHORE_CATEGORIES[c.category]) return CHORE_CATEGORIES[c.category].emoji;
  return LEGACY_ICONS[Math.abs((c.id||c.name||'').charCodeAt(0)||0) % LEGACY_ICONS.length];
}

const LEDGER_META = {
  chore_completed:   { icon: '\u2705', label: 'Chore completed',   colour: '#6daa45' },
  occurrence_logged: { icon: '\ud83d\udfe3', label: 'Occurrence logged', colour: '#7c63d1' },
  payment_made:      { icon: '\ud83d\udcb8', label: 'Paid out',         colour: '#db4437' },
};
function ledgerMeta(t) { return LEDGER_META[t] || { icon: '\u2b50', label: t, colour: '#9e9e9e' }; }

function fmtMoney(v, sym = CURRENCY_DEFAULT) { return sym + Math.abs(v).toFixed(2); }
function fmtMoneyRaw(v, sym = CURRENCY_DEFAULT) {
  return (v >= 0 ? '+' : '-') + sym + Math.abs(v).toFixed(2);
}
function fmtDate(iso) {
  const d = new Date(iso), now = new Date(), diff = now - d;
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  if (diff < 604800000)
    return d.toLocaleDateString('en-GB',{weekday:'short'}) + ' ' +
           d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function fmtNextDue(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  if (d <= now) return 'Due now';
  const diff = d - now;
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Tomorrow';
  return 'Due ' + d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function daysRemaining(isoUntil) {
  return Math.max(0, Math.ceil((new Date(isoUntil)-new Date())/86400000));
}
function isIndefinitePause(isoUntil) {
  return isoUntil && new Date(isoUntil).getFullYear() >= 9999;
}
function fmtPausedUntil(isoUntil) {
  if (!isoUntil) return '';
  if (isIndefinitePause(isoUntil)) return 'Indefinite';
  return 'Until ' + new Date(isoUntil).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}
function getDesc(c) { return (c.description && c.description.trim()) ? c.description.trim() : ''; }

function categoryOptionsHTML(selected = DEFAULT_CATEGORY) {
  return CATEGORY_KEYS.map(k => {
    const {emoji,label} = CHORE_CATEGORIES[k];
    return `<option value="${k}"${k===selected?' selected':''}>${emoji} ${label}</option>`;
  }).join('');
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  :host { display: block; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .hapm { font-family: var(--primary-font-family, 'DM Sans', sans-serif);
    font-size: 14px; color: var(--primary-text-color);
    background: var(--ha-card-background, var(--card-background-color));
    border-radius: var(--ha-card-border-radius, 12px); }

  .topbar { display:flex; align-items:center; justify-content:space-between;
    padding:12px 16px; border-bottom:1px solid var(--divider-color); }
  .topbar-title { font-weight:700; font-size:15px; display:flex; align-items:center; gap:8px; }
  .btn-holiday { display:flex; align-items:center; gap:6px; padding:6px 12px;
    border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:none;
    font-family:inherit; background:rgba(232,175,52,0.15); color:#c9920a; transition:all 150ms; }
  .btn-holiday.active { background:#c9920a; color:#fff; }

  .child-tabs { display:flex; gap:8px; flex-wrap:wrap; padding:16px 16px 0; }
  .child-tab { display:flex; align-items:center; gap:6px; padding:6px 14px;
    border-radius:9999px; border:1.5px solid var(--divider-color); cursor:pointer;
    font-size:13px; font-weight:500; background:none; color:var(--primary-text-color);
    font-family:inherit; transition:all 150ms; }
  .child-tab:hover { border-color:var(--primary-color); color:var(--primary-color); }
  .child-tab.active { background:var(--primary-color); border-color:var(--primary-color); color:#fff; }
  .dot { width:9px; height:9px; border-radius:9999px; flex-shrink:0; }

  .kpi-row { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr));
    gap:12px; padding:14px 16px; }
  .kpi { background:var(--secondary-background-color); border-radius:10px; padding:12px 14px; }
  .kpi-label { font-size:11px; font-weight:600; text-transform:uppercase;
    letter-spacing:0.06em; color:var(--secondary-text-color); margin-bottom:4px; }
  .kpi-value { font-size:22px; font-weight:700; line-height:1; font-variant-numeric:tabular-nums; }
  .kpi-value.positive { color:var(--success-color,#6daa45); }
  .kpi-sub { font-size:11px; color:var(--secondary-text-color); margin-top:3px; }

  .nav { display:flex; gap:4px; padding:0 16px; border-bottom:1px solid var(--divider-color); }
  .nav-btn { padding:10px 14px; font-size:13px; font-weight:500; background:none; border:none;
    border-bottom:2px solid transparent; color:var(--secondary-text-color); cursor:pointer;
    font-family:inherit; transition:all 150ms; margin-bottom:-1px; }
  .nav-btn:hover { color:var(--primary-text-color); }
  .nav-btn.active { color:var(--primary-color); border-bottom-color:var(--primary-color); }
  .badge { display:inline-flex; align-items:center; justify-content:center;
    background:var(--primary-color); color:#fff; border-radius:9999px;
    font-size:10px; font-weight:700; padding:1px 6px; margin-left:4px; }
  .badge-warn { background:#c9920a; }

  .panel { padding:14px 16px; }
  .chore-card { background:var(--secondary-background-color); border-radius:10px;
    padding:12px 14px; margin-bottom:10px; display:grid;
    grid-template-columns:1fr auto; gap:8px; align-items:start; transition:opacity 300ms; }
  .chore-card.completing { opacity:0.35; pointer-events:none; }
  .chore-card.optimistic { opacity:0.6; }
  .chore-card.paused-card { border-left:3px solid #c9920a; opacity:0.85; }
  .chore-card.complete-card { border-left:3px solid #6daa45; opacity:0.85; }
  .chore-top { display:flex; align-items:flex-start; gap:10px; }
  .chore-icon { width:34px; height:34px; border-radius:8px; display:flex;
    align-items:center; justify-content:center; font-size:18px;
    background:var(--card-background-color,#fff); flex-shrink:0; }
  .chore-name { font-weight:600; font-size:13px; line-height:1.3; }
  .chore-desc { font-size:12px; color:var(--secondary-text-color); margin-top:2px; }
  .chore-meta { display:flex; gap:5px; flex-wrap:wrap; margin-top:6px; }
  .pill { display:inline-flex; align-items:center; padding:2px 7px; border-radius:9999px;
    font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.03em; }
  .pill-due    { background:rgba(109,170,69,0.15); color:var(--success-color,#6daa45); }
  .pill-multi  { background:rgba(124,99,209,0.15); color:#7c63d1; }
  .pill-recur  { background:rgba(85,145,199,0.15); color:#5591c7; }
  .pill-paused { background:rgba(201,146,10,0.15); color:#c9920a; }
  .pill-done   { background:rgba(109,170,69,0.15); color:#6daa45; }
  .pill-team   { background:rgba(232,97,154,0.15); color:#e8619a; }
  .occ-track { display:flex; gap:4px; margin-top:6px; align-items:center; }
  .occ-dot { width:10px; height:10px; border-radius:9999px; flex-shrink:0;
    border:1.5px solid #7c63d1; background:transparent; transition:background 200ms; }
  .occ-dot.done { background:#7c63d1; border-color:#7c63d1; }
  .chore-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
  .chore-value { font-weight:700; font-size:15px; color:var(--success-color,#6daa45);
    font-variant-numeric:tabular-nums; white-space:nowrap; }

  .btn { display:inline-flex; align-items:center; gap:5px; padding:5px 12px;
    border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:none;
    font-family:inherit; transition:all 150ms; }
  .btn-primary { background:var(--primary-color); color:#fff; }
  .btn-primary:hover { filter:brightness(1.1); }
  .btn-ghost { background:transparent; border:1.5px solid var(--divider-color);
    color:var(--secondary-text-color); }
  .btn-ghost:hover { border-color:var(--primary-color); color:var(--primary-color); }
  .btn-warn { background:transparent; border:1.5px solid #c9920a; color:#c9920a; }
  .btn-warn:hover { background:#c9920a; color:#fff; }
  .btn-pay { width:100%; padding:10px; font-size:14px; margin-top:8px;
    background:var(--success-color,#6daa45); color:#fff; border:none;
    border-radius:10px; font-family:inherit; font-weight:700; cursor:pointer; }

  /* ── Ledger ── */
  .ledger-header { display:flex; justify-content:space-between; align-items:baseline;
    margin-bottom:12px; }
  .ledger-balance { font-size:13px; color:var(--secondary-text-color); }
  .ledger-balance strong { font-size:16px; color:var(--success-color,#6daa45);
    font-variant-numeric:tabular-nums; }
  .ledger-row { display:grid; grid-template-columns:32px 1fr auto auto;
    gap:0 10px; align-items:center;
    padding:10px 0; border-bottom:1px solid var(--divider-color); }
  .ledger-row:last-child { border-bottom:none; }
  .ledger-icon { font-size:18px; text-align:center; }
  .ledger-label { font-size:13px; font-weight:600; line-height:1.3; }
  .ledger-note  { font-size:11px; color:var(--secondary-text-color); margin-top:1px; }
  .ledger-time  { font-size:11px; color:var(--secondary-text-color); text-align:right; white-space:nowrap; }
  .ledger-amount { font-size:13px; font-weight:700; font-variant-numeric:tabular-nums;
    white-space:nowrap; text-align:right; }
  .ledger-amount.earn { color:var(--success-color,#6daa45); }
  .ledger-amount.pay  { color:#db4437; }
  .ledger-running { font-size:11px; color:var(--secondary-text-color);
    font-variant-numeric:tabular-nums; text-align:right; white-space:nowrap; }

  .empty { text-align:center; padding:32px 16px;
    color:var(--secondary-text-color); font-size:13px; }
  .empty-icon { font-size:32px; margin-bottom:8px; }

  /* ── Modals ── */
  .hapm-backdrop { position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,0.52); display:flex; align-items:flex-end;
    justify-content:center; padding-bottom:env(safe-area-inset-bottom,0px); }
  .hapm-backdrop.hidden { display:none; }
  .hapm-sheet { background:var(--card-background-color,#1c1c1e);
    color:var(--primary-text-color); width:100%; max-width:520px;
    border-radius:20px 20px 0 0;
    padding:20px 20px calc(20px + env(safe-area-inset-bottom,0px));
    box-shadow:0 -4px 32px rgba(0,0,0,0.28); max-height:85vh; overflow-y:auto; }
  .hapm-handle { width:36px; height:4px; border-radius:2px;
    background:var(--divider-color,#555); margin:0 auto 16px; }
  .hapm-title { font-weight:700; font-size:17px; margin-bottom:16px; }
  .hapm-label { font-size:11px; font-weight:600; text-transform:uppercase;
    letter-spacing:0.06em; color:var(--secondary-text-color);
    margin-bottom:6px; display:block; }
  .hapm-hint { font-size:12px; color:var(--secondary-text-color); margin-top:-8px; margin-bottom:12px; }
  .hapm-input, .hapm-select { width:100%; padding:10px 12px; font-size:16px;
    border:1.5px solid var(--divider-color,#555); border-radius:10px;
    font-family:inherit; background:var(--secondary-background-color,#2c2c2e);
    color:var(--primary-text-color); margin-bottom:12px;
    -webkit-appearance:none; appearance:none; }
  .hapm-input:focus,.hapm-select:focus { outline:none; border-color:#01696f; }
  .hapm-2col { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
  .hapm-2col .hapm-input, .hapm-2col .hapm-select { margin-bottom:0; }
  .hapm-children-list { display:flex; flex-direction:column;
    border:1.5px solid var(--divider-color,#555); border-radius:10px;
    overflow:hidden; margin-bottom:12px; }
  .hapm-child-row { display:flex; align-items:center; gap:10px; padding:11px 14px;
    cursor:pointer; border-bottom:1px solid var(--divider-color,#444); }
  .hapm-child-row:last-child { border-bottom:none; }
  .hapm-child-row input[type=checkbox] { width:18px; height:18px;
    accent-color:#01696f; flex-shrink:0; cursor:pointer; margin:0; }
  .hapm-child-row .cname { font-size:15px; font-weight:500; flex:1; }
  .hapm-cdot { width:9px; height:9px; border-radius:9999px; flex-shrink:0; }
  .hapm-actions { display:flex; gap:10px; margin-top:4px; }
  .hapm-btn { flex:1; padding:13px; border-radius:12px; font-size:15px;
    font-weight:700; cursor:pointer; border:none; font-family:inherit; }
  .hapm-btn-cancel { background:var(--secondary-background-color,#3a3a3c);
    color:var(--primary-text-color); }
  .hapm-btn-ok { background:#01696f; color:#fff; }

  .hapm-multi-row  { display:none; margin-bottom:12px; }
  .hapm-multi-row.visible  { display:block; }
  .hapm-assign-row { display:none; margin-bottom:12px; }
  .hapm-assign-row.visible { display:block; }
  .hapm-split-row  { display:none; margin-bottom:12px; }
  .hapm-split-row.visible  { display:block; }

  .hapm-option-group { display:grid; gap:8px; margin-bottom:12px; }
  .hapm-option { display:flex; align-items:flex-start; gap:12px; padding:12px 14px;
    border-radius:10px; border:1.5px solid var(--divider-color,#555);
    cursor:pointer; transition:all 150ms; }
  .hapm-option input[type=radio] { margin-top:2px; accent-color:#01696f;
    width:16px; height:16px; flex-shrink:0; cursor:pointer; }
  .hapm-option.selected { border-color:#01696f; background:rgba(1,105,111,0.08); }
  .hapm-option-title { font-size:14px; font-weight:600; line-height:1.3; }
  .hapm-option-desc  { font-size:12px; color:var(--secondary-text-color);
    margin-top:2px; line-height:1.4; }

  .hapm-confirm-msg { font-size:15px; line-height:1.5; margin-bottom:20px;
    text-align:center; color:var(--primary-text-color); }
`;

function syncOptionGroup(groupEl) {
  if (!groupEl) return;
  groupEl.querySelectorAll('.hapm-option').forEach(opt => {
    const radio = opt.querySelector('input[type=radio]');
    opt.classList.toggle('selected', radio?.checked ?? false);
  });
}

// ─── Custom Element ───────────────────────────────────────────────────────────
class HapmPanelCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config           = {};
    this._hass             = null;
    this._activeChildId    = null;
    this._view             = 'chores';
    this._holidayUntil     = null;
    this._children         = [];
    this._optimisticChores = {};
    this._optimisticPaid   = new Map();
    this._domBuilt         = false;
  }

  setConfig(config) { this._config = config; }

  set hass(hass) {
    this._hass = hass;
    this._syncFromHass();
    if (!this._domBuilt) {
      this._buildDOM();
      this._domBuilt = true;
    } else {
      this._updateDOM();
    }
  }

  _syncFromHass() {
    if (!this._hass) return;
    const now    = Date.now();
    const states = this._hass.states;

    for (const childId of Object.keys(this._optimisticChores)) {
      const dueSensorId = Object.keys(states).find(id =>
        id.startsWith('sensor.') && id.endsWith('_chores_due') &&
        states[id]?.attributes?.entry_id === childId
      );
      const serverChores = (dueSensorId ? states[dueSensorId]?.attributes?.due_chores : null) || [];
      const still = this._optimisticChores[childId].filter(o =>
        now < o._expiresAt && !serverChores.find(s => s.name === o.name)
      );
      if (still.length) this._optimisticChores[childId] = still;
      else delete this._optimisticChores[childId];
    }

    const children = [];
    for (const [entityId, state] of Object.entries(states)) {
      if (!entityId.startsWith('sensor.') || !entityId.endsWith('_pocket_money_balance')) continue;
      const attrs        = state.attributes || {};
      const childEntryId = attrs.entry_id      || entityId;
      const childName    = attrs.child_name    || entityId.replace('sensor.','').replace('_pocket_money_balance','');
      const colour       = attrs.avatar_colour || 'teal';
      const currency     = attrs.currency      || CURRENCY_DEFAULT;
      const rawBalance   = parseFloat(state.state) || 0;
      const dueSensorId  = entityId.replace('_pocket_money_balance','_chores_due');
      const dueSensor    = states[dueSensorId];
      const serverChores    = dueSensor?.attributes?.due_chores    || [];
      const pausedChores    = dueSensor?.attributes?.paused_chores || [];
      const completeChores  = dueSensor?.attributes?.complete_chores || [];
      const lastPaid     = attrs.last_paid || null;
      const ledger       = attrs.ledger || [];
      const optimistic   = this._optimisticChores[childEntryId] || [];

      const paidExpiry = this._optimisticPaid.get(childEntryId);
      if (paidExpiry !== undefined) {
        if (rawBalance <= 0 || now > paidExpiry) this._optimisticPaid.delete(childEntryId);
      }
      const balance = this._optimisticPaid.has(childEntryId) ? 0 : rawBalance;

      children.push({ childEntryId, childName, colour, currency, balance,
                       dueChores: [...serverChores, ...optimistic],
                       pausedChores, completeChores, lastPaid, ledger });
    }

    if (children.length) {
      this._children = children;
      if (!this._activeChildId || !children.find(c => c.childEntryId === this._activeChildId))
        this._activeChildId = children[0].childEntryId;
    }
  }

  get _activeChild() {
    return this._children.find(c => c.childEntryId === this._activeChildId) || this._children[0];
  }

  async _callService(service, data) {
    if (!this._hass) return;
    try { await this._hass.callService('hapm', service, data); }
    catch (e) { console.error('HAPM service error', service, e); }
  }

  _anyModalOpen() {
    return ['modal-add','modal-edit','modal-holiday','modal-pay','modal-pause'].some(
      id => !this.shadowRoot.getElementById(id)?.classList.contains('hidden')
    );
  }

  _getAddAssignMode() {
    return this.shadowRoot.querySelector('#m-assign-group input[type=radio]:checked')?.value || 'individual';
  }
  _getAddSplitMode() {
    return this.shadowRoot.querySelector('#m-split-group input[type=radio]:checked')?.value || 'full';
  }

  _refreshAddMultiSections() {
    const sr = this.shadowRoot;
    const checked = [...sr.querySelectorAll('#m-children input[type=checkbox]:checked')];
    const multi = checked.length > 1;
    sr.getElementById('m-assign-row')?.classList.toggle('visible', multi);
    const isTeam = multi && this._getAddAssignMode() === 'team';
    sr.getElementById('m-split-row')?.classList.toggle('visible', isTeam);
  }

  _buildDOM() {
    const sr = this.shadowRoot;
    sr.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = STYLES;
    sr.appendChild(style);

    const card = document.createElement('ha-card');
    card.className = 'hapm';
    card.innerHTML = `
      <div class="topbar">
        <div class="topbar-title"><span style="font-size:20px">\ud83d\udc37</span> Pocket Money</div>
        <button class="btn-holiday" id="btn-holiday">\ud83c\udfd6 Holiday Mode</button>
      </div>
      <div class="child-tabs" id="child-tabs"></div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Balance</div>
          <div class="kpi-value" id="kpi-balance">\u00a30.00</div>
          <div class="kpi-sub">Outstanding</div></div>
        <div class="kpi"><div class="kpi-label">Due Now</div>
          <div class="kpi-value" id="kpi-due">0</div>
          <div class="kpi-sub" id="kpi-due-sub">chores</div></div>
        <div class="kpi"><div class="kpi-label">Last Paid</div>
          <div class="kpi-value" id="kpi-lastpaid" style="font-size:14px">\u2014</div>
          <div class="kpi-sub">&nbsp;</div></div>
      </div>
      <div class="nav">
        <button class="nav-btn active" id="nav-chores">Chores<span class="badge" id="nav-badge" style="display:none"></span></button>
        <button class="nav-btn" id="nav-paused">Paused<span class="badge badge-warn" id="nav-paused-badge" style="display:none"></span></button>
        <button class="nav-btn" id="nav-all">All Chores</button>
        <button class="nav-btn" id="nav-ledger">Ledger</button>
      </div>
      <div class="panel" id="panel"></div>`;
    sr.appendChild(card);

    const modals = document.createElement('div');
    modals.innerHTML = `
      <!-- Add Chore -->
      <div class="hapm-backdrop hidden" id="modal-add">
        <div class="hapm-sheet">
          <div class="hapm-handle"></div>
          <div class="hapm-title">\u2795 Add Chore</div>
          <div class="hapm-2col">
            <div>
              <label class="hapm-label">Category</label>
              <select class="hapm-select" id="m-category">${categoryOptionsHTML()}</select>
            </div>
            <div>
              <label class="hapm-label">Recurrence</label>
              <select class="hapm-select" id="m-recur">
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="weekly" selected>Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <label class="hapm-label">Chore Name</label>
          <input class="hapm-input" id="m-name" type="text" placeholder="e.g. Tidy bedroom"
            autocomplete="off" autocorrect="off" autocapitalize="sentences">
          <label class="hapm-label">Description (optional)</label>
          <input class="hapm-input" id="m-desc" type="text" placeholder="Extra detail\u2026"
            autocomplete="off" autocorrect="off" autocapitalize="sentences">
          <div class="hapm-2col">
            <div>
              <label class="hapm-label">Value (\u00a3)</label>
              <input class="hapm-input" id="m-value" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.50">
            </div>
            <div>
              <label class="hapm-label">Occurrences</label>
              <input class="hapm-input" id="m-occ" type="number" inputmode="numeric" min="1" value="1">
            </div>
          </div>
          <div class="hapm-multi-row" id="m-paymode-row">
            <label class="hapm-label">Pay Mode</label>
            <select class="hapm-select" id="m-paymode">
              <option value="per_occurrence">Per occurrence \u2014 equal share each time</option>
              <option value="on_completion">All at once \u2014 full value when all done</option>
            </select>
          </div>
          <label class="hapm-label">Assign To</label>
          <div class="hapm-children-list" id="m-children"></div>
          <div class="hapm-assign-row" id="m-assign-row">
            <label class="hapm-label">How should they work?</label>
            <div class="hapm-option-group" id="m-assign-group">
              <label class="hapm-option selected">
                <input type="radio" name="m-assign" value="individual" checked>
                <div><div class="hapm-option-title">\ud83d\udc64 Individual</div>
                <div class="hapm-option-desc">Each child gets their own set of occurrences to complete independently.</div></div>
              </label>
              <label class="hapm-option">
                <input type="radio" name="m-assign" value="team">
                <div><div class="hapm-option-title">\ud83d\udc6a Team</div>
                <div class="hapm-option-desc">All children work towards the same shared occurrence target together.</div></div>
              </label>
            </div>
          </div>
          <div class="hapm-split-row" id="m-split-row">
            <label class="hapm-label">How should they be paid?</label>
            <div class="hapm-option-group" id="m-split-group">
              <label class="hapm-option selected">
                <input type="radio" name="m-split" value="full" checked>
                <div><div class="hapm-option-title">\ud83d\udcb0 Each earns full value</div>
                <div class="hapm-option-desc">Every child in the team earns the full chore value.</div></div>
              </label>
              <label class="hapm-option">
                <input type="radio" name="m-split" value="shared">
                <div><div class="hapm-option-title">\u2797 Split equally</div>
                <div class="hapm-option-desc">The total value is divided equally between all children in the team.</div></div>
              </label>
            </div>
          </div>
          <div class="hapm-actions">
            <button class="hapm-btn hapm-btn-cancel" id="m-add-cancel">Cancel</button>
            <button class="hapm-btn hapm-btn-ok"     id="m-add-submit">Add Chore</button>
          </div>
        </div>
      </div>

      <!-- Edit Chore -->
      <div class="hapm-backdrop hidden" id="modal-edit">
        <div class="hapm-sheet">
          <div class="hapm-handle"></div>
          <div class="hapm-title">\u270f\ufe0f Edit Chore</div>
          <div class="hapm-2col">
            <div>
              <label class="hapm-label">Category</label>
              <select class="hapm-select" id="e-category">${categoryOptionsHTML()}</select>
            </div>
            <div>
              <label class="hapm-label">Recurrence</label>
              <select class="hapm-select" id="e-recur">
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <label class="hapm-label">Chore Name</label>
          <input class="hapm-input" id="e-name" type="text" autocomplete="off" autocorrect="off" autocapitalize="sentences">
          <label class="hapm-label">Description (optional)</label>
          <input class="hapm-input" id="e-desc" type="text" autocomplete="off" autocorrect="off" autocapitalize="sentences">
          <div class="hapm-2col">
            <div>
              <label class="hapm-label">Value (\u00a3)</label>
              <input class="hapm-input" id="e-value" type="number" inputmode="decimal" min="0.01" step="0.01">
            </div>
            <div>
              <label class="hapm-label">Occurrences</label>
              <input class="hapm-input" id="e-occ" type="number" inputmode="numeric" min="1">
            </div>
          </div>
          <div class="hapm-multi-row" id="e-paymode-row">
            <label class="hapm-label">Pay Mode</label>
            <select class="hapm-select" id="e-paymode">
              <option value="per_occurrence">Per occurrence \u2014 equal share each time</option>
              <option value="on_completion">All at once \u2014 full value when all done</option>
            </select>
          </div>
          <div class="hapm-actions">
            <button class="hapm-btn hapm-btn-cancel" id="m-edit-cancel">Cancel</button>
            <button class="hapm-btn hapm-btn-ok"     id="m-edit-submit">Save Changes</button>
          </div>
        </div>
      </div>

      <!-- Holiday -->
      <div class="hapm-backdrop hidden" id="modal-holiday">
        <div class="hapm-sheet">
          <div class="hapm-handle"></div>
          <div class="hapm-title">\ud83c\udfd6 Holiday Mode</div>
          <label class="hapm-label">How many days are you away?</label>
          <input class="hapm-input" id="m-holiday-days" type="number" inputmode="numeric" min="1" max="365" value="7">
          <div class="hapm-actions">
            <button class="hapm-btn hapm-btn-cancel" id="m-holiday-cancel">Cancel</button>
            <button class="hapm-btn hapm-btn-ok"     id="m-holiday-submit">Start Holiday</button>
          </div>
        </div>
      </div>

      <!-- Pay -->
      <div class="hapm-backdrop hidden" id="modal-pay">
        <div class="hapm-sheet">
          <div class="hapm-handle"></div>
          <div class="hapm-title">\ud83d\udcb8 Confirm Payment</div>
          <div class="hapm-confirm-msg" id="m-pay-msg"></div>
          <div class="hapm-actions">
            <button class="hapm-btn hapm-btn-cancel" id="m-pay-cancel">Cancel</button>
            <button class="hapm-btn hapm-btn-ok"     id="m-pay-submit">Confirm Pay</button>
          </div>
        </div>
      </div>

      <!-- Pause -->
      <div class="hapm-backdrop hidden" id="modal-pause">
        <div class="hapm-sheet">
          <div class="hapm-handle"></div>
          <div class="hapm-title">\u23f8 Pause Chore</div>
          <div class="hapm-confirm-msg" id="m-pause-chore-name" style="text-align:left;margin-bottom:16px;font-weight:600"></div>
          <label class="hapm-label">Pause for how many days?</label>
          <input class="hapm-input" id="m-pause-days" type="number" inputmode="numeric" min="1" placeholder="Leave blank to pause indefinitely">
          <div class="hapm-hint">Leave blank to pause until manually resumed.</div>
          <div class="hapm-actions">
            <button class="hapm-btn hapm-btn-cancel" id="m-pause-cancel">Cancel</button>
            <button class="hapm-btn hapm-btn-ok"     id="m-pause-submit">Pause Chore</button>
          </div>
        </div>
      </div>`;
    sr.appendChild(modals);

    this._bindEvents();
    this._updateDOM();
  }

  _updateDOM() {
    const sr    = this.shadowRoot;
    const child = this._activeChild;

    const btnH = sr.getElementById('btn-holiday');
    if (btnH) {
      const active = this._holidayUntil && new Date(this._holidayUntil) > new Date();
      btnH.textContent = active
        ? `\ud83c\udfd6 Holiday \u2014 ${daysRemaining(this._holidayUntil)}d left`
        : '\ud83c\udfd6 Holiday Mode';
      btnH.classList.toggle('active', !!active);
    }

    const tabsEl = sr.getElementById('child-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = this._children.map(c => `
        <button class="child-tab${c.childEntryId===this._activeChildId?' active':''}" data-action="set-child" data-child="${esc(c.childEntryId)}">
          <span class="dot" style="background:${COLOUR_MAP[c.colour]||COLOUR_MAP.teal}"></span>
          ${esc(c.childName)}
          <span style="opacity:0.75;font-size:11px">${fmtMoney(Math.max(0,c.balance),c.currency)}</span>
        </button>`).join('');
      tabsEl.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', e => this._handleAction(e)));
    }

    if (child) {
      const balEl = sr.getElementById('kpi-balance');
      if (balEl) { balEl.textContent = fmtMoney(child.balance, child.currency); balEl.className = 'kpi-value' + (child.balance > 0 ? ' positive' : ''); }
      const n = (child.dueChores||[]).length;
      const p = (child.pausedChores||[]).length;
      const dueEl = sr.getElementById('kpi-due'); if (dueEl) dueEl.textContent = n;
      const dueSubEl = sr.getElementById('kpi-due-sub'); if (dueSubEl) dueSubEl.textContent = 'chore'+(n!==1?'s':'');
      const lpEl = sr.getElementById('kpi-lastpaid'); if (lpEl) lpEl.textContent = child.lastPaid ? fmtDate(child.lastPaid) : '\u2014';
      const badge = sr.getElementById('nav-badge'); if (badge) { badge.textContent=n; badge.style.display=n?'':'none'; }
      const pbadge = sr.getElementById('nav-paused-badge'); if (pbadge) { pbadge.textContent=p; pbadge.style.display=p?'':'none'; }
    }

    sr.getElementById('nav-chores')?.classList.toggle('active', this._view==='chores');
    sr.getElementById('nav-paused')?.classList.toggle('active', this._view==='paused');
    sr.getElementById('nav-all')?.classList.toggle('active',    this._view==='all');
    sr.getElementById('nav-ledger')?.classList.toggle('active', this._view==='ledger');

    if (this._anyModalOpen()) return;

    const panel = sr.getElementById('panel');
    if (!panel) return;

    if (this._view === 'chores') {
      panel.innerHTML = this._choresPanelHTML(child);
    } else if (this._view === 'paused') {
      panel.innerHTML = this._pausedPanelHTML(child);
    } else if (this._view === 'all') {
      panel.innerHTML = this._allChoresPanelHTML(child);
    } else {
      panel.innerHTML = this._ledgerPanelHTML(child);
    }
    panel.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', e => this._handleAction(e)));
  }

  // ── Panel renderers ──────────────────────────────────────────────────────────

  _choresPanelHTML(child) {
    if (!child) return `<div class="empty"><div class="empty-icon">\ud83d\udc76</div>No children configured.<br>Add a child in Settings \u2192 Integrations \u2192 HAPM.</div>`;
    const chores = child.dueChores || [];
    const payBtn = child.balance > 0
      ? `<button class="btn-pay" data-action="open-pay">\ud83d\udcb8 Pay ${esc(child.childName)} \u2014 ${fmtMoney(child.balance, child.currency)}</button>`
      : '';
    const choreHTML = chores.length
      ? chores.map(c => this._choreCardHTML(c, child)).join('')
      : '<div class="empty"><div class="empty-icon">\u2705</div>All done! No chores due right now.</div>';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <strong style="font-size:13px">Due Chores</strong>
        <button class="btn btn-ghost" data-action="open-add-form">+ Add Chore</button>
      </div>
      ${choreHTML}${payBtn}`;
  }

  _pausedPanelHTML(child) {
    if (!child) return `<div class="empty"><div class="empty-icon">\ud83d\udc76</div>No children configured.</div>`;
    const chores = child.pausedChores || [];
    if (!chores.length) return `<div class="empty"><div class="empty-icon">\u25b6\ufe0f</div>No paused chores \u2014 everything is active.</div>`;
    return `
      <div style="margin-bottom:10px"><strong style="font-size:13px">Paused Chores</strong></div>
      ${chores.map(c => this._pausedCardHTML(c, child)).join('')}`;
  }

  _allChoresPanelHTML(child) {
    if (!child) return `<div class="empty"><div class="empty-icon">\ud83d\udc76</div>No children configured.</div>`;
    const due     = child.dueChores     || [];
    const paused  = child.pausedChores  || [];
    const complete = child.completeChores || [];
    const total   = due.length + paused.length + complete.length;
    if (!total) return `<div class="empty"><div class="empty-icon">\ud83d\udccb</div>No chores yet.<br>Tap + Add Chore to get started.</div>`;

    const sections = [];

    if (due.length) {
      sections.push(`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--secondary-text-color);margin-bottom:8px;margin-top:4px">Due Now (${due.length})</div>`);
      sections.push(...due.map(c => this._allChoreCardHTML(c, child, 'due')));
    }
    if (paused.length) {
      sections.push(`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--secondary-text-color);margin-bottom:8px;margin-top:12px">Paused (${paused.length})</div>`);
      sections.push(...paused.map(c => this._allChoreCardHTML(c, child, 'paused')));
    }
    if (complete.length) {
      sections.push(`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--secondary-text-color);margin-bottom:8px;margin-top:12px">Done / Not Yet Due (${complete.length})</div>`);
      sections.push(...complete.map(c => this._allChoreCardHTML(c, child, 'complete')));
    }

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong style="font-size:13px">All Chores (${total})</strong>
        <button class="btn btn-ghost" data-action="open-add-form">+ Add Chore</button>
      </div>
      ${sections.join('')}`;
  }

  _allChoreCardHTML(c, child, status) {
    const desc     = getDesc(c);
    const isMulti  = (c.occurrences_required||1) > 1;
    const isTeam   = c.assignment_mode === 'team';
    const isShared = c.pay_split_mode  === 'shared';
    const done     = c.occurrences_completed || 0;
    const total    = c.occurrences_required  || 1;
    const choreJson = esc(JSON.stringify(c));

    let borderColour = '';
    let statusPill = '';
    if (status === 'due') {
      borderColour = 'border-left:3px solid var(--primary-color);';
      statusPill = '<span class="pill pill-due">\u23f0 Due</span>';
    } else if (status === 'paused') {
      borderColour = 'border-left:3px solid #c9920a;';
      statusPill = `<span class="pill pill-paused">\u23f8 ${esc(fmtPausedUntil(c.paused_until))}</span>`;
    } else {
      borderColour = 'border-left:3px solid #6daa45;';
      const nextLabel = c.next_due ? fmtNextDue(c.next_due) : (c.recurrence === 'manual' ? 'Manual' : '');
      statusPill = nextLabel ? `<span class="pill pill-done">\u2705 ${esc(nextLabel)}</span>` : '<span class="pill pill-done">\u2705 Done</span>';
    }

    const lastDoneStr = c.last_completed
      ? `<div style="font-size:11px;color:var(--secondary-text-color);margin-top:2px">Last done ${fmtDate(c.last_completed)}</div>`
      : '';

    const resumeBtn = status === 'paused'
      ? `<button class="btn btn-warn" data-action="resume" data-chore="${esc(c.id)}">\u25b6 Resume</button>`
      : '';

    return `<div class="chore-card" style="${borderColour}">
      <div>
        <div class="chore-top">
          <div class="chore-icon">${choreIcon(c)}</div>
          <div style="flex:1">
            <div class="chore-name">${esc(c.name)}</div>
            ${desc ? `<div class="chore-desc">${esc(desc)}</div>` : ''}
            ${lastDoneStr}
            <div class="chore-meta">
              ${statusPill}
              ${c.recurrence && c.recurrence !== 'manual' ? `<span class="pill pill-recur">${esc(c.recurrence)}</span>` : ''}
              ${isMulti ? `<span class="pill pill-multi">${done}/${total}\u00d7</span>` : ''}
              ${isTeam  ? `<span class="pill pill-team">\ud83d\udc6a Team${isShared?' \u00f7':''}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="chore-actions">
          ${resumeBtn}
          <button class="btn btn-ghost" data-action="open-edit" data-chore-json="${choreJson}">\u270f\ufe0f Edit</button>
          <button class="btn btn-ghost" data-action="open-pause" data-chore="${esc(c.id)}" data-chore-name="${esc(c.name)}">\u23f8 Pause</button>
        </div>
      </div>
      <div class="chore-value">${fmtMoney(c.value, child.currency)}</div>
    </div>`;
  }

  _pausedCardHTML(c, child) {
    const label    = fmtPausedUntil(c.paused_until);
    const desc     = getDesc(c);
    const done     = c.occurrences_completed || 0;
    const total    = c.occurrences_required  || 1;
    const isMulti  = total > 1;
    const isTeam   = c.assignment_mode === 'team';
    const isShared = c.pay_split_mode  === 'shared';
    const choreJson = esc(JSON.stringify(c));
    return `<div class="chore-card paused-card">
      <div>
        <div class="chore-top">
          <div class="chore-icon">${choreIcon(c)}</div>
          <div>
            <div class="chore-name">${esc(c.name)}</div>
            ${desc ? `<div class="chore-desc">${esc(desc)}</div>` : ''}
            <div class="chore-meta">
              <span class="pill pill-paused">\u23f8 ${esc(label)}</span>
              ${isMulti ? `<span class="pill pill-multi">${done}/${total}\u00d7</span>` : ''}
              ${isTeam  ? `<span class="pill pill-team">\ud83d\udc6a Team${isShared?' \u00f7':''}</span>` : ''}
              ${c.recurrence && c.recurrence !== 'manual' ? `<span class="pill pill-recur">${esc(c.recurrence)}</span>` : ''}
            </div>
            ${isMulti ? `<div class="occ-track">${Array.from({length:total},(_,i)=>`<span class="occ-dot${i<done?' done':''}"></span>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="chore-actions">
          <button class="btn btn-warn"  data-action="resume"    data-chore="${esc(c.id)}">\u25b6 Resume</button>
          <button class="btn btn-ghost" data-action="open-edit" data-chore-json="${choreJson}">\u270f\ufe0f Edit</button>
        </div>
      </div>
      <div class="chore-value">${fmtMoney(c.value, child.currency)}</div>
    </div>`;
  }

  _choreCardHTML(c, child) {
    const isMulti  = c.occurrences_required > 1;
    const isOpt    = !!c._optimistic;
    const isTeam   = c.assignment_mode === 'team';
    const isShared = c.pay_split_mode  === 'shared';
    const desc     = getDesc(c);
    const done     = c.occurrences_completed || 0;
    const total    = c.occurrences_required  || 1;
    const nextOcc  = done + 1;
    const choreJson = esc(JSON.stringify(c));
    return `<div class="chore-card${isOpt?' optimistic':''}">
      <div>
        <div class="chore-top">
          <div class="chore-icon">${choreIcon(c)}</div>
          <div>
            <div class="chore-name">${esc(c.name)}${isOpt?' <span style="font-size:10px;opacity:0.5">(saving\u2026)</span>':''}</div>
            ${desc ? `<div class="chore-desc">${esc(desc)}</div>` : ''}
            <div class="chore-meta">
              ${c.recurrence && c.recurrence !== 'manual' ? `<span class="pill pill-recur">${esc(c.recurrence)}</span>` : ''}
              ${isMulti ? `<span class="pill pill-multi">${done}/${total}\u00d7</span>` : ''}
              ${isTeam  ? `<span class="pill pill-team">\ud83d\udc6a Team${isShared?' \u00f7':''}</span>` : ''}
              ${!isOpt  ? '<span class="pill pill-due">Due</span>' : ''}
            </div>
            ${isMulti ? `<div class="occ-track">${Array.from({length:total},(_,i)=>`<span class="occ-dot${i<done?' done':''}"></span>`).join('')}</div>` : ''}
          </div>
        </div>
        ${!isOpt ? `<div class="chore-actions">
          ${isMulti
            ? `<button class="btn btn-primary" data-action="log-occ"  data-chore="${esc(c.id)}" data-child="${esc(child.childEntryId)}">Log ${nextOcc}/${total} \u2713</button>`
            : `<button class="btn btn-primary" data-action="complete" data-chore="${esc(c.id)}" data-child="${esc(child.childEntryId)}">Mark done \u2713</button>`}
          <button class="btn btn-ghost" data-action="open-pause" data-chore="${esc(c.id)}" data-chore-name="${esc(c.name)}">Pause</button>
          <button class="btn btn-ghost" data-action="open-edit"  data-chore-json="${choreJson}">\u270f\ufe0f</button>
        </div>` : ''}
      </div>
      <div class="chore-value">${fmtMoney(c.value, child.currency)}</div>
    </div>`;
  }

  _ledgerPanelHTML(child) {
    if (!child) return `<div class="empty"><div class="empty-icon">\ud83d\udc76</div>No children configured.</div>`;
    const entries = child.ledger || [];
    if (!entries.length) return `<div class="empty"><div class="empty-icon">\ud83d\udcd2</div>No transactions yet.<br>Complete a chore to get started!</div>`;
    const reversed = [...entries].reverse();
    let running = 0;
    const runningBalances = reversed.map(e => { running += e.amount; return running; });
    runningBalances.reverse();
    const rows = entries.map((e,i) => {
      const meta   = ledgerMeta(e.event_type);
      const isEarn = e.amount > 0;
      return `<div class="ledger-row">
        <div class="ledger-icon">${meta.icon}</div>
        <div>
          <div class="ledger-label">${e.note ? esc(e.note) : esc(meta.label)}</div>
          <div class="ledger-time">${fmtDate(e.timestamp)}</div>
        </div>
        <div class="ledger-amount ${isEarn?'earn':'pay'}">${fmtMoneyRaw(e.amount, child.currency)}</div>
        <div class="ledger-running">${fmtMoney(runningBalances[i], child.currency)}</div>
      </div>`;
    }).join('');
    return `
      <div class="ledger-header">
        <strong style="font-size:13px">Transaction History</strong>
        <div class="ledger-balance">Balance: <strong>${fmtMoney(child.balance,child.currency)}</strong></div>
      </div>
      ${rows}
      ${entries.length>=50?`<div style="text-align:center;padding:12px 0;font-size:12px;color:var(--secondary-text-color)">Showing most recent 50 transactions</div>`:''}`;
  }

  _bindEvents() {
    const sr = this.shadowRoot;

    sr.getElementById('nav-chores')?.addEventListener('click', () => { this._view='chores'; this._updateDOM(); });
    sr.getElementById('nav-paused')?.addEventListener('click', () => { this._view='paused'; this._updateDOM(); });
    sr.getElementById('nav-all')?.addEventListener('click',    () => { this._view='all';    this._updateDOM(); });
    sr.getElementById('nav-ledger')?.addEventListener('click', () => { this._view='ledger'; this._updateDOM(); });

    sr.getElementById('btn-holiday')?.addEventListener('click', () => {
      const active = this._holidayUntil && new Date(this._holidayUntil) > new Date();
      if (active) {
        this._holidayUntil = null;
        this._callService('clear_holiday_mode', {});
        this._updateDOM();
      } else {
        sr.getElementById('m-holiday-days').value = '7';
        this._openModal('modal-holiday');
        setTimeout(() => sr.getElementById('m-holiday-days')?.focus(), 80);
      }
    });

    sr.getElementById('m-add-cancel')?.addEventListener('click', () => this._closeModal('modal-add'));
    sr.getElementById('m-occ')?.addEventListener('input', () => {
      const occ = parseInt(sr.getElementById('m-occ').value)||1;
      sr.getElementById('m-paymode-row')?.classList.toggle('visible', occ>1);
    });
    sr.getElementById('m-children')?.addEventListener('change', () => {
      this._refreshAddMultiSections();
      syncOptionGroup(sr.getElementById('m-assign-group'));
      syncOptionGroup(sr.getElementById('m-split-group'));
    });
    sr.getElementById('m-assign-group')?.addEventListener('change', () => {
      this._refreshAddMultiSections();
      syncOptionGroup(sr.getElementById('m-assign-group'));
    });
    sr.getElementById('m-split-group')?.addEventListener('change', () => {
      syncOptionGroup(sr.getElementById('m-split-group'));
    });
    sr.getElementById('m-add-submit')?.addEventListener('click', () => {
      const name     = sr.getElementById('m-name').value.trim();
      const desc     = sr.getElementById('m-desc').value.trim();
      const value    = parseFloat(sr.getElementById('m-value').value);
      const recur    = sr.getElementById('m-recur').value||'manual';
      const occ      = parseInt(sr.getElementById('m-occ').value)||1;
      const category = sr.getElementById('m-category').value||DEFAULT_CATEGORY;
      const payMode  = occ>1?(sr.getElementById('m-paymode').value||'per_occurrence'):'per_occurrence';
      const assigned = [...sr.querySelectorAll('#m-children input[type=checkbox]:checked')].map(cb=>cb.value);
      if (!name||!value||!assigned.length) { if(!name) sr.getElementById('m-name').focus(); return; }
      const isMultiChild = assigned.length>1;
      const assignMode   = isMultiChild ? this._getAddAssignMode() : 'individual';
      const splitMode    = (isMultiChild&&assignMode==='team') ? this._getAddSplitMode() : 'full';
      this._closeModal('modal-add');
      const expiresAt = Date.now()+OPTIMISTIC_TTL_MS;
      assigned.forEach(childId => {
        if (!this._optimisticChores[childId]) this._optimisticChores[childId]=[];
        this._optimisticChores[childId].push({ id:'_opt_'+Date.now(), name, description:desc||null, value,
          recurrence:recur, occurrences_required:occ, occurrences_completed:0,
          category, assignment_mode:assignMode, pay_split_mode:splitMode,
          _optimistic:true, _expiresAt:expiresAt });
      });
      this._syncFromHass(); this._updateDOM();
      this._callService('add_chore', { name, value, recurrence:recur, occurrences_required:occ,
        pay_mode:payMode, assignment_mode:assignMode, pay_split_mode:splitMode,
        category, assigned_to:assigned, ...(desc?{description:desc}:{}) });
    });

    sr.getElementById('m-edit-cancel')?.addEventListener('click', () => this._closeModal('modal-edit'));
    sr.getElementById('e-occ')?.addEventListener('input', () => {
      const occ = parseInt(sr.getElementById('e-occ').value)||1;
      sr.getElementById('e-paymode-row')?.classList.toggle('visible', occ>1);
    });
    sr.getElementById('m-edit-submit')?.addEventListener('click', () => {
      const modal   = sr.getElementById('modal-edit');
      const choreId = modal.dataset.choreId;
      const name    = sr.getElementById('e-name').value.trim();
      const desc    = sr.getElementById('e-desc').value.trim();
      const value   = parseFloat(sr.getElementById('e-value').value);
      const recur   = sr.getElementById('e-recur').value||'manual';
      const occ     = parseInt(sr.getElementById('e-occ').value)||1;
      const category= sr.getElementById('e-category').value||DEFAULT_CATEGORY;
      const payMode = occ>1?(sr.getElementById('e-paymode').value||'per_occurrence'):'per_occurrence';
      if (!name||!value) { if(!name) sr.getElementById('e-name').focus(); return; }
      this._closeModal('modal-edit');
      this._callService('update_chore', { chore_id:choreId, name, value, recurrence:recur,
        occurrences_required:occ, pay_mode:payMode, category, description:desc||null });
    });

    sr.getElementById('m-holiday-cancel')?.addEventListener('click', () => this._closeModal('modal-holiday'));
    sr.getElementById('m-holiday-submit')?.addEventListener('click', () => {
      const days = parseInt(sr.getElementById('m-holiday-days').value)||7;
      this._closeModal('modal-holiday');
      const until = new Date(); until.setDate(until.getDate()+days);
      this._holidayUntil = until.toISOString();
      this._callService('set_holiday_mode', {days}); this._updateDOM();
    });

    sr.getElementById('m-pay-cancel')?.addEventListener('click', () => this._closeModal('modal-pay'));
    sr.getElementById('m-pay-submit')?.addEventListener('click', () => {
      const child = this._activeChild; if (!child) return;
      this._closeModal('modal-pay');
      this._optimisticPaid.set(child.childEntryId, Date.now()+OPTIMISTIC_TTL_MS);
      this._syncFromHass(); this._updateDOM();
      this._callService('mark_paid', {child_entry_id:child.childEntryId});
    });

    sr.getElementById('m-pause-cancel')?.addEventListener('click', () => this._closeModal('modal-pause'));
    sr.getElementById('m-pause-submit')?.addEventListener('click', () => {
      const choreId = sr.getElementById('modal-pause').dataset.choreId;
      const rawDays = sr.getElementById('m-pause-days').value.trim();
      const days    = rawDays==='' ? null : parseInt(rawDays,10);
      this._closeModal('modal-pause');
      const svcData = {chore_id:choreId};
      if (days!==null) svcData.days=days;
      this._callService('pause_chore', svcData);
    });
  }

  _handleAction(e) {
    const el     = e.currentTarget;
    const action = el.dataset.action;
    const sr     = this.shadowRoot;

    switch (action) {
      case 'set-child':
        this._activeChildId = el.dataset.child; this._updateDOM(); break;

      case 'open-add-form': {
        sr.getElementById('m-category').innerHTML = categoryOptionsHTML(DEFAULT_CATEGORY);
        sr.getElementById('m-name').value=''; sr.getElementById('m-desc').value='';
        sr.getElementById('m-value').value=''; sr.getElementById('m-recur').value='weekly';
        sr.getElementById('m-occ').value='1'; sr.getElementById('m-paymode').value='per_occurrence';
        sr.getElementById('m-paymode-row')?.classList.remove('visible');
        const indRadio=sr.querySelector('#m-assign-group input[value=individual]');
        if(indRadio){indRadio.checked=true;syncOptionGroup(sr.getElementById('m-assign-group'));}
        const fullRadio=sr.querySelector('#m-split-group input[value=full]');
        if(fullRadio){fullRadio.checked=true;syncOptionGroup(sr.getElementById('m-split-group'));}
        sr.getElementById('m-assign-row')?.classList.remove('visible');
        sr.getElementById('m-split-row')?.classList.remove('visible');
        sr.getElementById('m-children').innerHTML = this._children.map(c=>`
          <label class="hapm-child-row">
            <input type="checkbox" value="${esc(c.childEntryId)}" ${c.childEntryId===this._activeChildId?'checked':''}>
            <span class="hapm-cdot" style="background:${COLOUR_MAP[c.colour]||COLOUR_MAP.teal}"></span>
            <span class="cname">${esc(c.childName)}</span>
          </label>`).join('');
        this._openModal('modal-add');
        setTimeout(()=>sr.getElementById('m-name')?.focus(),80);
        break;
      }

      case 'open-edit': {
        let chore; try { chore=JSON.parse(el.dataset.choreJson); } catch { break; }
        const modal=sr.getElementById('modal-edit');
        modal.dataset.choreId=chore.id;
        sr.getElementById('e-category').innerHTML=categoryOptionsHTML(chore.category||DEFAULT_CATEGORY);
        sr.getElementById('e-name').value=chore.name||'';
        sr.getElementById('e-desc').value=getDesc(chore);
        sr.getElementById('e-value').value=chore.value||'';
        sr.getElementById('e-recur').value=chore.recurrence||'manual';
        const occ=chore.occurrences_required||1;
        sr.getElementById('e-occ').value=occ;
        sr.getElementById('e-paymode').value=chore.pay_mode||'per_occurrence';
        sr.getElementById('e-paymode-row')?.classList.toggle('visible',occ>1);
        this._openModal('modal-edit');
        setTimeout(()=>sr.getElementById('e-name')?.focus(),80);
        break;
      }

      case 'open-pay': {
        const child=this._activeChild;
        if(!child||child.balance<=0) return;
        sr.getElementById('m-pay-msg').innerHTML=`Pay <strong>${esc(child.childName)}</strong> ${fmtMoney(child.balance,child.currency)}?`;
        this._openModal('modal-pay'); break;
      }

      case 'open-pause': {
        const modal=sr.getElementById('modal-pause');
        modal.dataset.choreId=el.dataset.chore;
        sr.getElementById('m-pause-chore-name').textContent=el.dataset.choreName||'';
        sr.getElementById('m-pause-days').value='';
        this._openModal('modal-pause');
        setTimeout(()=>sr.getElementById('m-pause-days')?.focus(),80);
        break;
      }

      case 'complete':
        el.closest('.chore-card')?.classList.add('completing');
        this._callService('complete_chore',{chore_id:el.dataset.chore,child_entry_id:el.dataset.child}); break;

      case 'log-occ':
        this._callService('log_occurrence',{chore_id:el.dataset.chore,child_entry_id:el.dataset.child}); break;

      case 'resume':
        this._callService('resume_chore',{chore_id:el.dataset.chore}); break;
    }
  }

  _openModal(id)  { this.shadowRoot.getElementById(id)?.classList.remove('hidden'); }
  _closeModal(id) { this.shadowRoot.getElementById(id)?.classList.add('hidden'); }

  getCardSize() { return 6; }
  static getStubConfig() { return {}; }
}

if (!customElements.get('hapm-panel-card')) {
  customElements.define('hapm-panel-card', HapmPanelCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === 'hapm-panel-card')) {
  window.customCards.push({
    type: 'hapm-panel-card',
    name: 'HAPM Pocket Money Panel',
    description: 'Track chores and pocket money balances for your children.',
    preview: false,
    documentationURL: 'https://github.com/LayzeeAutomation/hapm',
  });
}
console.info(
  `%c HAPM PANEL CARD %c v${HAPM_VERSION} `,
  'background:#01696f;color:#fff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:700',
  'background:#eee;color:#333;padding:2px 6px;border-radius:0 4px 4px 0',
);
