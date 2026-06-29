# 🐷 Home Assistant Pocket Money (HAPM)

> A HACS-compatible custom integration for Home Assistant that turns chore tracking into a fully auditable pocket money system for your children — no third-party apps, no subscriptions, everything running locally inside your smart home.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
![Version](https://img.shields.io/badge/version-0.1.22-blue)
![HA Version](https://img.shields.io/badge/HA-%3E%3D2024.7-brightgreen)
![Licence](https://img.shields.io/badge/licence-MIT-lightgrey)

---

<!-- SCREENSHOT: Full card overview showing two child tabs, KPI row (balance / chores due / last paid), and the Chores panel with several due chore cards visible. Suggested filename: docs/screenshots/overview.png -->
> 📸 *Screenshot placeholder — `docs/screenshots/overview.png`*
> **What to capture:** The full HAPM card showing the child tab switcher at the top, the three KPI tiles (Balance, Due Now, Last Paid), and at least two or three chore cards in the Chores tab.

---

## ✨ Features

- 👶 **Multiple children** — each child is a separate config entry with their own live balance sensor and chore list
- 🎨 **Chore categories** — 16 categories (Bedroom, Kitchen, Garden, Homework, Pet Care …) each with a unique emoji, selectable per chore
- ✅ **Chore management** — add, edit and delete chores with a name, description, value, recurrence and category
- 🔄 **Recurring schedules** — Daily, Weekly, Monthly or Manual trigger, with configurable intervals
- 📊 **Multi-occurrence chores** — e.g. "read for 20 minutes, 5 times this week" tracked with progress dots; pay per-occurrence or all-at-once on completion
- 👥 **Team chores** — assign one chore to multiple children working towards a shared occurrence target, with full-value or equally-split pay
- 💰 **Running balance** — every credit and payment event is written to a persistent ledger
- 📒 **Ledger tab** — full transaction history in the card showing event type, chore name, amount (green/red), timestamp and running balance column
- 💳 **Mark paid** — clear a child's balance in one tap when you hand over the cash; a payment event is written automatically
- ⏸️ **Pause & resume** — pause individual chores for N days or indefinitely; resume early at any time
- 🏖️ **Holiday Mode** — suspends all chores for N days and slides due dates forward automatically
- 🔔 **Persistent notifications** — HA fires a notification when a recurring chore falls due
- 🤖 **Automation-friendly** — fires `hapm_chore_due` events on the HA event bus for use in any automation
- 🎨 **Bundled Lovelace card** — fully interactive panel card, auto-registered on install — no manual resource steps

---

## 📦 Installation

### HACS (recommended)

1. In HACS → **Integrations** → ⋮ menu → **Custom repositories**, paste `https://github.com/LayzeeAutomation/hapm` and set type **Integration**
2. Search for **Home Assistant Pocket Money** and click **Download**
3. Restart Home Assistant
4. Go to **Settings → Integrations → + Add integration** and search for **Home Assistant Pocket Money**
5. Add one entry per child (name, avatar colour, currency symbol)

> The Lovelace card (`hapm-panel-card.js`) is served from `/hapm_static/` and registered as a Lovelace module resource automatically on startup — no manual file copy or resource configuration required.

### Manual install

1. Copy the `custom_components/hapm/` folder into your HA `config/custom_components/` directory
2. Restart Home Assistant
3. Add the integration via **Settings → Integrations** as above

---

## 🛠️ Setup

### Adding a child

1. **Settings → Integrations → + Add integration → Home Assistant Pocket Money**
2. Fill in:
   - **Child name** — shown on tabs and sensor names (e.g. `Evie`)
   - **Avatar colour** — teal, blue, purple, orange, gold, green, red, pink or grey
   - **Currency symbol** — default `£`; set to `$`, `€` etc. as needed
3. Repeat for each child

Each child automatically creates two sensors:

| Sensor | State | Key attributes |
|---|---|---|
| `sensor.<child>_pocket_money_balance` | Current balance (float) | `ledger` (last 50 transactions), `last_paid`, `currency` |
| `sensor.<child>_chores_due` | Count of due chores (int) | `due_chores` (full list), `paused_chores` (full list) |

---

## 🃏 Lovelace Card

Add the card to any dashboard via the visual editor (**Add card → Custom: HAPM Pocket Money Panel**) or in YAML:

```yaml
type: custom:hapm-panel-card
```

No additional configuration is needed — the card discovers all children automatically from Home Assistant states.

---

### Card layout

<!-- SCREENSHOT: Child tab bar showing two or three children with coloured dots and inline balances, with one tab in the active/highlighted state. Suggested filename: docs/screenshots/child-tabs.png -->
> 📸 *Screenshot placeholder — `docs/screenshots/child-tabs.png`*
> **What to capture:** The child tab strip at the top of the card with multiple children visible, showing the coloured avatar dot, child name, and their balance inline in each tab.

#### Top bar
- **Holiday Mode button** (top right) — tap to start/end a holiday; shows days remaining when active

#### Child tabs
- One tab per child; tap to switch
- Each tab shows the child's avatar colour dot and their current balance inline

#### KPI row

| Tile | Description |
|---|---|
| **Balance** | Current outstanding pocket money (highlighted green when > £0) |
| **Due Now** | Count of chores currently due |
| **Last Paid** | Human-readable time since the last payment was made |

#### Navigation tabs
- **Chores** — all currently due chores
- **Paused** — chores currently paused (with resume button)
- **Ledger** — full transaction history

---

### Chores tab

<!-- SCREENSHOT: Chores tab showing two or three chore cards. One should be a single-occurrence chore (showing Mark done / Pause / Edit buttons), and one a multi-occurrence chore showing progress dots and a "Log 2/4 ✓" button. Suggested filename: docs/screenshots/chores-tab.png -->
> 📸 *Screenshot placeholder — `docs/screenshots/chores-tab.png`*
> **What to capture:** The Chores tab with a mix of chore cards — at least one regular chore and one multi-occurrence chore showing the purple progress dots. The blue "Pay" button should be visible at the bottom if there is a positive balance.

Each chore card shows:
- **Category emoji** (selected when the chore was created)
- **Chore name** and optional description
- **Pills** — recurrence (Weekly/Daily/Monthly), multi-occurrence count (e.g. `2/4×`), team indicator
- **Progress dots** (purple) for multi-occurrence chores
- **Value** (top right, green)

Actions per card:
- **Mark done ✓** — single-occurrence chore; credits balance immediately
- **Log N/M ✓** — multi-occurrence chore; records one step toward the target
- **Pause** — opens the pause sheet (set days or leave blank for indefinite)
- **✏️** — opens the edit sheet pre-filled with current values

At the bottom of the panel, a **Pay £X.XX** button appears whenever the balance is positive — tap to confirm payment and clear the balance.

---

### Adding a chore

<!-- SCREENSHOT: The "Add Chore" bottom sheet open, showing the Category dropdown (with emoji), Name, Description, Value, Occurrences fields, and the child checkbox list. Suggested filename: docs/screenshots/add-chore-sheet.png -->
> 📸 *Screenshot placeholder — `docs/screenshots/add-chore-sheet.png`*
> **What to capture:** The Add Chore bottom sheet slid up from the bottom of the screen, showing all fields including the Category dropdown open (or just selected with an emoji visible), the Assign To checkboxes, and — if two children are checked — the Individual/Team option cards.

Tap **+ Add Chore** (top right of the Chores panel) to open the add sheet:

| Field | Description |
|---|---|
| **Category** | Dropdown of 16 categories — each has a unique emoji shown on the chore card |
| **Recurrence** | Manual, Daily, Weekly (default), Monthly |
| **Chore Name** | Free text, e.g. "Tidy bedroom" |
| **Description** | Optional extra detail shown under the name |
| **Value (£)** | Amount to credit per completion |
| **Occurrences** | How many times the chore must be logged before it pays out (default 1) |
| **Pay Mode** | *(shown when Occurrences > 1)* Per occurrence (equal share each time) or All at once (full value on final completion) |
| **Assign To** | Checkbox per child; tick one or more |
| **How should they work?** | *(shown when 2+ children ticked)* Individual (separate targets) or Team (shared target) |
| **How should they be paid?** | *(shown for Team chores)* Each earns full value, or Split equally |

#### 16 chore categories

| Emoji | Category | Emoji | Category |
|---|---|---|---|
| 🛏️ | Bedroom | 🧹 | Tidying |
| 🍽️ | Kitchen | 🧺 | Laundry |
| 🚿 | Bathroom | 🌿 | Garden |
| 🐾 | Pet Care | 📚 | Homework |
| 🗑️ | Recycling | 👨‍🍳 | Cooking |
| 🛍️ | Shopping | 🏋️ | Exercise |
| 📖 | Reading | 🚗 | Car |
| 💻 | Tech / Screens | ⭐ | Other |

---

### Paused tab

<!-- SCREENSHOT: The Paused tab showing one or two chore cards with the orange "⏸ Until 5 Jul" pill and a "▶ Resume" button visible. Suggested filename: docs/screenshots/paused-tab.png -->
> 📸 *Screenshot placeholder — `docs/screenshots/paused-tab.png`*
> **What to capture:** The Paused tab with at least one paused chore visible showing the orange pause pill (e.g. "⏸ Until 5 Jul" or "⏸ Indefinite") and the Resume button.

Paused chores are moved here and shown with an orange left border and a pill showing the pause expiry date (or "Indefinite"). Tap **▶ Resume** to make a chore immediately due again.

---

### Ledger tab

<!-- SCREENSHOT: The Ledger tab showing a list of transactions — mix of green "+£0.50" chore-earned rows and a red "-£3.50" payment row. The running balance column should be visible on the right. Suggested filename: docs/screenshots/ledger-tab.png -->
> 📸 *Screenshot placeholder — `docs/screenshots/ledger-tab.png`*
> **What to capture:** The Ledger tab with several transaction rows. Each row should show the event icon (✅ / 💸), description, human-readable time, coloured amount, and the running balance on the far right.

The Ledger tab pulls from the `ledger` attribute of `sensor.<child>_pocket_money_balance` and shows the **50 most-recent transactions**, newest first:

| Column | Detail |
|---|---|
| Icon | ✅ chore completed · 🟣 occurrence logged · 💸 paid out |
| Description | Chore name or note |
| Time | Human-readable (e.g. "Just now", "2h ago", "Mon 07:05") |
| Amount | Green `+£X.XX` for earnings · red `-£X.XX` for payments |
| Running balance | Balance after that transaction |

---

### Holiday Mode

<!-- SCREENSHOT: The Holiday Mode button in its active/orange state at the top of the card, showing "🏖 Holiday — 5d left". Suggested filename: docs/screenshots/holiday-mode.png -->
> 📸 *Screenshot placeholder — `docs/screenshots/holiday-mode.png`*
> **What to capture:** The top bar of the card with the Holiday Mode button highlighted in orange showing the remaining days countdown.

Tap **🏖 Holiday Mode** in the top bar to open the holiday sheet. Enter the number of days away and tap **Start Holiday** — all chores are immediately suspended and their due dates are pushed forward. Tap the button again (now orange with a countdown) to end holiday mode early.

---

## 🔧 Services

All services are callable from **Developer Tools → Services** or from automations.

| Service | Required fields | Description |
|---|---|---|
| `hapm.add_chore` | `name`, `value`, `assigned_to` | Create a new chore |
| `hapm.update_chore` | `chore_id` | Update an existing chore's fields |
| `hapm.complete_chore` | `chore_id`, `child_entry_id` | Mark a single-occurrence chore complete and credit balance |
| `hapm.log_occurrence` | `chore_id`, `child_entry_id` | Log one step of a multi-occurrence chore |
| `hapm.mark_paid` | `child_entry_id` | Clear a child's balance and record the payment event |
| `hapm.pause_chore` | `chore_id` | Pause a chore; pass `days` (int) or omit for indefinite |
| `hapm.resume_chore` | `chore_id` | Resume a paused chore (makes it immediately due) |
| `hapm.set_holiday_mode` | `days` | Pause all chores for N days |
| `hapm.clear_holiday_mode` | — | Immediately lift holiday mode |

### `hapm.add_chore` — full field reference

```yaml
service: hapm.add_chore
data:
  name: "Tidy bedroom"           # required
  value: 0.50                    # required (float, in your currency)
  assigned_to:                   # required — list of child entry_ids
    - "abc123_entry_id"
  description: "Including desk"  # optional
  recurrence: "weekly"           # manual | daily | weekly | monthly  (default: manual)
  occurrences_required: 1        # int, default 1
  pay_mode: "per_occurrence"     # per_occurrence | on_completion
  assignment_mode: "individual"  # individual | team
  pay_split_mode: "full"         # full | shared  (team chores only)
  category: "bedroom"            # see category list above
```

---

## ⚡ Example automations

### Notify when a chore becomes due

```yaml
automation:
  alias: "HAPM — notify on chore due"
  trigger:
    platform: event
    event_type: hapm_chore_due
  action:
    service: notify.mobile_app_your_phone
    data:
      title: "Chore due! 📋"
      message: >
        {{ trigger.event.data.chore_name }} is ready for
        {{ trigger.event.data.assigned_to }}
```

### Mark paid via NFC tag

```yaml
automation:
  alias: "HAPM — NFC pay station"
  trigger:
    platform: tag
    tag_id: "your-nfc-tag-id"
  action:
    service: hapm.mark_paid
    data:
      child_entry_id: "your_child_entry_id"
      note: "NFC pay station"
```

### Weekly allowance top-up (manual chore auto-log)

```yaml
automation:
  alias: "HAPM — weekly pocket money Friday"
  trigger:
    platform: time
    at: "17:00:00"
  condition:
    condition: time
    weekday: [fri]
  action:
    service: hapm.complete_chore
    data:
      chore_id: "your_allowance_chore_id"
      child_entry_id: "your_child_entry_id"
```

> **Finding IDs:** Go to **Developer Tools → States**, search for `sensor.<child>_pocket_money_balance` and copy `entry_id` from the attributes. Chore IDs are found in `sensor.<child>_chores_due` → `due_chores` attribute list.

---

## 🗂️ Sensor attributes reference

### `sensor.<child>_pocket_money_balance`

| Attribute | Type | Description |
|---|---|---|
| `entry_id` | string | Unique ID for this child (used in service calls) |
| `child_name` | string | Display name |
| `avatar_colour` | string | Colour key (teal, blue, purple…) |
| `currency` | string | Currency symbol (e.g. `£`) |
| `ledger_event_count` | int | Total number of ledger events ever recorded |
| `last_paid` | ISO datetime | Timestamp of the most recent payment |
| `ledger` | list | Last 50 transactions, newest first (see below) |

Each `ledger` entry:
```json
{
  "event_type": "chore_completed",
  "amount": 0.50,
  "timestamp": "2026-06-29T08:15:00",
  "note": "Tidy bedroom"
}
```
Event types: `chore_completed` · `occurrence_logged` · `payment_made`

### `sensor.<child>_chores_due`

| Attribute | Type | Description |
|---|---|---|
| `entry_id` | string | Child entry ID |
| `due_chores` | list | All currently due chore objects |
| `paused_chores` | list | All currently paused chore objects |

Each chore object includes: `id`, `name`, `description`, `value`, `recurrence`, `next_due`, `occurrences_required`, `occurrences_completed`, `pay_mode`, `assignment_mode`, `pay_split_mode`, `category`, `paused_until`.

---

## 🔄 Changelog

### v0.1.22 — Ledger UI & category forwarding
- **Ledger tab** now shows a real transaction list (event icon, description, amount, running balance, timestamp)
- `sensor.<child>_pocket_money_balance` now exposes a `ledger` attribute with the 50 most-recent events
- `category`, `assignment_mode` and `pay_split_mode` now correctly forwarded in both `due_chores` and `paused_chores` sensor attributes

### v0.1.21 — Chore categories
- 16 selectable categories added to Add and Edit forms, each with a unique emoji
- Legacy chores (no category field) gracefully fall back to hash-based icon

### v0.1.20 — Team chores & multi-occurrence
- Team chore support: assign one chore to multiple children with shared or individual occurrence tracking
- Full/shared pay split modes for team chores

### v0.1.x — Foundation
- Core integration, sensors, ledger, recurring schedules, holiday mode, pause/resume, Lovelace card

---

## 📄 Licence

MIT © LayzeeAutomation
