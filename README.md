# Home Assistant Pocket Money (HAPM)

A HACS-compatible custom integration for Home Assistant that turns chore tracking into a proper pocket money system for your children.

---

## Features

- 👶 **Multiple children** — each child is a separate config entry with their own sensors, balance and chore list
- ✅ **Chore management** — add chores with a name, value, description and assignment
- 🔄 **Recurring schedules** — daily, weekly, monthly or manual, with configurable intervals
- 📊 **Multi-occurrence chores** — e.g. “tidy bedroom 5 times this week” with per-occurrence or on-completion pay
- 👥 **Team chores** — assign one chore to multiple children with shared or full pay split
- 💰 **Running balance** — auditable ledger of every credit and payment event
- 💳 **Mark paid** — clear a child’s balance in one tap when you hand over the cash
- ⏸️ **Pause & resume** — pause individual chores or all chores globally (holiday mode)
- 🔔 **Persistent notifications** — HA fires a notification when a recurring chore becomes due
- 🤖 **Automation-friendly** — fires `hapm_chore_due` events on the HA event bus
- 🎨 **Bundled Lovelace card** — fully interactive panel card, auto-registered on install

---

## Installation

### HACS (recommended — one click)

1. In HACS → Integrations → **Custom repositories**, add `https://github.com/LayzeeAutomation/hapm` as an **Integration**
2. Search for **Home Assistant Pocket Money** and click **Download**
3. Restart Home Assistant
4. Go to **Settings → Integrations → Add integration** and search for **Home Assistant Pocket Money**
5. Add one entry per child — the Lovelace card is available immediately, no extra resource setup needed

> The card JS (`hapm-panel-card.js`) is served and registered automatically by the integration on startup. There is no manual file copying or resource configuration required.

### Manual

1. Copy `custom_components/hapm/` into your HA `config/custom_components/` directory
2. Restart Home Assistant
3. Add the integration via Settings → Integrations as above

> The card is still auto-registered on manual install — no separate resource step needed.

---

## Setup

1. Add one integration entry per child (Settings → Integrations → + Add integration → **Home Assistant Pocket Money**)
2. Enter the child’s name, choose an avatar colour and set your currency symbol (default `£`)
3. Each child gets two sensors automatically:
   - `sensor.<child>_pocket_money_balance` — running total in your currency
   - `sensor.<child>_chores_due` — count of due chores, with full chore detail in attributes

---

## Lovelace Card

The **HAPM Pocket Money Panel** card is bundled with the integration and available immediately after install.

Add it to any Lovelace dashboard via the visual editor (**Add card → Custom: HAPM Pocket Money Panel**) or in YAML:

```yaml
type: custom:hapm-panel-card
```

The card provides:
- **Per-child tabs** with live balance displayed inline
- **KPI row** — outstanding balance, chores due count, last paid date
- **Chores view** — all due chores with Mark done / Log occurrence / Pause 7d actions
- **Add Chore form** inline — name, value, recurrence, occurrences, individual or team assignment
- **Pay button** — one tap to clear a child’s balance and write a ledger event
- **Holiday Mode toggle** — pauses all chores and slides due dates forward automatically
- **Ledger view** — links to the sensor attribute for full payment history

> **Screenshots** — add your own once installed.

---

## Services

All services are available under **Developer Tools → Services** in Home Assistant.

| Service | Description |
|---|---|
| `hapm.add_chore` | Create a new chore and assign it to one or more children |
| `hapm.complete_chore` | Mark a single-occurrence chore complete and credit the balance |
| `hapm.log_occurrence` | Log one step toward a multi-occurrence chore |
| `hapm.mark_paid` | Clear a child’s balance and record the payment |
| `hapm.pause_chore` | Pause one chore for N days |
| `hapm.resume_chore` | Immediately resume a paused chore |
| `hapm.set_holiday_mode` | Pause all chores for N days |
| `hapm.clear_holiday_mode` | Immediately lift holiday mode |

---

## Example automations

### Notify on chore due

```yaml
automation:
  trigger:
    platform: event
    event_type: hapm_chore_due
  action:
    service: notify.mobile_app_your_phone
    data:
      title: "Chore due!"
      message: "{{ trigger.event.data.chore_name }} is ready for {{ trigger.event.data.assigned_to }}"
```

### Mark paid via NFC tag

```yaml
automation:
  trigger:
    platform: tag
    tag_id: "your-nfc-tag-id"
  action:
    service: hapm.mark_paid
    data:
      child_entry_id: "your_child_entry_id"
      note: "NFC pay station"
```

---

## Licence

MIT
