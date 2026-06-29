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


def _start_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _next_monday(dt: datetime, interval_weeks: int = 1) -> datetime:
    base = _start_of_day(dt)
    days_until = (7 - base.weekday()) % 7
    if days_until == 0:
        days_until = 7 * interval_weeks
    else:
        days_until += 7 * (interval_weeks - 1)
    return base + timedelta(days=days_until)


def _first_of_next_month(dt: datetime, interval_months: int = 1) -> datetime:
    base = _start_of_day(dt)
    year = base.year
    month = base.month + interval_months
    while month > 12:
        month -= 12
        year += 1
    return base.replace(year=year, month=month, day=1)


def _calculate_next_due_from(now: datetime, recurrence: str, interval: int) -> datetime | None:
    if recurrence == RECURRENCE_MANUAL:
        return None
    if recurrence == RECURRENCE_DAILY:
        return _start_of_day(now) + timedelta(days=interval)
    if recurrence == RECURRENCE_WEEKLY:
        return _next_monday(now, interval)
    if recurrence == RECURRENCE_MONTHLY:
        return _first_of_next_month(now, interval)
    return None


def _advance_next_due(next_due: datetime, recurrence: str, interval: int) -> datetime:
    """Return the next calendar-aligned due date after now."""
    now = datetime.utcnow()
    if recurrence == RECURRENCE_DAILY:
        while next_due <= now:
            next_due += timedelta(days=interval)
        return _start_of_day(next_due)
    if recurrence == RECURRENCE_WEEKLY:
        while next_due <= now:
            next_due += timedelta(weeks=interval)
        return _start_of_day(next_due)
    if recurrence == RECURRENCE_MONTHLY:
        while next_due <= now:
            next_due = _first_of_next_month(next_due, interval)
        return _start_of_day(next_due)
    return next_due


async def _run_scheduler(hass: HomeAssistant, store: HAPMStore, _now: datetime) -> None:
    """Refresh chores and silently roll recurring schedules forward.

    Rules:
    - Daily chores roll to the next day boundary.
    - Weekly chores are due on Mondays and silently roll to the next Monday if missed.
    - Monthly chores are due on the 1st and silently roll to the next 1st if missed.
    - Holiday mode and individual pause still suppress visibility and also advance overdue
      recurring chores so nothing piles up.
    """
    now = datetime.utcnow()
    global_state = store.global_state

    for chore in store.get_chores():
        if chore.recurrence == RECURRENCE_MANUAL:
            continue
        if not chore.enabled:
            continue
        if chore.next_due is None:
            chore.next_due = _calculate_next_due_from(now, chore.recurrence, chore.interval)
            await store.async_update_chore(chore)
            continue

        if global_state.holiday_mode and global_state.holiday_paused_until and now < global_state.holiday_paused_until:
            if chore.next_due <= now:
                chore.next_due = _advance_next_due(chore.next_due, chore.recurrence, chore.interval)
                await store.async_update_chore(chore)
            continue

        if chore.paused_until and now < chore.paused_until:
            if chore.next_due <= now:
                chore.next_due = _advance_next_due(chore.next_due, chore.recurrence, chore.interval)
                await store.async_update_chore(chore)
            continue

        # Active recurring chores also roll forward silently if their date has passed.
        if chore.next_due <= now:
            chore.next_due = _advance_next_due(chore.next_due, chore.recurrence, chore.interval)
            await store.async_update_chore(chore)

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
