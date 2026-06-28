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
    RECURRENCE_MANUAL,
    STORAGE_KEY_CHORES,
    STORAGE_KEY_GLOBAL,
    STORAGE_KEY_LEDGER,
    STORAGE_KEY_OCCURRENCES,
    STORAGE_VERSION,
)
from .models import Chore, GlobalState, LedgerEvent, OccurrenceWindow

_LOGGER = logging.getLogger(__name__)

# Sentinel far-future date used to represent an indefinite pause.
# Using datetime.max directly can cause overflow in some serialisers,
# so we use year 9999 which is safe for ISO-8601 strings.
_INDEFINITE_PAUSE = datetime(9999, 12, 31, 23, 59, 59)


class HAPMStore:
    """Manages all persistent HAPM data via HA storage helpers."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._chore_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_CHORES)
        self._ledger_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_LEDGER)
        self._occurrence_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_OCCURRENCES)
        self._global_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_GLOBAL)

        self._chores: dict[str, Chore] = {}
        self._ledger: list[LedgerEvent] = []
        self._occurrences: dict[str, OccurrenceWindow] = {}
        self._global: GlobalState = GlobalState()

    # ------------------------------------------------------------------
    # Load / Save
    # ------------------------------------------------------------------

    async def async_load(self) -> None:
        chore_data = await self._chore_store.async_load() or {}
        self._chores = {k: Chore.from_dict(v) for k, v in chore_data.items()}

        ledger_data = await self._ledger_store.async_load() or []
        self._ledger = [LedgerEvent.from_dict(e) for e in ledger_data]

        occurrence_data = await self._occurrence_store.async_load() or {}
        self._occurrences = {k: OccurrenceWindow.from_dict(v) for k, v in occurrence_data.items()}

        global_data = await self._global_store.async_load() or {}
        self._global = GlobalState.from_dict(global_data)

        _LOGGER.debug(
            "HAPM storage loaded: %d chores, %d ledger events, %d open windows",
            len(self._chores), len(self._ledger), len(self._occurrences),
        )

    async def async_save(self) -> None:
        await self._chore_store.async_save({k: v.to_dict() for k, v in self._chores.items()})
        await self._ledger_store.async_save([e.to_dict() for e in self._ledger])
        await self._occurrence_store.async_save({k: v.to_dict() for k, v in self._occurrences.items()})
        await self._global_store.async_save(self._global.to_dict())

    # ------------------------------------------------------------------
    # Chore operations
    # ------------------------------------------------------------------

    def get_chores(self) -> list[Chore]:
        return list(self._chores.values())

    def get_chore(self, chore_id: str) -> Optional[Chore]:
        return self._chores.get(chore_id)

    def get_chores_for_child(self, child_entry_id: str) -> list[Chore]:
        return [c for c in self._chores.values() if child_entry_id in c.assigned_to]

    async def async_add_chore(self, chore: Chore) -> Chore:
        self._chores[chore.id] = chore
        await self.async_save()
        return chore

    async def async_update_chore(self, chore: Chore) -> Chore:
        self._chores[chore.id] = chore
        await self.async_save()
        return chore

    async def async_delete_chore(self, chore_id: str) -> None:
        self._chores.pop(chore_id, None)
        await self.async_save()

    async def async_pause_chore(self, chore_id: str, days: Optional[int]) -> None:
        """Pause a chore.  Pass days=None for an indefinite pause."""
        chore = self._chores.get(chore_id)
        if chore:
            chore.paused_until = (
                _INDEFINITE_PAUSE if days is None
                else datetime.utcnow() + timedelta(days=days)
            )
            await self.async_save()

    async def async_resume_chore(self, chore_id: str) -> None:
        """Resume a paused chore and make it immediately due.

        For recurring chores, next_due is reset to utcnow() so the chore
        appears in _get_due_chores straight away rather than staying hidden
        until the original future next_due date arrives.
        Manual chores always show as due (next_due is unused), so no change
        is needed for those.
        """
        chore = self._chores.get(chore_id)
        if chore:
            chore.paused_until = None
            if chore.recurrence != RECURRENCE_MANUAL and chore.next_due is not None:
                # Reset to now so the sensor's next_due > now guard is satisfied
                chore.next_due = datetime.utcnow()
            await self.async_save()

    def is_paused(self, chore: Chore) -> bool:
        """Return True if the chore is currently paused (timed or indefinite)."""
        return bool(chore.paused_until and datetime.utcnow() < chore.paused_until)

    def paused_until_display(self, chore: Chore) -> Optional[str]:
        """Human-readable pause label, or None if not paused."""
        if not self.is_paused(chore):
            return None
        if chore.paused_until >= _INDEFINITE_PAUSE:
            return "Indefinite"
        return chore.paused_until.strftime("%d %b %Y")

    # ------------------------------------------------------------------
    # Ledger / Balance
    # ------------------------------------------------------------------

    def get_ledger_for_child(self, child_entry_id: str) -> list[LedgerEvent]:
        return [e for e in self._ledger if e.child_entry_id == child_entry_id]

    def get_balance(self, child_entry_id: str) -> float:
        return round(
            sum(e.amount for e in self._ledger if e.child_entry_id == child_entry_id),
            2,
        )

    async def async_add_ledger_event(self, event: LedgerEvent) -> LedgerEvent:
        self._ledger.append(event)
        await self.async_save()
        return event

    async def async_clear_balance(self, child_entry_id: str, note: Optional[str] = None) -> LedgerEvent:
        current_balance = self.get_balance(child_entry_id)
        if current_balance <= 0:
            _LOGGER.warning(
                "HAPM: async_clear_balance called for '%s' but balance is %.2f — skipping.",
                child_entry_id, current_balance,
            )
            return None
        event = LedgerEvent(
            event_type=EVENT_PAYMENT_MADE,
            child_entry_id=child_entry_id,
            amount=-current_balance,
            note=note,
        )
        return await self.async_add_ledger_event(event)

    # ------------------------------------------------------------------
    # Occurrence window operations
    # ------------------------------------------------------------------

    def get_open_window(self, chore_id: str) -> Optional[OccurrenceWindow]:
        from .const import OCCURRENCE_STATUS_IN_PROGRESS
        for w in self._occurrences.values():
            if w.chore_id == chore_id and w.status == OCCURRENCE_STATUS_IN_PROGRESS:
                return w
        return None

    async def async_open_window(self, window: OccurrenceWindow) -> OccurrenceWindow:
        self._occurrences[window.id] = window
        await self.async_save()
        return window

    async def async_update_window(self, window: OccurrenceWindow) -> OccurrenceWindow:
        self._occurrences[window.id] = window
        await self.async_save()
        return window

    # ------------------------------------------------------------------
    # Holiday mode
    # ------------------------------------------------------------------

    async def async_set_holiday_mode(self, days: int) -> None:
        self._global.holiday_mode = True
        self._global.holiday_paused_until = datetime.utcnow() + timedelta(days=days)
        await self.async_save()

    async def async_clear_holiday_mode(self) -> None:
        self._global.holiday_mode = False
        self._global.holiday_paused_until = None
        await self.async_save()

    def is_holiday_mode_active(self) -> bool:
        if not self._global.holiday_mode:
            return False
        if self._global.holiday_paused_until and datetime.utcnow() > self._global.holiday_paused_until:
            return False
        return True

    def is_chore_active(self, chore: Chore) -> bool:
        if not chore.enabled:
            return False
        if self.is_holiday_mode_active():
            return False
        if self.is_paused(chore):
            return False
        return True

    @property
    def global_state(self) -> GlobalState:
        return self._global
