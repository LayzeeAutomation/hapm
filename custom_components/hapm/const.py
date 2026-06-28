"""Constants for HAPM - Home Assistant Pocket Money."""

DOMAIN = "hapm"
PLATFORMS = ["sensor"]

# Config entry keys
CONF_CHILD_NAME = "child_name"
CONF_AVATAR_COLOUR = "avatar_colour"
CONF_CURRENCY_SYMBOL = "currency_symbol"

# Shared hass.data keys
DATA_STORE = "store"

# Storage
STORAGE_VERSION = 1
STORAGE_KEY_CHORES = f"{DOMAIN}_chores"
STORAGE_KEY_LEDGER = f"{DOMAIN}_ledger"
STORAGE_KEY_OCCURRENCES = f"{DOMAIN}_occurrences"
STORAGE_KEY_GLOBAL = f"{DOMAIN}_global"

# Recurrence types
RECURRENCE_DAILY = "daily"
RECURRENCE_WEEKLY = "weekly"
RECURRENCE_MONTHLY = "monthly"
RECURRENCE_MANUAL = "manual"

# Pay modes
PAY_MODE_PER_OCCURRENCE = "per_occurrence"
PAY_MODE_ON_COMPLETION = "on_completion"

# Assignment modes
ASSIGNMENT_MODE_INDIVIDUAL = "individual"
ASSIGNMENT_MODE_TEAM = "team"

# Pay split modes
PAY_SPLIT_SHARED = "shared"
PAY_SPLIT_FULL = "full"

# Occurrence window statuses
OCCURRENCE_STATUS_IN_PROGRESS = "in_progress"
OCCURRENCE_STATUS_COMPLETE = "complete"
OCCURRENCE_STATUS_EXPIRED = "expired"

# Ledger event types
EVENT_CHORE_COMPLETED = "chore_completed"
EVENT_OCCURRENCE_LOGGED = "occurrence_logged"
EVENT_CHORE_REVERSED = "chore_reversed"
EVENT_PAYMENT_MADE = "payment_made"
