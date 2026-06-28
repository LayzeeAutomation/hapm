"""Recurring chore scheduler for HAPM."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Callable

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_interval

from .const import (
    DATA_STORE,
    DOMAIN,
    EVENT_HAPM_DATA_CHANGED,
    RECURRENCE_DAILY,
    RECURRENCE_MANUAL,
    RECURRENCE_MONTHLY,
    RECURRENCE_WEEKLY,
)
from .store import HAPMStore

_LOGGER = logging.getLogger(__name__)

SCHEDULER_INTERVAL = timedelta(minutes=1)
DATA_SCHEDULER_UNSUB = "scheduler_unsub"


def _advance_next_due(next_due: datetime, recurrence: str, interval: int) -> datetime:
    """Return the next_due after skipping past missed cycles."""
    now = datetime.utcnow()
    while next_due <= now:
        if recurrence == RECURRENCE_DAILY:
            next_due += timedelta(days=interval)
        elif recurrence == RECURRENCE_WEEKLY:
            next_due += timedelta(weeks=interval)
        elif recurrence == RECURRENCE_MONTHLY:
            next_due += timedelta(days=30 * interval)
        else:
            break
    return next_due


async def _run_scheduler(hass: HomeAssistant, store: HAPMStore, _now: datetime) -> None:
    """Refresh sensor state so due chores are reflected immediately.

    We deliberately do NOT advance next_due here — that only happens when
    a chore is actually completed via handle_complete_chore / handle_log_occurrence.
    Paused/holiday chores have their next_due advanced so they don't pile up
    while skipped, but they are never shown as due.
    """
    now = datetime.utcnow()
    global_state = store.global_state
    changed = False

    for chore in store.get_chores():
        if chore.recurrence == RECURRENCE_MANUAL:
            continue
        if not chore.enabled:
            continue
        if chore.next_due is None:
            continue

        # While holiday mode is active, silently advance past-due chores
        # so they don't flood the list when holiday ends.
        if global_state.holiday_mode and global_state.holiday_paused_until:
            if now < global_state.holiday_paused_until:
                if chore.next_due <= now:
                    chore.next_due = _advance_next_due(
                        chore.next_due, chore.recurrence, chore.interval
                    )
                    await store.async_update_chore(chore)
                    changed = True
                continue

        # While individually paused, silently advance next_due.
        if chore.paused_until and now < chore.paused_until:
            if chore.next_due <= now:
                chore.next_due = _advance_next_due(
                    chore.next_due, chore.recurrence, chore.interval
                )
                await store.async_update_chore(chore)
                changed = True
            continue

        # Chore is active and due — just log, sensors will pick it up via
        # the time-interval refresh without us touching next_due.
        if chore.next_due <= now:
            _LOGGER.debug("HAPM scheduler: chore '%s' is due.", chore.name)

    # Fire data-changed so sensors re-evaluate due_chores every minute.
    hass.bus.async_fire(EVENT_HAPM_DATA_CHANGED)


def async_setup_scheduler(hass: HomeAssistant) -> Callable:
    """Start the recurring scheduler and return the unsub callable."""

    async def _tick(now: datetime) -> None:
        store: HAPMStore | None = hass.data.get(DOMAIN, {}).get(DATA_STORE)
        if store is None:
            return
        await _run_scheduler(hass, store, now)

    unsub = async_track_time_interval(hass, _tick, SCHEDULER_INTERVAL)
    _LOGGER.debug("HAPM: Scheduler started (interval=%s).", SCHEDULER_INTERVAL)
    return unsub
