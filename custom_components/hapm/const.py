"""Constants for HAPM - Home Assistant Pocket Money."""

DOMAIN = "hapm"

# Platforms
PLATFORMS = ["sensor"]

# Config entry keys
CONF_CHILD_NAME = "child_name"
CONF_CURRENCY_SYMBOL = "currency_symbol"
CONF_AVATAR_COLOUR = "avatar_colour"

# Data keys
DATA_STORE = "store"

# Storage
STORAGE_VERSION = 1
STORAGE_KEY_CHORES = "hapm_chores"
STORAGE_KEY_LEDGER = "hapm_ledger"
STORAGE_KEY_OCCURRENCES = "hapm_occurrences"
STORAGE_KEY_GLOBAL = "hapm_global"

# Recurrence types
RECURRENCE_MANUAL = "manual"
RECURRENCE_DAILY = "daily"
RECURRENCE_WEEKLY = "weekly"
RECURRENCE_MONTHLY = "monthly"

# Assignment modes
ASSIGNMENT_MODE_INDIVIDUAL = "individual"
ASSIGNMENT_MODE_TEAM = "team"

# Pay modes
PAY_MODE_PER_OCCURRENCE = "per_occurrence"
PAY_MODE_ON_COMPLETION = "on_completion"

# Pay split modes
PAY_SPLIT_SHARED = "shared"
PAY_SPLIT_FULL = "full"

# Occurrence statuses
OCCURRENCE_STATUS_IN_PROGRESS = "in_progress"
OCCURRENCE_STATUS_COMPLETE = "complete"
OCCURRENCE_STATUS_EXPIRED = "expired"

# Ledger event types
EVENT_CHORE_COMPLETED = "chore_completed"
EVENT_CHORE_REVERSED = "chore_reversed"
EVENT_OCCURRENCE_LOGGED = "occurrence_logged"
EVENT_PAYMENT_MADE = "payment_made"

# Internal HA event fired after any store mutation so sensors refresh immediately
EVENT_HAPM_DATA_CHANGED = "hapm_data_changed"
