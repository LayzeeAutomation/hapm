"""Persistent storage manager for HAPM."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DOMAIN,
    EVENT_PAYMENT_MADE,
    STORAGE_KEY_CHORES,
    STORAGE_KEY_GLOBAL,
    STORAGE_KEY_LEDGER,
    STORAGE_KEY_OCCURRENCES,
    STORAGE_VERSION,
)
from .models import Chore, GlobalState, LedgerEvent, OccurrenceWindow

_LOGGER = logging.getLogger(__name__)


class HAPMStore:
    """Manages all persistent HAPM data via HA storage helpers."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialise storage backends."""
        self._hass = hass
        self._chore_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_CHORES)
        self._ledger_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_LEDGER)
        self._occurrence_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_OCCURRENCES)
        self._global_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_GLOBAL)

        # In-memory caches
        self._chores: dict[str, Chore] = {}
        self._ledger: list[LedgerEvent] = []
        self._occurrences: dict[str, OccurrenceWindow] = {}
        self._global: GlobalState = GlobalState()

    # ------------------------------------------------------------------
    # Load / Save
    # ------------------------------------------------------------------

    async def async_load(self) -> None:
        """Load all data from persistent storage into memory."""
        chore_data = await self._chore_store.async_load() or {}
        self._chores = {
            k: Chore.from_dict(v) for k, v in chore_data.items()
        }

        ledger_data = await self._ledger_store.async_load() or []
        self._ledger = [LedgerEvent.from_dict(e) for e in ledger_data]

        occurrence_data = await self._occurrence_store.async_load() or {}
        self._occurrences = {
            k: OccurrenceWindow.from_dict(v) for k, v in occurrence_data.items()
        }

        global_data = await self._global_store.async_load() or {}
        self._global = GlobalState.from_dict(global_data)

        _LOGGER.debug(
            "HAPM storage loaded: %d chores, %d ledger events, %d open windows",
            len(self._chores),
            len(self._ledger),
            len(self._occurrences),
        )

    async def async_save(self) -> None:
        """Persist all in-memory data to storage."""
        await self._chore_store.async_save({k: v.to_dict() for k, v in self._chores.items()})
        await self._ledger_store.async_save([e.to_dict() for e in self._ledger])
        await self._occurrence_store.async_save({k: v.to_dict() for k, v in self._occurrences.items()})
        await self._global_store.async_save(self._global.to_dict())

    # ------------------------------------------------------------------
    # Chore operations
    # ------------------------------------------------------------------

    def get_chores(self) -> list[Chore]:
        """Return all chores."""
        return list(self._chores.values())

    def get_chore(self, chore_id: str) -> Optional[Chore]:
        """Return a single chore by ID, or None."""
        return self._chores.get(chore_id)

    def get_chores_for_child(self, child_entry_id: str) -> list[Chore]:
        """Return all chores assigned to a specific child."""
        return [c for c in self._chores.values() if child_entry_id in c.assigned_to]

    async def async_add_chore(self, chore: Chore) -> Chore:
        """Add a new chore and persist."""
        self._chores[chore.id] = chore
        await self.async_save()
        return chore

    async def async_update_chore(self, chore: Chore) -> Chore:
        """Update an existing chore and persist."""
        self._chores[chore.id] = chore
        await self.async_save()
        return chore

    async def async_delete_chore(self, chore_id: str) -> None:
        """Remove a chore and persist."""
        self._chores.pop(chore_id, None)
        await self.async_save()

    async def async_pause_chore(self, chore_id: str, days: int) -> None:
        """Pause a chore for a given number of days."""
        chore = self._chores.get(chore_id)
        if chore:
            chore.paused_until = datetime.utcnow() + timedelta(days=days)
            await self.async_save()

    async def async_resume_chore(self, chore_id: str) -> None:
        """Immediately clear a chore's pause."""
        chore = self._chores.get(chore_id)
        if chore:
            chore.paused_until = None
            await self.async_save()

    # ------------------------------------------------------------------
    # Ledger operations
    # ------------------------------------------------------------------

    def get_ledger_for_child(self, child_entry_id: str) -> list[LedgerEvent]:
        """Return all ledger events for a child."""
        return [e for e in self._ledger if e.child_entry_id == child_entry_id]

    def get_balance(self, child_entry_id: str) -> float:
        """Calculate current owed balance for a child from the ledger."""
        return sum(
            e.amount for e in self._ledger
            if e.child_entry_id == child_entry_id
            and e.event_type != EVENT_PAYMENT_MADE
        )

    async def async_add_ledger_event(self, event: LedgerEvent) -> LedgerEvent:
        """Append a ledger event and persist."""
        self._ledger.append(event)
        await self.async_save()
        return event

    async def async_clear_balance(self, child_entry_id: str, note: Optional[str] = None) -> LedgerEvent:
        """Record a payment event that zeroes the running balance."""
        current_balance = self.get_balance(child_entry_id)
        event = LedgerEvent(
            event_type=EVENT_PAYMENT_MADE,
            child_entry_id=child_entry_id,
            amount=-current_balance,  # offsets outstanding balance to zero
            note=note,
        )
        return await self.async_add_ledger_event(event)

    # ------------------------------------------------------------------
    # Occurrence window operations
    # ------------------------------------------------------------------

    def get_open_window(self, chore_id: str) -> Optional[OccurrenceWindow]:
        """Return the active occurrence window for a chore, if any."""
        from .const import OCCURRENCE_STATUS_IN_PROGRESS
        for w in self._occurrences.values():
            if w.chore_id == chore_id and w.status == OCCURRENCE_STATUS_IN_PROGRESS:
                return w
        return None

    async def async_open_window(self, window: OccurrenceWindow) -> OccurrenceWindow:
        """Open a new occurrence window and persist."""
        self._occurrences[window.id] = window
        await self.async_save()
        return window

    async def async_update_window(self, window: OccurrenceWindow) -> OccurrenceWindow:
        """Update an occurrence window and persist."""
        self._occurrences[window.id] = window
        await self.async_save()
        return window

    # ------------------------------------------------------------------
    # Holiday mode
    # ------------------------------------------------------------------

    async def async_set_holiday_mode(self, days: int) -> None:
        """Enable holiday mode, pausing all chores for N days."""
        self._global.holiday_mode = True
        self._global.holiday_paused_until = datetime.utcnow() + timedelta(days=days)
        await self.async_save()

    async def async_clear_holiday_mode(self) -> None:
        """Lift holiday mode immediately."""
        self._global.holiday_mode = False
        self._global.holiday_paused_until = None
        await self.async_save()

    def is_holiday_mode_active(self) -> bool:
        """Return True if holiday mode is currently in effect."""
        if not self._global.holiday_mode:
            return False
        if self._global.holiday_paused_until and datetime.utcnow() > self._global.holiday_paused_until:
            # Expired — auto-lift
            return False
        return True

    def is_chore_active(self, chore: Chore) -> bool:
        """Return True if a chore is currently actionable (not paused or disabled)."""
        if not chore.enabled:
            return False
        if self.is_holiday_mode_active():
            return False
        if chore.paused_until and datetime.utcnow() < chore.paused_until:
            return False
        return True

    @property
    def global_state(self) -> GlobalState:
        """Return current global state."""
        return self._global
