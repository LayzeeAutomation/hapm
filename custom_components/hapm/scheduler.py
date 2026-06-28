"""Recurring chore scheduler for HAPM."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Callable

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.components.persistent_notification import async_create as pn_create

from .const import (
    DATA_STORE,
    DOMAIN,
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
    """Check all chores and advance any that are due."""
    now = datetime.utcnow()
    # Use the global_state property (not get_global_state())
    global_state = store.global_state

    for chore in store.get_chores():
        if chore.recurrence == RECURRENCE_MANUAL:
            continue
        if not chore.enabled:
            continue
        if chore.next_due is None:
            continue

        if global_state.holiday_mode and global_state.holiday_paused_until:
            if now < global_state.holiday_paused_until:
                if chore.next_due <= now:
                    chore.next_due = _advance_next_due(
                        chore.next_due, chore.recurrence, chore.interval
                    )
                    await store.async_update_chore(chore)
                continue

        if chore.paused_until and now < chore.paused_until:
            if chore.next_due <= now:
                chore.next_due = _advance_next_due(
                    chore.next_due, chore.recurrence, chore.interval
                )
                await store.async_update_chore(chore)
            continue

        if chore.next_due <= now:
            _LOGGER.debug("HAPM scheduler: chore '%s' is due.", chore.name)

            for child_entry_id in chore.assigned_to:
                child_entry = hass.config_entries.async_get_entry(child_entry_id)
                child_name = child_entry.title if child_entry else child_entry_id
                pn_create(
                    hass,
                    message=(
                        f"**{chore.name}** is due for {child_name}.\n"
                        f"Worth: {chore.value:.2f}"
                        + (f"\n{chore.description}" if chore.description else "")
                    ),
                    title="Chore due \u2705",
                    notification_id=f"hapm_due_{chore.id}_{child_entry_id}",
                )

            chore.next_due = _advance_next_due(
                chore.next_due, chore.recurrence, chore.interval
            )
            await store.async_update_chore(chore)

            hass.bus.async_fire(
                f"{DOMAIN}_chore_due",
                {
                    "chore_id": chore.id,
                    "chore_name": chore.name,
                    "assigned_to": chore.assigned_to,
                    "value": chore.value,
                },
            )


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
