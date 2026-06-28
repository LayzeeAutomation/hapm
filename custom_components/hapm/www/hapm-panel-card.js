/**
 * HAPM Pocket Money Panel Card  v0.1.9
 * All modals live inside the Shadow DOM — no document.body or confirm() calls.
 */

const HAPM_VERSION = '0.1.9';
const CURRENCY_DEFAULT = '£';
const OPTIMISTIC_TTL_MS = 15000;

const COLOUR_MAP = {
  teal: '#01696f', blue: '#5591c7', purple: '#7c63d1',
  orange: '#fdab43', gold: '#e8af34', green: '#6daa45',
  red: '#db4437', pink: '#e8619a', grey: '#9e9e9e',
};
const CHORE_ICONS = ['🧹','🛏️','🍽️','🐶','🌿','🧺','🚿','📚','🗑️','🧽'];

function fmtMoney(v, sym = CURRENCY_DEFAULT) { return sym + Math.abs(v).toFixed(2); }
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
function daysRemaining(isoUntil) {
  const diff = new Date(isoUntil) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

const BASE_STYLES = `
  :host { display: block; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Card chrome ── */
  .hapm { font-family: var(--primary-font-family, 'DM Sans', sans-serif);
    font-size: 14px; color: var(--primary-text-color);
    background: var(--ha-card-background, var(--card-background-color));
    border-radius: var(--ha-card-border-radius, 12px); overflow: hidden;
    position: relative; }

  /* ── Topbar ── */
  .topbar { display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--divider-color); }
  .topbar-title { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; }
  .btn-holiday { display: flex; align-items: center; gap: 6px; padding: 6px 12px;
    border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none;
    font-family: inherit; background: rgba(232,175,52,0.15); color: #c9920a;
    transition: all 150ms ease; }
  .btn-holiday.active { background: #c9920a; color: #fff; }

  /* ── Child tabs ── */
  .child-tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 16px 16px 0; }
  .child-tab { display: flex; align-items: center; gap: 6px; padding: 6px 14px;
    border-radius: 9999px; border: 1.5px solid var(--divider-color); cursor: pointer;
    font-size: 13px; font-weight: 500; background: none; color: var(--primary-text-color);
    font-family: inherit; transition: all 150ms ease; }
  .child-tab:hover { border-color: var(--primary-color); color: var(--primary-color); }
  .child-tab.active { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }
  .dot { width: 9px; height: 9px; border-radius: 9999px; flex-shrink: 0; }

  /* ── KPIs ── */
  .kpi-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px; padding: 14px 16px; }
  .kpi { background: var(--secondary-background-color); border-radius: 10px; padding: 12px 14px; }
  .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--secondary-text-color); margin-bottom: 4px; }
  .kpi-value { font-size: 22px; font-weight: 700; line-height: 1;
    font-variant-numeric: tabular-nums lining-nums; }
  .kpi-value.positive { color: var(--success-color, #6daa45); }
  .kpi-sub { font-size: 11px; color: var(--secondary-text-color); margin-top: 3px; }

  /* ── Nav tabs ── */
  .nav { display: flex; gap: 4px; padding: 0 16px;
    border-bottom: 1px solid var(--divider-color); }
  .nav-btn { padding: 10px 14px; font-size: 13px; font-weight: 500; background: none; border: none;
    border-bottom: 2px solid transparent; color: var(--secondary-text-color); cursor: pointer;
    font-family: inherit; transition: all 150ms ease; margin-bottom: -1px; }
  .nav-btn:hover { color: var(--primary-text-color); }
  .nav-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
  .badge { display: inline-flex; align-items: center; justify-content: center;
    background: var(--primary-color); color: #fff; border-radius: 9999px;
    font-size: 10px; font-weight: 700; padding: 1px 6px; margin-left: 4px; }

  /* ── Panel / chore cards ── */
  .panel { padding: 14px 16px; }
  .chore-card { background: var(--secondary-background-color); border-radius: 10px;
    padding: 12px 14px; margin-bottom: 10px; display: grid;
    grid-template-columns: 1fr auto; gap: 8px; align-items: start;
    transition: opacity 300ms ease; }
  .chore-card.completing { opacity: 0.35; pointer-events: none; }
  .chore-card.optimistic { opacity: 0.6; }
  .chore-top { display: flex; align-items: flex-start; gap: 10px; }
  .chore-icon { width: 34px; height: 34px; border-radius: 8px; display: flex;
    align-items: center; justify-content: center; font-size: 18px;
    background: var(--card-background-color, #fff); flex-shrink: 0; }
  .chore-name { font-weight: 600; font-size: 13px; line-height: 1.3; }
  .chore-desc { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
  .chore-meta { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
  .pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 9999px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
  .pill-due { background: rgba(109,170,69,0.15); color: var(--success-color,#6daa45); }
  .pill-multi { background: rgba(124,99,209,0.15); color: #7c63d1; }
  .pill-recur { background: rgba(85,145,199,0.15); color: #5591c7; }
  .occ-track { display: flex; gap: 4px; margin-top: 6px; }
  .occ-dot { width: 9px; height: 9px; border-radius: 9999px;
    background: var(--divider-color); border: 1.5px solid var(--secondary-text-color); }
  .chore-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .chore-value { font-weight: 700; font-size: 15px; color: var(--success-color, #6daa45);
    font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* ── Buttons ── */
  .btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px;
    border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none;
    font-family: inherit; transition: all 150ms ease; }
  .btn-primary { background: var(--primary-color); color: #fff; }
  .btn-primary:hover { filter: brightness(1.1); }
  .btn-ghost { background: transparent; border: 1.5px solid var(--divider-color);
    color: var(--secondary-text-color); }
  .btn-ghost:hover { border-color: var(--primary-color); color: var(--primary-color); }
  .btn-pay { width: 100%; padding: 10px; font-size: 14px; margin-top: 8px;
    background: var(--success-color, #6daa45); color: #fff; border: none;
    border-radius: 10px; font-family: inherit; font-weight: 700; cursor: pointer; }

  /* ── Empty states ── */
  .empty { text-align: center; padding: 32px 16px;
    color: var(--secondary-text-color); font-size: 13px; }
  .empty-icon { font-size: 32px; margin-bottom: 8px; }

  /* ══════════════════════════════════════════════
     MODAL SYSTEM  — lives inside Shadow DOM
     ══════════════════════════════════════════════ */
  .hapm-backdrop { position: absolute; inset: 0; z-index: 100;
    background: rgba(0,0,0,0.52);
    display: flex; align-items: flex-end; justify-content: center;
    border-radius: inherit; overflow: hidden; }
  .hapm-backdrop.hidden { display: none; }
  .hapm-sheet { background: var(--card-background-color, #fff);
    color: var(--primary-text-color);
    width: 100%; border-radius: 20px 20px 0 0;
    padding: 20px 20px 24px;
    box-shadow: 0 -4px 32px rgba(0,0,0,0.22);
    max-height: 90%; overflow-y: auto; }
  .hapm-handle { width: 36px; height: 4px; border-radius: 2px;
    background: var(--divider-color, #ccc); margin: 0 auto 16px; }
  .hapm-sheet-title { font-weight: 700; font-size: 17px; margin-bottom: 16px; }
  .hapm-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--secondary-text-color); margin-bottom: 6px;
    display: block; }
  .hapm-input, .hapm-select {
    width: 100%; padding: 10px 12px; font-size: 16px;
    border: 1.5px solid var(--divider-color, #ddd); border-radius: 10px;
    font-family: inherit; background: var(--secondary-background-color);
    color: var(--primary-text-color); margin-bottom: 12px;
    -webkit-appearance: none; appearance: none; }
  .hapm-input:focus, .hapm-select:focus { outline: none; border-color: #01696f; }
  .hapm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin-bottom: 12px; }
  .hapm-row .hapm-input, .hapm-row .hapm-select { margin-bottom: 0; }
  .hapm-children-list { display: flex; flex-direction: column;
    border: 1.5px solid var(--divider-color, #ddd); border-radius: 10px;
    overflow: hidden; margin-bottom: 12px; }
  .hapm-child-row { display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; cursor: pointer;
    border-bottom: 1px solid var(--divider-color, #eee); }
  .hapm-child-row:last-child { border-bottom: none; }
  .hapm-child-row input[type=checkbox] { width: 18px; height: 18px;
    accent-color: #01696f; flex-shrink: 0; cursor: pointer; margin: 0; }
  .hapm-child-row span.name { font-size: 15px; font-weight: 500; flex: 1; }
  .hapm-child-dot { width: 9px; height: 9px; border-radius: 9999px; flex-shrink: 0; }
  .hapm-actions { display: flex; gap: 10px; margin-top: 4px; }
  .hapm-btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 15px;
    font-weight: 700; cursor: pointer; border: none; font-family: inherit; }
  .hapm-btn-cancel { background: var(--secondary-background-color);
    color: var(--primary-text-color); }
  .hapm-btn-ok { background: #01696f; color: #fff; }
  .hapm-btn-danger { background: #db4437; color: #fff; }
  .hapm-window-row { display: none; margin-bottom: 12px; }
  .hapm-window-row.visible { display: block; }
  .hapm-confirm-msg { font-size: 15px; line-height: 1.5;
    margin-bottom: 20px; text-align: center; }
`;

class HapmPanelCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._activeChildId = null;
    this._view = 'chores';
    this._holidayUntil = null;
    this._children = [];
    this._optimisticChores = {};
  }

  setConfig(config) { this._config = config; }

  set hass(hass) {
    this._hass = hass;
    this._syncFromHass();
    this._render();
  }

  // ── Data sync ──────────────────────────────────────────────────────────────
  _syncFromHass() {
    if (!this._hass) return;
    const now = Date.now();
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
      const attrs = state.attributes || {};
      const childEntryId = attrs.entry_id || entityId;
      const childName    = attrs.child_name || entityId.replace('sensor.','').replace('_pocket_money_balance','');
      const colour       = attrs.avatar_colour || 'teal';
      const currency     = attrs.currency || CURRENCY_DEFAULT;
      const balance      = parseFloat(state.state) || 0;
      const dueSensorId  = entityId.replace('_pocket_money_balance', '_chores_due');
      const serverChores = states[dueSensorId]?.attributes?.due_chores || [];
      const lastPaid     = attrs.last_paid || null;
      const optimistic   = this._optimisticChores[childEntryId] || [];
      children.push({ childEntryId, childName, colour, currency, balance,
                       dueChores: [...serverChores, ...optimistic], lastPaid });
    }

    if (children.length) {
      this._children = children;
      if (!this._activeChildId || !children.find(c => c.childEntryId === this._activeChildId))
        this._activeChildId = children[0].childEntryId;
    }
  }

  async _callService(service, data) {
    if (!this._hass) return;
    try { await this._hass.callService('hapm', service, data); }
    catch (e) { console.error('HAPM service error', service, e); }
  }

  get _activeChild() {
    return this._children.find(c => c.childEntryId === this._activeChildId) || this._children[0];
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  _render() {
    const child = this._activeChild;
    this.shadowRoot.innerHTML = `
      <style>${BASE_STYLES}</style>
      <ha-card class="hapm">
        ${this._renderTopbar()}
        ${this._renderChildTabs()}
        ${this._renderKPIs(child)}
        ${this._renderNav(child)}
        <div class="panel">
          ${this._view === 'chores' ? this._renderChores(child) : this._renderLedger()}
        </div>
        ${this._renderModals(child)}
      </ha-card>`;
    this._bindEvents();
  }

  _renderTopbar() {
    const active = this._holidayUntil && new Date(this._holidayUntil) > new Date();
    const label  = active ? `🏖 Holiday — ${daysRemaining(this._holidayUntil)}d left` : '🏖 Holiday Mode';
    return `<div class="topbar">
      <div class="topbar-title"><span style="font-size:20px">🐷</span> Pocket Money</div>
      <button class="btn-holiday${active ? ' active' : ''}" data-action="toggle-holiday">${label}</button>
    </div>`;
  }

  _renderChildTabs() {
    if (!this._children.length) return '';
    return `<div class="child-tabs">${this._children.map(c => `
      <button class="child-tab${c.childEntryId === this._activeChildId ? ' active' : ''}"
        data-action="set-child" data-child="${esc(c.childEntryId)}">
        <span class="dot" style="background:${COLOUR_MAP[c.colour] || COLOUR_MAP.teal}"></span>
        ${esc(c.childName)}
        <span style="opacity:0.75;font-size:11px">${fmtMoney(Math.max(0, c.balance), c.currency)}</span>
      </button>`).join('')}</div>`;
  }

  _renderKPIs(child) {
    if (!child) return '';
    const n = (child.dueChores || []).length;
    return `<div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">Balance</div>
        <div class="kpi-value${child.balance > 0 ? ' positive' : ''}">${fmtMoney(child.balance, child.currency)}</div>
        <div class="kpi-sub">Outstanding</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Due Now</div>
        <div class="kpi-value">${n}</div>
        <div class="kpi-sub">chore${n !== 1 ? 's' : ''}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Last Paid</div>
        <div class="kpi-value" style="font-size:14px">${child.lastPaid ? fmtDate(child.lastPaid) : '—'}</div>
        <div class="kpi-sub">&nbsp;</div>
      </div>
    </div>`;
  }

  _renderNav(child) {
    const n = child ? (child.dueChores || []).length : 0;
    return `<div class="nav">
      <button class="nav-btn${this._view === 'chores' ? ' active' : ''}" data-action="nav" data-view="chores">
        Chores${n ? `<span class="badge">${n}</span>` : ''}
      </button>
      <button class="nav-btn${this._view === 'ledger' ? ' active' : ''}" data-action="nav" data-view="ledger">Ledger</button>
    </div>`;
  }

  _renderChores(child) {
    if (!child) return `<div class="empty"><div class="empty-icon">👶</div>No children configured yet.<br>Add a child in Settings → Integrations → HAPM.</div>`;
    const chores = child.dueChores || [];
    const payBtn = child.balance > 0
      ? `<button class="btn-pay" data-action="open-pay">💸 Pay ${esc(child.childName)} — ${fmtMoney(child.balance, child.currency)}</button>`
      : '';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <strong style="font-size:13px">Due Chores</strong>
        <button class="btn btn-ghost" data-action="open-add-form">+ Add Chore</button>
      </div>
      ${chores.length ? chores.map(c => this._renderChoreCard(c, child)).join('') : '<div class="empty"><div class="empty-icon">✅</div>All done! No chores due right now.</div>'}
      ${payBtn}`;
  }

  _renderChoreCard(c, child) {
    const isMulti = c.occurrences_required > 1;
    const isOpt   = !!c._optimistic;
    return `<div class="chore-card${isOpt ? ' optimistic' : ''}">
      <div>
        <div class="chore-top">
          <div class="chore-icon">${CHORE_ICONS[Math.abs((c.id || c.name || '').charCodeAt(0) || 0) % CHORE_ICONS.length]}</div>
          <div>
            <div class="chore-name">${esc(c.name)}${isOpt ? ' <span style="font-size:10px;opacity:0.5">(saving…)</span>' : ''}</div>
            ${c.description ? `<div class="chore-desc">${esc(c.description)}</div>` : ''}
            <div class="chore-meta">
              ${c.recurrence && c.recurrence !== 'manual' ? `<span class="pill pill-recur">${esc(c.recurrence)}</span>` : ''}
              ${isMulti ? `<span class="pill pill-multi">0/${c.occurrences_required}×</span>` : ''}
              ${!isOpt ? '<span class="pill pill-due">Due</span>' : ''}
            </div>
            ${isMulti ? `<div class="occ-track">${Array.from({length:c.occurrences_required},()=>'<span class="occ-dot"></span>').join('')}</div>` : ''}
          </div>
        </div>
        ${!isOpt ? `<div class="chore-actions">
          ${isMulti
            ? `<button class="btn btn-primary" data-action="log-occ" data-chore="${esc(c.id)}" data-child="${esc(child.childEntryId)}">Log occurrence</button>`
            : `<button class="btn btn-primary" data-action="complete" data-chore="${esc(c.id)}" data-child="${esc(child.childEntryId)}">Mark done ✓</button>`}
          <button class="btn btn-ghost" data-action="pause" data-chore="${esc(c.id)}">Pause 7d</button>
        </div>` : ''}
      </div>
      <div class="chore-value">${fmtMoney(c.value, child.currency)}</div>
    </div>`;
  }

  _renderLedger() {
    return `<div style="margin-bottom:10px"><strong style="font-size:13px">Payment Ledger</strong></div>
      <div class="empty" style="padding:16px"><div class="empty-icon">📒</div>
        Full ledger available as sensor attribute:<br><br>
        <code style="font-size:11px;background:var(--secondary-background-color);padding:4px 8px;border-radius:6px">
          sensor.&lt;child&gt;_pocket_money_balance → attribute: ledger
        </code>
      </div>`;
  }

  // ── Modals (all inside Shadow DOM) ─────────────────────────────────────────
  _renderModals(child) {
    const childOptions = this._children.map(c => `
      <label class="hapm-child-row">
        <input type="checkbox" value="${esc(c.childEntryId)}"
          ${c.childEntryId === this._activeChildId ? 'checked' : ''}>
        <span class="hapm-child-dot" style="background:${COLOUR_MAP[c.colour] || COLOUR_MAP.teal}"></span>
        <span class="name">${esc(c.childName)}</span>
      </label>`).join('');

    const payLabel = child
      ? `Pay ${esc(child.childName)} ${fmtMoney(child.balance, child.currency)}?`
      : '';

    return `
    <!-- Add Chore modal -->
    <div class="hapm-backdrop hidden" id="modal-add">
      <div class="hapm-sheet">
        <div class="hapm-handle"></div>
        <div class="hapm-sheet-title">➕ Add Chore</div>
        <label class="hapm-label">Chore Name</label>
        <input class="hapm-input" id="m-name" type="text" placeholder="e.g. Tidy bedroom"
          autocomplete="off" autocorrect="off" autocapitalize="sentences">
        <div class="hapm-row">
          <div>
            <label class="hapm-label">Value (£)</label>
            <input class="hapm-input" id="m-value" type="number"
              inputmode="decimal" min="0.01" step="0.01" placeholder="0.50">
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
        <label class="hapm-label">Occurrences needed</label>
        <input class="hapm-input" id="m-occ" type="number" inputmode="numeric" min="1" value="1">
        <div class="hapm-window-row" id="m-window-row">
          <label class="hapm-label">Completion window (days)</label>
          <input class="hapm-input" id="m-window" type="number" inputmode="numeric" min="1" placeholder="e.g. 7">
        </div>
        <label class="hapm-label">Assign To</label>
        <div class="hapm-children-list">${childOptions}</div>
        <div class="hapm-actions">
          <button class="hapm-btn hapm-btn-cancel" data-action="modal-cancel" data-modal="modal-add">Cancel</button>
          <button class="hapm-btn hapm-btn-ok" data-action="submit-add">Add Chore</button>
        </div>
      </div>
    </div>

    <!-- Holiday modal -->
    <div class="hapm-backdrop hidden" id="modal-holiday">
      <div class="hapm-sheet">
        <div class="hapm-handle"></div>
        <div class="hapm-sheet-title">🏖 Holiday Mode</div>
        <label class="hapm-label">How many days are you away?</label>
        <input class="hapm-input" id="m-holiday-days" type="number"
          inputmode="numeric" min="1" max="365" value="7">
        <div class="hapm-actions">
          <button class="hapm-btn hapm-btn-cancel" data-action="modal-cancel" data-modal="modal-holiday">Cancel</button>
          <button class="hapm-btn hapm-btn-ok" data-action="submit-holiday">Start Holiday</button>
        </div>
      </div>
    </div>

    <!-- Pay confirm modal -->
    <div class="hapm-backdrop hidden" id="modal-pay">
      <div class="hapm-sheet">
        <div class="hapm-handle"></div>
        <div class="hapm-sheet-title">💸 Confirm Payment</div>
        <div class="hapm-confirm-msg">${payLabel}</div>
        <div class="hapm-actions">
          <button class="hapm-btn hapm-btn-cancel" data-action="modal-cancel" data-modal="modal-pay">Cancel</button>
          <button class="hapm-btn hapm-btn-ok" data-action="submit-pay">Confirm Pay</button>
        </div>
      </div>
    </div>`;
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  _bindEvents() {
    this.shadowRoot.querySelectorAll('[data-action]').forEach(el =>
      el.addEventListener('click', e => this._handleAction(e))
    );
    // Occurrence field → show/hide window row
    const occInput = this.shadowRoot.getElementById('m-occ');
    if (occInput) {
      occInput.addEventListener('input', () => {
        const occ = parseInt(occInput.value) || 1;
        const row = this.shadowRoot.getElementById('m-window-row');
        const win = this.shadowRoot.getElementById('m-window');
        row.classList.toggle('visible', occ > 1);
        if (occ > 1) win.value = occ * 7;
      });
    }
  }

  _sr(id) { return this.shadowRoot.getElementById(id); }

  _openModal(id) { this._sr(id)?.classList.remove('hidden'); }
  _closeModal(id) { this._sr(id)?.classList.add('hidden'); }

  _handleAction(e) {
    const el = e.currentTarget;
    const action = el.dataset.action;

    switch (action) {

      case 'set-child':
        this._activeChildId = el.dataset.child;
        this._render(); break;

      case 'nav':
        this._view = el.dataset.view;
        this._render(); break;

      case 'modal-cancel':
        this._closeModal(el.dataset.modal); break;

      // ── Add chore ──
      case 'open-add-form':
        this._openModal('modal-add');
        setTimeout(() => this._sr('m-name')?.focus(), 80);
        break;

      case 'submit-add': {
        const name  = this._sr('m-name')?.value.trim();
        const value = parseFloat(this._sr('m-value')?.value);
        const recur = this._sr('m-recur')?.value || 'manual';
        const occ   = parseInt(this._sr('m-occ')?.value) || 1;
        const winDays = occ > 1 ? (parseInt(this._sr('m-window')?.value) || occ * 7) : null;
        const assigned = [...this.shadowRoot.querySelectorAll('.hapm-children-list input[type=checkbox]:checked')]
          .map(cb => cb.value);
        if (!name || !value || !assigned.length) return;
        this._closeModal('modal-add');
        const expiresAt = Date.now() + OPTIMISTIC_TTL_MS;
        assigned.forEach(childId => {
          if (!this._optimisticChores[childId]) this._optimisticChores[childId] = [];
          this._optimisticChores[childId].push({
            id: '_opt_' + Date.now(), name, value, recurrence: recur,
            occurrences_required: occ, _optimistic: true, _expiresAt: expiresAt,
          });
        });
        this._syncFromHass(); this._render();
        const svcData = { name, value, recurrence: recur, occurrences_required: occ,
          assignment_mode: assigned.length === this._children.length ? 'team' : 'individual',
          assigned_to: assigned };
        if (winDays) svcData.occurrence_window_days = winDays;
        this._callService('add_chore', svcData);
        break;
      }

      // ── Chore actions ──
      case 'complete':
        el.closest('.chore-card')?.classList.add('completing');
        this._callService('complete_chore', { chore_id: el.dataset.chore, child_entry_id: el.dataset.child });
        break;

      case 'log-occ':
        this._callService('log_occurrence', { chore_id: el.dataset.chore, child_entry_id: el.dataset.child });
        break;

      case 'pause':
        this._callService('pause_chore', { chore_id: el.dataset.chore, days: 7 });
        break;

      // ── Holiday ──
      case 'toggle-holiday': {
        const active = this._holidayUntil && new Date(this._holidayUntil) > new Date();
        if (active) {
          this._holidayUntil = null;
          this._callService('clear_holiday_mode', {});
          this._render();
        } else {
          this._openModal('modal-holiday');
          setTimeout(() => this._sr('m-holiday-days')?.focus(), 80);
        }
        break;
      }

      case 'submit-holiday': {
        const days = parseInt(this._sr('m-holiday-days')?.value) || 7;
        this._closeModal('modal-holiday');
        const until = new Date();
        until.setDate(until.getDate() + days);
        this._holidayUntil = until.toISOString();
        this._callService('set_holiday_mode', { days });
        this._render();
        break;
      }

      // ── Pay ──
      case 'open-pay': {
        const child = this._activeChild;
        if (!child || child.balance <= 0) return;
        this._openModal('modal-pay');
        break;
      }

      case 'submit-pay': {
        const child = this._activeChild;
        this._closeModal('modal-pay');
        if (child) this._callService('mark_paid', { child_entry_id: child.childEntryId });
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
