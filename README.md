# Home Assistant Pocket Money (HAPM)

A HACS-compatible custom integration for Home Assistant that turns chore tracking into a proper pocket money system for your children.

## Features

- 👶 **Multiple children** — each child is a separate config entry with their own sensors, chore list, and balance
- ✅ **Chore management** — add chores with a name, value, description, and assignment
- 🔄 **Recurring schedules** — daily, weekly, monthly, or manual; with configurable intervals
- 📊 **Multi-occurrence chores** — e.g. "tidy bedroom 5 times this week" with a window and a per-occurrence or on-completion pay mode
- 👥 **Team chores** — assign one chore to multiple children with shared or full pay split
- 💰 **Running balance** — auditable ledger of every credit and payment
- 💳 **Mark paid** — clear a child's balance with one service call when you hand over the cash
- ⏸️ **Pause & resume** — pause individual chores or all chores globally (holiday mode)
- 🔔 **Persistent notifications** — HA fires a notification when a recurring chore becomes due
- 🤖 **Automation-friendly** — fires `hapm_chore_due` events on the HA event bus

## Installation

### HACS (recommended)

1. In HACS → Integrations → **Custom repositories**, add `https://github.com/LayzeeAutomation/hapm` as an **Integration**
2. Search for **Home Assistant Pocket Money** and install
3. Restart Home Assistant
4. Go to **Settings → Integrations → Add integration** and search for **Home Assistant Pocket Money**

### Manual

Copy `custom_components/hapm/` into your HA `config/custom_components/` directory and restart.

## Setup

1. Add one integration entry per child (Settings → Integrations → + Add integration → Home Assistant Pocket Money)
2. Enter the child’s name, choose an avatar colour, and set your currency symbol (default `£`)
3. Each child gets two sensors automatically:
   - `sensor.<child>_pocket_money_balance` — running total in your currency
   - `sensor.<child>_chores_due` — count of currently due chores, with full chore details in attributes

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

## Example automation — Notify on chore due

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

## Example automation — Mark paid via NFC tag

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

## Lovelace card ideas

- Use a **Markdown card** with `{{ state_attr('sensor.alice_chores_due', 'due_chores') | map(attribute='name') | join(', ') }}` to list chores
- Use a **Gauge card** for the balance sensor to give kids a visual target
- Use **Button cards** calling `hapm.complete_chore` for each task so children can self-report from a tablet dashboard

## Licence

MIT
