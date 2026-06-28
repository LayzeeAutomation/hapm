"""Recurring chore scheduler for HAPM.

Wakes up every minute and checks whether any scheduled chore's next_due
has passed. When it has, the chore is marked as due (next_due stays set
so the sensor reflects it) and a HA persistent notification is fired so
parents and children can see what needs doing.

Holiday mode and individual chore pauses are both respected: a chore that
would have become due while paused simply advances its next_due forward
when the pause is lifted on the next scheduler tick.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Callable

from homeassistant.core import HomeAssistant, callback
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
    """Return the next_due after skipping past missed cycles.

    If the instance was down for several days, this fast-forwards through
    every missed cycle rather than triggering them all individually.
    """
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
    global_state = store.get_global_state()

    for chore in store.get_all_chores():
        # Skip manual, disabled, or already-active chores with no schedule
        if chore.recurrence == RECURRENCE_MANUAL:
            continue
        if not chore.enabled:
            continue
        if chore.next_due is None:
            continue

        # Holiday mode: slide the next_due forward so the chore isn't
        # immediately overdue the moment the family gets home
        if global_state.holiday_mode and global_state.holiday_paused_until:
            if now < global_state.holiday_paused_until:
                # Still on holiday — push next_due forward by one interval
                # (called each tick, so it tracks day-by-day)
                if chore.next_due <= now:
                    chore.next_due = _advance_next_due(
                        chore.next_due, chore.recurrence, chore.interval
                    )
                    await store.async_update_chore(chore)
                continue

        # Individual chore pause: same sliding behaviour
        if chore.paused_until and now < chore.paused_until:
            if chore.next_due <= now:
                chore.next_due = _advance_next_due(
                    chore.next_due, chore.recurrence, chore.interval
                )
                await store.async_update_chore(chore)
            continue

        # Chore is due
        if chore.next_due <= now:
            _LOGGER.debug(
                "HAPM scheduler: chore '%s' is due (next_due=%s).",
                chore.name, chore.next_due.isoformat(),
            )

            # Fire a persistent notification for each assigned child
            for child_entry_id in chore.assigned_to:
                child_entry = hass.config_entries.async_get_entry(child_entry_id)
                child_name = (
                    child_entry.title if child_entry else child_entry_id
                )
                pn_create(
                    hass,
                    message=(
                        f"**{chore.name}** is due for {child_name}.\n"
                        f"Worth: {chore.value:.2f}"
                        + (f"\n{chore.description}" if chore.description else "")
                    ),
                    title="Chore due ✅",
                    notification_id=f"hapm_due_{chore.id}_{child_entry_id}",
                )

            # Advance next_due to the next future cycle
            chore.next_due = _advance_next_due(
                chore.next_due, chore.recurrence, chore.interval
            )
            await store.async_update_chore(chore)

            # Fire a HA event so automations can react
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
    _LOGGER.debug("HAPM: Recurring chore scheduler started (interval=%s).", SCHEDULER_INTERVAL)
    return unsub
