"""Constants for HAPM - Home Assistant Pocket Money."""

DOMAIN = "hapm"
PLATFORMS = ["sensor"]

# Config entry keys
CONF_CHILD_NAME = "child_name"
CONF_CURRENCY = "currency"

# Default values
DEFAULT_CURRENCY = "GBP"

# Storage
STORAGE_VERSION = 1
STORAGE_KEY_CHORES = "hapm_chores"
STORAGE_KEY_LEDGER = "hapm_ledger"
STORAGE_KEY_OCCURRENCES = "hapm_occurrences"
STORAGE_KEY_GLOBAL = "hapm_global"

# Data store keys (in-memory)
DATA_CHORES = "chores"
DATA_LEDGER = "ledger"
DATA_BALANCE = "balance"
DATA_STORE = "store"
DATA_COORDINATOR = "coordinator"

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

# Pay modes
PAY_MODE_PER_OCCURRENCE = "per_occurrence"
PAY_MODE_ON_COMPLETION = "on_completion"

PAY_MODE_OPTIONS = [
    PAY_MODE_PER_OCCURRENCE,
    PAY_MODE_ON_COMPLETION,
]

# Assignment modes
ASSIGNMENT_MODE_INDIVIDUAL = "individual"
ASSIGNMENT_MODE_TEAM = "team"

ASSIGNMENT_MODE_OPTIONS = [
    ASSIGNMENT_MODE_INDIVIDUAL,
    ASSIGNMENT_MODE_TEAM,
]

# Pay split modes (team chores only)
PAY_SPLIT_SHARED = "shared"
PAY_SPLIT_FULL = "full"

PAY_SPLIT_OPTIONS = [
    PAY_SPLIT_SHARED,
    PAY_SPLIT_FULL,
]

# Occurrence window status
OCCURRENCE_STATUS_IN_PROGRESS = "in_progress"
OCCURRENCE_STATUS_COMPLETE = "complete"
OCCURRENCE_STATUS_EXPIRED = "expired"

# Ledger event types
EVENT_CHORE_COMPLETED = "chore_completed"
EVENT_OCCURRENCE_LOGGED = "occurrence_logged"
EVENT_CHORE_REVERSED = "chore_reversed"
EVENT_PAYMENT_MADE = "payment_made"
