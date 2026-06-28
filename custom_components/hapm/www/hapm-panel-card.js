/**
 * HAPM Pocket Money Panel Card
 * A self-contained Lovelace custom card for the HAPM integration.
 * Install via HACS — no manual file copying required.
 *
 * Usage in Lovelace:
 *   type: custom:hapm-panel-card
 */

const HAPM_VERSION = '0.1.1';
const CURRENCY_DEFAULT = '£';

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  :host { display: block; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .hapm { font-family: var(--primary-font-family, 'DM Sans', sans-serif);
    font-size: 14px; color: var(--primary-text-color);
    background: var(--ha-card-background, var(--card-background-color));
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: hidden; }

  /* ── Tabs ── */
  .child-tabs { display: flex; gap: 8px; flex-wrap: wrap;
    padding: 16px 16px 0; }
  .child-tab { display: flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 9999px;
    border: 1.5px solid var(--divider-color);
    cursor: pointer; font-size: 13px; font-weight: 500;
    background: none; color: var(--primary-text-color);
    transition: all 150ms ease; }
  .child-tab:hover { border-color: var(--primary-color); color: var(--primary-color); }
  .child-tab.active { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }
  .dot { width: 9px; height: 9px; border-radius: 9999px; flex-shrink: 0; }

  /* ── KPIs ── */
  .kpi-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px; padding: 14px 16px; }
  .kpi { background: var(--secondary-background-color);
    border-radius: 10px; padding: 12px 14px; }
  .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--secondary-text-color); margin-bottom: 4px; }
  .kpi-value { font-size: 22px; font-weight: 700; line-height: 1;
    font-variant-numeric: tabular-nums lining-nums; }
  .kpi-value.positive { color: var(--success-color, #6daa45); }
  .kpi-sub { font-size: 11px; color: var(--secondary-text-color); margin-top: 3px; }

  /* ── Nav ── */
  .nav { display: flex; gap: 4px; padding: 0 16px;
    border-bottom: 1px solid var(--divider-color); }
  .nav-btn { padding: 10px 14px; font-size: 13px; font-weight: 500;
    background: none; border: none; border-bottom: 2px solid transparent;
    color: var(--secondary-text-color); cursor: pointer; transition: all 150ms ease;
    margin-bottom: -1px; }
  .nav-btn:hover { color: var(--primary-text-color); }
  .nav-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
  .badge { display: inline-flex; align-items: center; justify-content: center;
    background: var(--primary-color); color: #fff;
    border-radius: 9999px; font-size: 10px; font-weight: 700;
    padding: 1px 6px; margin-left: 4px; }

  /* ── View panels ── */
  .panel { padding: 14px 16px; }

  /* ── Chore cards ── */
  .chore-card { background: var(--secondary-background-color);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
    display: grid; grid-template-columns: 1fr auto; gap: 8px;
    align-items: start; transition: opacity 300ms ease; }
  .chore-card.completing { opacity: 0.35; pointer-events: none; }
  .chore-card.paused { opacity: 0.6; }
  .chore-top { display: flex; align-items: flex-start; gap: 10px; }
  .chore-icon { width: 34px; height: 34px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; background: var(--card-background-color, #fff);
    flex-shrink: 0; }
  .chore-name { font-weight: 600; font-size: 13px; line-height: 1.3; }
  .chore-desc { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
  .chore-meta { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
  .pill { display: inline-flex; align-items: center; padding: 2px 7px;
    border-radius: 9999px; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.03em; }
  .pill-due     { background: rgba(109,170,69,0.15); color: var(--success-color,#6daa45); }
  .pill-paused  { background: rgba(232,175,52,0.15); color: #c9920a; }
  .pill-multi   { background: rgba(124,99,209,0.15); color: #7c63d1; }
  .pill-team    { background: rgba(253,171,67,0.15); color: #c97700; }
  .pill-recur   { background: rgba(85,145,199,0.15); color: #5591c7; }
  .occ-track { display: flex; gap: 4px; margin-top: 6px; }
  .occ-dot { width: 9px; height: 9px; border-radius: 9999px;
    background: var(--divider-color); border: 1.5px solid var(--secondary-text-color);
    transition: all 200ms ease; }
  .occ-dot.done { background: var(--primary-color); border-color: var(--primary-color); }
  .chore-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .chore-value { font-weight: 700; font-size: 15px;
    color: var(--success-color, #6daa45);
    font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* ── Buttons ── */
  .btn { display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 8px; font-size: 12px;
    font-weight: 600; cursor: pointer; border: none;
    font-family: inherit; transition: all 150ms ease; }
  .btn-primary { background: var(--primary-color); color: #fff; }
  .btn-primary:hover { filter: brightness(1.1); }
  .btn-ghost { background: transparent;
    border: 1.5px solid var(--divider-color);
    color: var(--secondary-text-color); }
  .btn-ghost:hover { border-color: var(--primary-color); color: var(--primary-color); }
  .btn-danger { background: transparent;
    border: 1.5px solid var(--divider-color);
    color: var(--error-color, #db4437); }
  .btn-success { background: var(--success-color, #6daa45); color: #fff; }
  .btn-success:hover { filter: brightness(1.1); }
  .btn-pay { width: 100%; padding: 10px; font-size: 14px; margin-top: 8px;
    background: var(--success-color, #6daa45); color: #fff;
    border: none; border-radius: 10px; font-family: inherit;
    font-weight: 700; cursor: pointer; transition: filter 150ms; }
  .btn-pay:hover { filter: brightness(1.1); }
  .btn-holiday { display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: none; font-family: inherit;
    background: rgba(232,175,52,0.15); color: #c9920a; transition: all 150ms; }
  .btn-holiday.active { background: #c9920a; color: #fff; }

  /* ── Top bar ── */
  .topbar { display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--divider-color); }
  .topbar-title { font-weight: 700; font-size: 15px;
    display: flex; align-items: center; gap: 8px; }
  .topbar-icon { font-size: 20px; }

  /* ── Ledger ── */
  .ledger-item { display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 8px; align-items: center; padding: 10px 0;
    border-bottom: 1px solid var(--divider-color); font-size: 13px; }
  .ledger-item:last-child { border-bottom: none; }
  .ledger-pill { padding: 2px 7px; border-radius: 9999px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .ledger-ts { font-size: 11px; color: var(--secondary-text-color); }
  .amount-cr { color: var(--success-color, #6daa45); font-weight: 700;
    font-variant-numeric: tabular-nums; }
  .amount-dr { color: var(--error-color, #db4437); font-weight: 700;
    font-variant-numeric: tabular-nums; }

  /* ── Empty state ── */
  .empty { text-align: center; padding: 32px 16px;
    color: var(--secondary-text-color); font-size: 13px; }
  .empty-icon { font-size: 32px; margin-bottom: 8px; }

  /* ── Add chore form ── */
  .add-form { background: var(--secondary-background-color);
    border-radius: 10px; padding: 14px; margin-bottom: 10px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin-bottom: 10px; }
  .form-row.full { grid-template-columns: 1fr; }
  .form-group { display: flex; flex-direction: column; gap: 4px; }
  .form-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--secondary-text-color); }
  .form-input, .form-select { background: var(--card-background-color, #fff);
    border: 1.5px solid var(--divider-color); border-radius: 8px;
    padding: 7px 10px; font-size: 16px; color: var(--primary-text-color);
    font-family: inherit; transition: border-color 150ms; width: 100%; }
  .form-input:focus, .form-select:focus {
    outline: none; border-color: var(--primary-color); }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
`;

// ── Avatar colour map ─────────────────────────────────────────────────────────
const COLOUR_MAP = {
  teal: 'var(--primary-color)',
  blue: '#5591c7', purple: '#7c63d1', orange: '#fdab43',
  gold: '#e8af34', green: '#6daa45', red: '#db4437',
  pink: '#e8619a', grey: '#9e9e9e',
};
const CHORE_ICONS = ['🧹','🛏️','🍽️','🐶','🌿','🧺','🚿','📚','🗑️','🧽'];

// ── Helper functions ──────────────────────────────────────────────────────────
function fmtMoney(v, sym = CURRENCY_DEFAULT) {
  return sym + Math.abs(v).toFixed(2);
}
function fmtDate(iso) {
  const d = new Date(iso), now = new Date(), diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Custom element ────────────────────────────────────────────────────────────
class HapmPanelCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._activeChildId = null;
    this._view = 'chores';
    this._showAddForm = false;
    this._holidayMode = false;
    this._children = [];
    // Persisted form state — survives hass re-renders while form is open
    this._formState = { name: '', value: '', recurrence: 'weekly', occurrences: '1', assignMode: 'individual' };
  }

  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this._syncFromHass();
    // ── iOS fix: never re-render while the add form is open.
    // Keyboard / dropdown focus triggers hass updates; destroying the DOM
    // dismisses the keyboard and resets dropdowns instantly on iOS Safari.
    if (this._showAddForm) return;
    this._render();
  }

  _syncFromHass() {
    if (!this._hass) return;
    const states = this._hass.states;
    const children = [];

    for (const [entityId, state] of Object.entries(states)) {
      if (!entityId.startsWith('sensor.') || !entityId.endsWith('_pocket_money_balance')) continue;
      const attrs = state.attributes || {};
      const childEntryId = attrs.entry_id || entityId;
      const childName = attrs.child_name || entityId.replace('sensor.','').replace('_pocket_money_balance','');
      const colour = attrs.avatar_colour || 'teal';
      const currency = attrs.currency || CURRENCY_DEFAULT;
      const balance = parseFloat(state.state) || 0;
      const dueSensorId = entityId.replace('_pocket_money_balance', '_chores_due');
      const dueSensor = states[dueSensorId];
      const dueChores = dueSensor?.attributes?.due_chores || [];
      const lastPaid = attrs.last_paid || null;
      children.push({ childEntryId, childName, colour, currency, balance, dueChores, lastPaid });
    }

    if (children.length) {
      this._children = children;
      if (!this._activeChildId || !children.find(c => c.childEntryId === this._activeChildId)) {
        this._activeChildId = children[0].childEntryId;
      }
    }
  }

  // Snapshot current form field values into _formState before any re-render
  _saveFormState() {
    const sr = this.shadowRoot;
    this._formState = {
      name:       sr.getElementById('af-name')?.value       ?? this._formState.name,
      value:      sr.getElementById('af-value')?.value      ?? this._formState.value,
      recurrence: sr.getElementById('af-recur')?.value      ?? this._formState.recurrence,
      occurrences:sr.getElementById('af-occ')?.value        ?? this._formState.occurrences,
      assignMode: sr.getElementById('af-assign')?.value     ?? this._formState.assignMode,
    };
  }

  async _callService(service, data) {
    if (!this._hass) return;
    try {
      await this._hass.callService('hapm', service, data);
      setTimeout(() => this._render(), 600);
    } catch (e) {
      console.error('HAPM card service error', service, e);
    }
  }

  get _activeChild() {
    return this._children.find(c => c.childEntryId === this._activeChildId) || this._children[0];
  }

  _render() {
    const child = this._activeChild;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card class="hapm">
        ${this._renderTopbar()}
        ${this._renderChildTabs()}
        ${this._renderKPIs(child)}
        ${this._renderNav(child)}
        <div class="panel">
          ${this._view === 'chores' ? this._renderChores(child) : ''}
          ${this._view === 'ledger' ? this._renderLedger() : ''}
        </div>
      </ha-card>
    `;
    this._bindEvents();
  }

  _renderTopbar() {
    return `
      <div class="topbar">
        <div class="topbar-title"><span class="topbar-icon">🐷</span> Pocket Money</div>
        <button class="btn-holiday ${this._holidayMode ? 'active' : ''}" data-action="toggle-holiday">
          🏖 ${this._holidayMode ? 'Holiday Active' : 'Holiday Mode'}
        </button>
      </div>`;
  }

  _renderChildTabs() {
    if (!this._children.length) return '';
    return `<div class="child-tabs">
      ${this._children.map(c => `
        <button class="child-tab ${c.childEntryId === this._activeChildId ? 'active' : ''}"
          data-action="set-child" data-child="${esc(c.childEntryId)}">
          <span class="dot" style="background:${COLOUR_MAP[c.colour] || COLOUR_MAP.teal}"></span>
          ${esc(c.childName)}
          <span style="opacity:0.75;font-size:11px">${fmtMoney(Math.max(0, c.balance), c.currency)}</span>
        </button>`).join('')}
    </div>`;
  }

  _renderKPIs(child) {
    if (!child) return '';
    const dueCount = (child.dueChores || []).length;
    return `<div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">Balance</div>
        <div class="kpi-value ${child.balance > 0 ? 'positive' : ''}">${fmtMoney(child.balance, child.currency)}</div>
        <div class="kpi-sub">Outstanding</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Due Now</div>
        <div class="kpi-value">${dueCount}</div>
        <div class="kpi-sub">chore${dueCount !== 1 ? 's' : ''}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Last Paid</div>
        <div class="kpi-value" style="font-size:14px">${child.lastPaid ? fmtDate(child.lastPaid) : '—'}</div>
        <div class="kpi-sub">&nbsp;</div>
      </div>
    </div>`;
  }

  _renderNav(child) {
    const dueCount = child ? (child.dueChores || []).length : 0;
    return `<div class="nav">
      <button class="nav-btn ${this._view === 'chores' ? 'active' : ''}" data-action="nav" data-view="chores">
        Chores${dueCount ? `<span class="badge">${dueCount}</span>` : ''}
      </button>
      <button class="nav-btn ${this._view === 'ledger' ? 'active' : ''}" data-action="nav" data-view="ledger">
        Ledger
      </button>
    </div>`;
  }

  _renderChores(child) {
    if (!child) return '<div class="empty"><div class="empty-icon">👶</div>No children configured yet.<br>Add a child in Settings → Integrations → HAPM.</div>';
    const chores = child.dueChores || [];
    const addForm = this._showAddForm ? this._renderAddForm() : '';
    const paySection = child.balance > 0 ? `
      <button class="btn-pay" data-action="open-pay">
        💸 Pay ${esc(child.childName)} — ${fmtMoney(child.balance, child.currency)}
      </button>` : '';
    const choreCards = chores.length
      ? chores.map(c => this._renderChoreCard(c, child)).join('')
      : '<div class="empty"><div class="empty-icon">✅</div>All done! No chores due right now.</div>';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <strong style="font-size:13px">Due Chores</strong>
        <button class="btn btn-ghost" data-action="toggle-add-form">
          ${this._showAddForm ? '✕ Cancel' : '+ Add Chore'}
        </button>
      </div>
      ${addForm}${choreCards}${paySection}`;
  }

  _renderChoreCard(c, child) {
    const isMulti = c.occurrences_required > 1;
    const dots = isMulti ? Array.from({ length: c.occurrences_required }, () =>
      '<span class="occ-dot"></span>').join('') : '';
    return `
    <div class="chore-card">
      <div>
        <div class="chore-top">
          <div class="chore-icon">${CHORE_ICONS[Math.abs((c.id || '').charCodeAt(0) || 0) % CHORE_ICONS.length]}</div>
          <div>
            <div class="chore-name">${esc(c.name)}</div>
            ${c.description ? `<div class="chore-desc">${esc(c.description)}</div>` : ''}
            <div class="chore-meta">
              ${c.recurrence !== 'manual' ? `<span class="pill pill-recur">${esc(c.recurrence)}</span>` : ''}
              ${isMulti ? `<span class="pill pill-multi">0/${c.occurrences_required}×</span>` : ''}
              <span class="pill pill-due">Due</span>
            </div>
            ${isMulti ? `<div class="occ-track">${dots}</div>` : ''}
          </div>
        </div>
        <div class="chore-actions">
          ${isMulti
            ? `<button class="btn btn-primary" data-action="log-occ" data-chore="${esc(c.id)}" data-child="${esc(child.childEntryId)}">Log occurrence</button>`
            : `<button class="btn btn-primary" data-action="complete" data-chore="${esc(c.id)}" data-child="${esc(child.childEntryId)}">Mark done ✓</button>`
          }
          <button class="btn btn-ghost" data-action="pause" data-chore="${esc(c.id)}">Pause 7d</button>
        </div>
      </div>
      <div class="chore-value">${fmtMoney(c.value, child.currency)}</div>
    </div>`;
  }

  _renderAddForm() {
    // Restore previously entered values so re-renders don't wipe the form
    const f = this._formState;
    return `
    <div class="add-form">
      <div class="form-row full"><div class="form-group">
        <label class="form-label">Chore Name</label>
        <input class="form-input" id="af-name" type="text" placeholder="e.g. Tidy bedroom"
          value="${esc(f.name)}" autocomplete="off" autocorrect="off" spellcheck="false">
      </div></div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Value (${CURRENCY_DEFAULT})</label>
          <input class="form-input" id="af-value" type="number" inputmode="decimal"
            min="0.01" step="0.01" placeholder="0.50" value="${esc(f.value)}">
        </div>
        <div class="form-group">
          <label class="form-label">Recurrence</label>
          <select class="form-select" id="af-recur">
            <option value="manual"  ${f.recurrence==='manual'  ?'selected':''}>Manual</option>
            <option value="daily"   ${f.recurrence==='daily'   ?'selected':''}>Daily</option>
            <option value="weekly"  ${f.recurrence==='weekly'  ?'selected':''}>Weekly</option>
            <option value="monthly" ${f.recurrence==='monthly' ?'selected':''}>Monthly</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Occurrences</label>
          <input class="form-input" id="af-occ" type="number" inputmode="numeric"
            min="1" value="${esc(f.occurrences)}">
        </div>
        <div class="form-group">
          <label class="form-label">Assignment</label>
          <select class="form-select" id="af-assign">
            <option value="individual" ${f.assignMode==='individual'?'selected':''}>Individual</option>
            <option value="team"       ${f.assignMode==='team'      ?'selected':''}>Team</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" data-action="toggle-add-form">Cancel</button>
        <button class="btn btn-primary" data-action="submit-add-chore">Add Chore</button>
      </div>
    </div>`;
  }

  _renderLedger() {
    return `
      <div style="margin-bottom:10px"><strong style="font-size:13px">Payment Ledger</strong></div>
      <div class="empty" style="padding:16px">
        <div class="empty-icon">📒</div>
        Full ledger available as sensor attribute:<br><br>
        <code style="font-size:11px;background:var(--secondary-background-color);padding:4px 8px;border-radius:6px">
          sensor.&lt;child&gt;_pocket_money_balance → attribute: ledger
        </code>
      </div>`;
  }

  _bindEvents() {
    this.shadowRoot.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', e => this._handleAction(e));
    });
  }

  _handleAction(e) {
    const el = e.currentTarget;
    const action = el.dataset.action;
    switch (action) {
      case 'set-child': this._activeChildId = el.dataset.child; this._render(); break;
      case 'nav': this._view = el.dataset.view; this._render(); break;
      case 'toggle-add-form':
        if (this._showAddForm) {
          // Closing — reset form state
          this._formState = { name: '', value: '', recurrence: 'weekly', occurrences: '1', assignMode: 'individual' };
        }
        this._showAddForm = !this._showAddForm;
        this._render();
        break;
      case 'submit-add-chore': {
        // Always read directly from DOM at submit time
        const sr = this.shadowRoot;
        const name = sr.getElementById('af-name')?.value?.trim();
        const value = parseFloat(sr.getElementById('af-value')?.value);
        const recurrence = sr.getElementById('af-recur')?.value;
        const occurrences = parseInt(sr.getElementById('af-occ')?.value) || 1;
        const assignMode = sr.getElementById('af-assign')?.value;
        if (!name || !value) return;
        this._callService('add_chore', {
          name, value, recurrence, occurrences_required: occurrences,
          assignment_mode: assignMode,
          assigned_to: assignMode === 'team'
            ? this._children.map(c => c.childEntryId)
            : [this._activeChildId],
        });
        this._formState = { name: '', value: '', recurrence: 'weekly', occurrences: '1', assignMode: 'individual' };
        this._showAddForm = false;
        break;
      }
      case 'complete':
        this._callService('complete_chore', { chore_id: el.dataset.chore, child_entry_id: el.dataset.child });
        el.closest('.chore-card')?.classList.add('completing');
        break;
      case 'log-occ':
        this._callService('log_occurrence', { chore_id: el.dataset.chore, child_entry_id: el.dataset.child });
        break;
      case 'pause':
        this._callService('pause_chore', { chore_id: el.dataset.chore, days: 7 });
        break;
      case 'toggle-holiday':
        this._holidayMode = !this._holidayMode;
        this._callService(this._holidayMode ? 'set_holiday_mode' : 'clear_holiday_mode',
          this._holidayMode ? { days: 14 } : {});
        this._render();
        break;
      case 'open-pay': {
        const child = this._activeChild;
        if (!child || child.balance <= 0) return;
        if (confirm(`Pay ${child.childName} ${fmtMoney(child.balance, child.currency)}?`)) {
          this._callService('mark_paid', { child_entry_id: child.childEntryId });
        }
        break;
      }
    }
  }

  getCardSize() { return 6; }
  static getStubConfig() { return {}; }
}

customElements.define('hapm-panel-card', HapmPanelCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'hapm-panel-card',
  name: 'HAPM Pocket Money Panel',
  description: 'Track chores and pocket money balances for your children.',
  preview: false,
  documentationURL: 'https://github.com/LayzeeAutomation/hapm',
});

console.info(
  `%c HAPM PANEL CARD %c v${HAPM_VERSION} `,
  'background:#01696f;color:#fff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:700',
  'background:#eee;color:#333;padding:2px 6px;border-radius:0 4px 4px 0',
);
