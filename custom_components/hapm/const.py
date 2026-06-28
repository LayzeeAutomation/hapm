"""Constants for HAPM - Home Assistant Pocket Money."""

DOMAIN = "hapm"
PLATFORMS = ["sensor"]

# Config entry keys
CONF_CHILD_NAME = "child_name"
CONF_CURRENCY = "currency"

# Default values
DEFAULT_CURRENCY = "GBP"

# Data store keys
DATA_CHORES = "chores"
DATA_LEDGER = "ledger"
DATA_BALANCE = "balance"

# Recurrence types
RECURRENCE_DAILY = "daily"
RECURRENCE_WEEKLY = "weekly"
RECURRENCE_MONTHLY = "monthly"
RECURRENCE_MANUAL = "manual"

RECURRENCE_OPTIONS = [
    RECURRENCE_DAILY,
    RECURRENCE_WEEKLY,
    RECURRENCE_MONTHLY,
    RECURRENCE_MANUAL,
]
