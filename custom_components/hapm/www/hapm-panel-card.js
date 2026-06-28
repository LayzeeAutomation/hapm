/**
 * HAPM Pocket Money Panel Card  v0.1.3
 * A self-contained Lovelace custom card for the HAPM integration.
 *
 * Usage in Lovelace:
 *   type: custom:hapm-panel-card
 *
 * iOS fix: the "Add Chore" form is rendered as a document.body modal overlay
 * so it is completely outside the shadow-DOM re-render cycle.
 */

const HAPM_VERSION = '0.1.3';
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

  .child-tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 16px 16px 0; }
  .child-tab { display: flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 9999px;
    border: 1.5px solid var(--divider-color);
    cursor: pointer; font-size: 13px; font-weight: 500;
    background: none; color: var(--primary-text-color); transition: all 150ms ease; }
  .child-tab:hover { border-color: var(--primary-color); color: var(--primary-color); }
  .child-tab.active { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }
  .dot { width: 9px; height: 9px; border-radius: 9999px; flex-shrink: 0; }

  .kpi-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px; padding: 14px 16px; }
  .kpi { background: var(--secondary-background-color); border-radius: 10px; padding: 12px 14px; }
  .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--secondary-text-color); margin-bottom: 4px; }
  .kpi-value { font-size: 22px; font-weight: 700; line-height: 1;
    font-variant-numeric: tabular-nums lining-nums; }
  .kpi-value.positive { color: var(--success-color, #6daa45); }
  .kpi-sub { font-size: 11px; color: var(--secondary-text-color); margin-top: 3px; }

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

  .panel { padding: 14px 16px; }

  .chore-card { background: var(--secondary-background-color);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
    display: grid; grid-template-columns: 1fr auto; gap: 8px;
    align-items: start; transition: opacity 300ms ease; }
  .chore-card.completing { opacity: 0.35; pointer-events: none; }
  .chore-card.optimistic { opacity: 0.6; }
  .chore-top { display: flex; align-items: flex-start; gap: 10px; }
  .chore-icon { width: 34px; height: 34px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; background: var(--card-background-color, #fff); flex-shrink: 0; }
  .chore-name { font-weight: 600; font-size: 13px; line-height: 1.3; }
  .chore-desc { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
  .chore-meta { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
  .pill { display: inline-flex; align-items: center; padding: 2px 7px;
    border-radius: 9999px; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.03em; }
  .pill-due    { background: rgba(109,170,69,0.15); color: var(--success-color,#6daa45); }
  .pill-multi  { background: rgba(124,99,209,0.15); color: #7c63d1; }
  .pill-recur  { background: rgba(85,145,199,0.15);  color: #5591c7; }
  .occ-track { display: flex; gap: 4px; margin-top: 6px; }
  .occ-dot { width: 9px; height: 9px; border-radius: 9999px;
    background: var(--divider-color); border: 1.5px solid var(--secondary-text-color); }
  .chore-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .chore-value { font-weight: 700; font-size: 15px; color: var(--success-color, #6daa45);
    font-variant-numeric: tabular-nums; white-space: nowrap; }

  .btn { display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 8px; font-size: 12px;
    font-weight: 600; cursor: pointer; border: none;
    font-family: inherit; transition: all 150ms ease; }
  .btn-primary { background: var(--primary-color); color: #fff; }
  .btn-primary:hover { filter: brightness(1.1); }
  .btn-ghost { background: transparent; border: 1.5px solid var(--divider-color);
    color: var(--secondary-text-color); }
  .btn-ghost:hover { border-color: var(--primary-color); color: var(--primary-color); }
  .btn-pay { width: 100%; padding: 10px; font-size: 14px; margin-top: 8px;
    background: var(--success-color, #6daa45); color: #fff;
    border: none; border-radius: 10px; font-family: inherit;
    font-weight: 700; cursor: pointer; }
  .btn-holiday { display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: none; font-family: inherit;
    background: rgba(232,175,52,0.15); color: #c9920a; }
  .btn-holiday.active { background: #c9920a; color: #fff; }

  .topbar { display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--divider-color); }
  .topbar-title { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; }

  .empty { text-align: center; padding: 32px 16px;
    color: var(--secondary-text-color); font-size: 13px; }
  .empty-icon { font-size: 32px; margin-bottom: 8px; }
`;

// Modal styles — injected into document.head once, lives outside shadow DOM
const MODAL_STYLES = `
  .hapm-modal-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.55);
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .hapm-modal-backdrop.hidden { display: none; }
  .hapm-modal-sheet {
    background: #fff; width: 100%; max-width: 520px;
    border-radius: 20px 20px 0 0;
    padding: 20px 20px calc(20px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -4px 32px rgba(0,0,0,0.18);
    font-family: -apple-system, 'DM Sans', sans-serif;
    font-size: 14px; color: #111;
  }
  @media (prefers-color-scheme: dark) {
    .hapm-modal-sheet { background: #1c1c1e; color: #f2f2f7; }
    .hapm-modal-input, .hapm-modal-select {
      background: #2c2c2e !important; color: #f2f2f7 !important;
      border-color: #3a3a3c !important;
    }
    .hapm-child-checkbox-row { border-color: #3a3a3c !important; }
    .hapm-modal-btn-cancel { background: #2c2c2e !important; color: #f2f2f7 !important; }
  }
  .hapm-modal-handle { width: 36px; height: 4px; border-radius: 2px;
    background: #ccc; margin: 0 auto 16px; }
  .hapm-modal-title { font-weight: 700; font-size: 17px; margin-bottom: 16px; }
  .hapm-modal-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: #888; margin-bottom: 6px; display: block; }
  .hapm-modal-input, .hapm-modal-select {
    width: 100%; padding: 10px 12px; font-size: 16px;
    border: 1.5px solid #ddd; border-radius: 10px;
    font-family: inherit; background: #f9f9f9; color: #111;
    box-sizing: border-box; margin-bottom: 12px;
    -webkit-appearance: none; appearance: none;
  }
  .hapm-modal-input:focus, .hapm-modal-select:focus {
    outline: none; border-color: #01696f;
  }
  .hapm-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .hapm-modal-row .hapm-modal-input,
  .hapm-modal-row .hapm-modal-select { margin-bottom: 0; }
  .hapm-modal-row-wrap { margin-bottom: 12px; }
  /* Child checkboxes */
  .hapm-children-list { display: flex; flex-direction: column; gap: 0;
    border: 1.5px solid #ddd; border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
  .hapm-child-checkbox-row { display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; cursor: pointer; border-bottom: 1px solid #eee; }
  .hapm-child-checkbox-row:last-child { border-bottom: none; }
  .hapm-child-checkbox-row input[type=checkbox] {
    width: 18px; height: 18px; accent-color: #01696f;
    flex-shrink: 0; cursor: pointer; margin: 0; }
  .hapm-child-checkbox-label { font-size: 15px; font-weight: 500; flex: 1; cursor: pointer; }
  .hapm-child-dot { width: 9px; height: 9px; border-radius: 9999px; flex-shrink: 0; }
  /* Actions */
  .hapm-modal-actions { display: flex; gap: 10px; margin-top: 4px; }
  .hapm-modal-btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 15px;
    font-weight: 700; cursor: pointer; border: none; font-family: inherit; }
  .hapm-modal-btn-cancel { background: #f0f0f0; color: #333; }
  .hapm-modal-btn-submit { background: #01696f; color: #fff; }
`;

// ── Colour / icon maps ───────────────────────────────────────────────────────
const COLOUR_MAP = {
  teal: '#01696f', blue: '#5591c7', purple: '#7c63d1',
  orange: '#fdab43', gold: '#e8af34', green: '#6daa45',
  red: '#db4437', pink: '#e8619a', grey: '#9e9e9e',
};
const CHORE_ICONS = ['🧹','🛏️','🍽️','🐶','🌿','🧺','🚿','📚','🗑️','🧽'];

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// Inject modal styles into document head once
if (!document.getElementById('hapm-modal-styles')) {
  const st = document.createElement('style');
  st.id = 'hapm-modal-styles';
  st.textContent = MODAL_STYLES;
  document.head.appendChild(st);
}

// ── Modal singleton ───────────────────────────────────────────────────────────
let _hapmModal = null;
let _hapmModalCallback = null;

function _buildModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'hapm-modal-backdrop hidden';
  backdrop.id = 'hapm-add-chore-modal';
  backdrop.innerHTML = `
    <div class="hapm-modal-sheet" id="hapm-modal-sheet">
      <div class="hapm-modal-handle"></div>
      <div class="hapm-modal-title">➕ Add Chore</div>

      <label class="hapm-modal-label">Chore Name</label>
      <input class="hapm-modal-input" id="hm-name" type="text"
        placeholder="e.g. Tidy bedroom"
        autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false">

      <div class="hapm-modal-row hapm-modal-row-wrap">
        <div>
          <label class="hapm-modal-label">Value (${CURRENCY_DEFAULT})</label>
          <input class="hapm-modal-input" id="hm-value" type="number"
            inputmode="decimal" min="0.01" step="0.01" placeholder="0.50">
        </div>
        <div>
          <label class="hapm-modal-label">Recurrence</label>
          <select class="hapm-modal-select" id="hm-recur">
            <option value="manual">Manual</option>
            <option value="daily">Daily</option>
            <option value="weekly" selected>Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <label class="hapm-modal-label">Occurrences</label>
      <input class="hapm-modal-input" id="hm-occ" type="number"
        inputmode="numeric" min="1" value="1">

      <label class="hapm-modal-label">Assign To</label>
      <div class="hapm-children-list" id="hm-children-list"></div>

      <div class="hapm-modal-actions">
        <button class="hapm-modal-btn hapm-modal-btn-cancel" id="hm-cancel">Cancel</button>
        <button class="hapm-modal-btn hapm-modal-btn-submit" id="hm-submit">Add Chore</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', e => { if (e.target === backdrop) _closeModal(); });
  document.getElementById('hm-cancel').addEventListener('click', _closeModal);
  document.getElementById('hm-submit').addEventListener('click', _submitModal);

  return backdrop;
}

function _getModal() {
  if (!_hapmModal) _hapmModal = _buildModal();
  return _hapmModal;
}

function _submitModal() {
  const name  = document.getElementById('hm-name').value.trim();
  const value = parseFloat(document.getElementById('hm-value').value);
  const recur = document.getElementById('hm-recur').value;
  const occ   = parseInt(document.getElementById('hm-occ').value) || 1;

  // Collect checked child IDs
  const checked = [...document.querySelectorAll('#hm-children-list input[type=checkbox]:checked')];
  const assignedTo = checked.map(cb => cb.value);

  if (!name || !value) { document.getElementById('hm-name').focus(); return; }
  if (!assignedTo.length) { return; }  // must have at least one child selected

  if (_hapmModalCallback) _hapmModalCallback({ name, value, recur, occ, assignedTo });
  _closeModal();
}

function _openModal(children, activeChildId, callback) {
  const modal = _getModal();

  // Reset fields
  document.getElementById('hm-name').value  = '';
  document.getElementById('hm-value').value = '';
  document.getElementById('hm-recur').value = 'weekly';
  document.getElementById('hm-occ').value   = '1';

  // Rebuild child checkboxes from live children list
  const list = document.getElementById('hm-children-list');
  list.innerHTML = children.map(c => `
    <label class="hapm-child-checkbox-row">
      <input type="checkbox" value="${esc(c.childEntryId)}"
        ${c.childEntryId === activeChildId ? 'checked' : ''}>
      <span class="hapm-child-dot" style="background:${COLOUR_MAP[c.colour] || COLOUR_MAP.teal}"></span>
      <span class="hapm-child-checkbox-label">${esc(c.childName)}</span>
    </label>
  `).join('');

  _hapmModalCallback = callback;
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('hm-name').focus(), 80);
}

function _closeModal() {
  _getModal().classList.add('hidden');
  _hapmModalCallback = null;
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
    this._holidayMode = false;
    this._children = [];
    // Optimistic chores: keyed by childEntryId, cleared when sensor updates
    this._optimisticChores = {};
  }

  setConfig(config) { this._config = config; }

  set hass(hass) {
    this._hass = hass;
    this._syncFromHass();
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
      const serverChores = states[dueSensorId]?.attributes?.due_chores || [];

      // Merge optimistic chores: keep optimistic ones not yet in server list
      const optimistic = (this._optimisticChores[childEntryId] || []).filter(
        o => !serverChores.find(s => s.name === o.name)
      );
      // Once server has caught up with all optimistic, clear them
      if (!optimistic.length) delete this._optimisticChores[childEntryId];

      const dueChores = [...serverChores, ...optimistic];
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

  async _callService(service, data) {
    if (!this._hass) return;
    try {
      await this._hass.callService('hapm', service, data);
      // Wait 2s for sensor to update then re-sync
      setTimeout(() => {
        this._syncFromHass();
        this._render();
      }, 2000);
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
        <div class="topbar-title"><span style="font-size:20px">🐷</span> Pocket Money</div>
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
        <button class="btn btn-ghost" data-action="open-add-form">+ Add Chore</button>
      </div>
      ${choreCards}${paySection}`;
  }

  _renderChoreCard(c, child) {
    const isMulti = c.occurrences_required > 1;
    const isOptimistic = !!c._optimistic;
    const dots = isMulti ? Array.from({ length: c.occurrences_required }, () =>
      '<span class="occ-dot"></span>').join('') : '';
    return `
    <div class="chore-card${isOptimistic ? ' optimistic' : ''}">
      <div>
        <div class="chore-top">
          <div class="chore-icon">${CHORE_ICONS[Math.abs((c.id || c.name || '').charCodeAt(0) || 0) % CHORE_ICONS.length]}</div>
          <div>
            <div class="chore-name">${esc(c.name)}${isOptimistic ? ' <span style="font-size:10px;opacity:0.5">(saving…)</span>' : ''}</div>
            ${c.description ? `<div class="chore-desc">${esc(c.description)}</div>` : ''}
            <div class="chore-meta">
              ${c.recurrence && c.recurrence !== 'manual' ? `<span class="pill pill-recur">${esc(c.recurrence)}</span>` : ''}
              ${isMulti ? `<span class="pill pill-multi">0/${c.occurrences_required}×</span>` : ''}
              ${!isOptimistic ? '<span class="pill pill-due">Due</span>' : ''}
            </div>
            ${isMulti ? `<div class="occ-track">${dots}</div>` : ''}
          </div>
        </div>
        ${!isOptimistic ? `<div class="chore-actions">
          ${isMulti
            ? `<button class="btn btn-primary" data-action="log-occ" data-chore="${esc(c.id)}" data-child="${esc(child.childEntryId)}">Log occurrence</button>`
            : `<button class="btn btn-primary" data-action="complete" data-chore="${esc(c.id)}" data-child="${esc(child.childEntryId)}">Mark done ✓</button>`
          }
          <button class="btn btn-ghost" data-action="pause" data-chore="${esc(c.id)}">Pause 7d</button>
        </div>` : ''}
      </div>
      <div class="chore-value">${fmtMoney(c.value, child.currency)}</div>
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
      case 'set-child':
        this._activeChildId = el.dataset.child;
        this._render();
        break;
      case 'nav':
        this._view = el.dataset.view;
        this._render();
        break;
      case 'open-add-form':
        _openModal(this._children, this._activeChildId, ({ name, value, recur, occ, assignedTo }) => {
          // Optimistically add chore to each assigned child immediately
          const optimisticChore = {
            id: '_opt_' + Date.now(),
            name, value, recurrence: recur,
            occurrences_required: occ,
            _optimistic: true,
          };
          assignedTo.forEach(childId => {
            if (!this._optimisticChores[childId]) this._optimisticChores[childId] = [];
            this._optimisticChores[childId].push(optimisticChore);
          });
          this._syncFromHass();
          this._render();

          // Call the service
          this._callService('add_chore', {
            name, value,
            recurrence: recur,
            occurrences_required: occ,
            assignment_mode: assignedTo.length === this._children.length ? 'team' : 'individual',
            assigned_to: assignedTo,
          });
        });
        break;
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
        this._callService(
          this._holidayMode ? 'set_holiday_mode' : 'clear_holiday_mode',
          this._holidayMode ? { days: 14 } : {}
        );
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
