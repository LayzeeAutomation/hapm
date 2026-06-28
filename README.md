# HAPM — Home Assistant Pocket Money

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
![Version](https://img.shields.io/github/v/release/LayzeeAutomation/hapm)
![License](https://img.shields.io/github/license/LayzeeAutomation/hapm)

A custom Home Assistant integration for tracking children's chores and pocket money balances.

---

## Features

- 👶 **Multiple children** — one config entry per child, each fully independent
- ✅ **Chore tracking** — assign chores with a name, monetary value, and repeat schedule
- 💰 **Running balance** — automatically tallied as chores are completed
- 💸 **Pay & reset** — mark as paid to clear the balance and record a payment event
- 🔁 **Recurrence** — daily, weekly, monthly, or manual chores
- 📊 **HA sensors** — balance and due chore counts exposed as native entities

---

## Installation

### Via HACS (recommended)

1. Open HACS in Home Assistant.
2. Go to **Integrations** → three dots → **Custom repositories**.
3. Add `https://github.com/LayzeeAutomation/hapm` and select type `Integration`.
4. Find **HAPM** and click **Download**.
5. Restart Home Assistant.

### Manual

1. Copy `custom_components/hapm/` into your Home Assistant `config/custom_components/` folder.
2. Restart Home Assistant.

---

## Setup

1. Go to **Settings → Devices & Services → Add Integration**.
2. Search for **HAPM** or **Pocket Money**.
3. Enter the child's name and currency code (default: `GBP`).
4. Repeat for each child.

---

## Entities

| Entity | Description |
|---|---|
| `sensor.<child>_pocket_money_balance` | Current owed balance in chosen currency |

*More entities (chores due, overdue, completed count) coming in future releases.*

---

## Services (coming in v0.2)

| Service | Description |
|---|---|
| `hapm.complete_chore` | Mark a chore complete, add value to balance |
| `hapm.undo_chore` | Reverse last completion |
| `hapm.mark_paid` | Reset balance and record payment |
| `hapm.add_chore` | Add a new chore to a child's profile |

---

## Roadmap

- [x] Multi-child config entries
- [x] Balance sensor
- [ ] Chore definitions with recurrence
- [ ] Complete/pay services
- [ ] Due and overdue sensors
- [ ] Persistent storage
- [ ] Lovelace card (future)

---

## Contributing

Pull requests and issues welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) when available.

---

## License

[MIT](LICENSE)
