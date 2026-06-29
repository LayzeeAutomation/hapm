"""Service definitions for HAPM - Home Assistant Pocket Money."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import (
    ASSIGNMENT_MODE_INDIVIDUAL,
    ASSIGNMENT_MODE_TEAM,
    DATA_STORE,
    DOMAIN,
    EVENT_CHORE_COMPLETED,
    EVENT_CHORE_REVERSED,
    EVENT_HAPM_DATA_CHANGED,
    EVENT_OCCURRENCE_LOGGED,
    OCCURRENCE_STATUS_COMPLETE,
    OCCURRENCE_STATUS_EXPIRED,
    OCCURRENCE_STATUS_IN_PROGRESS,
    PAY_MODE_ON_COMPLETION,
    PAY_MODE_PER_OCCURRENCE,
    PAY_SPLIT_SHARED,
    RECURRENCE_DAILY,
    RECURRENCE_MANUAL,
    RECURRENCE_MONTHLY,
    RECURRENCE_WEEKLY,
)
from .models import Chore, LedgerEvent, OccurrenceWindow
from .store import HAPMStore

_LOGGER = logging.getLogger(__name__)

SERVICE_ADD_CHORE          = "add_chore"
SERVICE_UPDATE_CHORE       = "update_chore"
SERVICE_COMPLETE_CHORE     = "complete_chore"
SERVICE_LOG_OCCURRENCE     = "log_occurrence"
SERVICE_MARK_PAID          = "mark_paid"
SERVICE_PAUSE_CHORE        = "pause_chore"
SERVICE_RESUME_CHORE       = "resume_chore"
SERVICE_SET_HOLIDAY_MODE   = "set_holiday_mode"
SERVICE_CLEAR_HOLIDAY_MODE = "clear_holiday_mode"

SCHEMA_ADD_CHORE = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Required("value"): vol.Coerce(float),
        vol.Required("assigned_to"): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional("description"): cv.string,
        vol.Optional("recurrence", default=RECURRENCE_MANUAL): vol.In(
            [RECURRENCE_DAILY, RECURRENCE_WEEKLY, RECURRENCE_MONTHLY, RECURRENCE_MANUAL]
        ),
        vol.Optional("interval", default=1): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("occurrences_required", default=1): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("pay_mode", default=PAY_MODE_PER_OCCURRENCE): vol.In(
            [PAY_MODE_PER_OCCURRENCE, PAY_MODE_ON_COMPLETION]
        ),
        vol.Optional("assignment_mode", default=ASSIGNMENT_MODE_INDIVIDUAL): vol.In(
            [ASSIGNMENT_MODE_INDIVIDUAL, ASSIGNMENT_MODE_TEAM]
        ),
        vol.Optional("pay_split_mode", default="full"): vol.In(["shared", "full"]),
        vol.Optional("category", default="tidying"): cv.string,
    }
)

SCHEMA_UPDATE_CHORE = vol.Schema(
    {
        vol.Required("chore_id"): cv.string,
        vol.Optional("name"): cv.string,
        vol.Optional("description"): vol.Any(None, cv.string),
        vol.Optional("value"): vol.All(vol.Coerce(float), vol.Range(min=0.01)),
        vol.Optional("recurrence"): vol.In(
            [RECURRENCE_DAILY, RECURRENCE_WEEKLY, RECURRENCE_MONTHLY, RECURRENCE_MANUAL]
        ),
        vol.Optional("occurrences_required"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("pay_mode"): vol.In(
            [PAY_MODE_PER_OCCURRENCE, PAY_MODE_ON_COMPLETION]
        ),
        vol.Optional("category"): cv.string,
    }
)

SCHEMA_COMPLETE_CHORE = vol.Schema(
    {
        vol.Required("chore_id"): cv.string,
        vol.Required("child_entry_id"): cv.string,
        vol.Optional("note"): cv.string,
    }
)

SCHEMA_LOG_OCCURRENCE = vol.Schema(
    {
        vol.Required("chore_id"): cv.string,
        vol.Required("child_entry_id"): cv.string,
        vol.Optional("note"): cv.string,
    }
)

SCHEMA_MARK_PAID = vol.Schema(
    {
        vol.Required("child_entry_id"): cv.string,
        vol.Optional("note"): cv.string,
    }
)

SCHEMA_PAUSE_CHORE = vol.Schema(
    {
        vol.Required("chore_id"): cv.string,
        vol.Optional("days"): vol.Any(
            None,
            vol.All(vol.Coerce(int), vol.Range(min=1)),
        ),
    }
)

SCHEMA_RESUME_CHORE = vol.Schema(
    {
        vol.Required("chore_id"): cv.string,
    }
)

SCHEMA_SET_HOLIDAY_MODE = vol.Schema(
    {
        vol.Required("days"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    }
)

SCHEMA_CLEAR_HOLIDAY_MODE = vol.Schema({})


def _fire_data_changed(hass: HomeAssistant) -> None:
    hass.bus.async_fire(EVENT_HAPM_DATA_CHANGED)


def _window_days_for_recurrence(recurrence: str, occurrences: int) -> int:
    if recurrence == RECURRENCE_DAILY:
        return 1
    if recurrence == RECURRENCE_WEEKLY:
        return 7
    if recurrence == RECURRENCE_MONTHLY:
        return 30
    return occurrences * 7


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


def _calculate_next_due(chore: Chore) -> datetime | None:
    if chore.recurrence == RECURRENCE_MANUAL:
        return None
    base = datetime.utcnow()
    if chore.recurrence == RECURRENCE_DAILY:
        return _start_of_day(base) + timedelta(days=chore.interval)
    if chore.recurrence == RECURRENCE_WEEKLY:
        return _next_monday(base, chore.interval)
    if chore.recurrence == RECURRENCE_MONTHLY:
        return _first_of_next_month(base, chore.interval)
    return None


def _credit_children(
    chore: Chore,
    child_entry_id: str,
    amount_per_child: float,
    event_type: str,
    occurrence_number: int | None = None,
    note: str | None = None,
) -> list[LedgerEvent]:
    events: list[LedgerEvent] = []
    if chore.assignment_mode == ASSIGNMENT_MODE_TEAM:
        recipients = chore.assigned_to
    else:
        recipients = [child_entry_id]
    for recipient in recipients:
        events.append(
            LedgerEvent(
                event_type=event_type,
                child_entry_id=recipient,
                amount=amount_per_child,
                chore_id=chore.id,
                occurrence_number=occurrence_number,
                note=note,
            )
        )
    return events


def _calculate_per_child_amount(chore: Chore) -> float:
    if chore.assignment_mode == ASSIGNMENT_MODE_TEAM and chore.pay_split_mode == PAY_SPLIT_SHARED:
        num_children = max(len(chore.assigned_to), 1)
        return round(chore.value / num_children, 2)
    return chore.value


async def handle_add_chore(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    data = call.data
    recurrence = data.get("recurrence", RECURRENCE_MANUAL)
    occurrences_required = data.get("occurrences_required", 1)

    chore = Chore(
        name=data["name"],
        value=data["value"],
        assigned_to=data["assigned_to"],
        description=data.get("description"),
        recurrence=recurrence,
        interval=data.get("interval", 1),
        occurrences_required=occurrences_required,
        occurrence_window_days=(
            _window_days_for_recurrence(recurrence, occurrences_required)
            if occurrences_required > 1 else None
        ),
        pay_mode=data.get("pay_mode", PAY_MODE_PER_OCCURRENCE),
        assignment_mode=data.get("assignment_mode", ASSIGNMENT_MODE_INDIVIDUAL),
        pay_split_mode=data.get("pay_split_mode", "full"),
    )
    setattr(chore, "category", data.get("category", "tidying"))
    if chore.recurrence != RECURRENCE_MANUAL:
        chore.next_due = _calculate_next_due(chore)

    await store.async_add_chore(chore)
    _fire_data_changed(hass)
    _LOGGER.info("HAPM: Added chore '%s' (id=%s)", chore.name, chore.id)


async def handle_update_chore(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    data = call.data
    chore_id = data["chore_id"]
    chore = store.get_chore(chore_id)
    if not chore:
        raise HomeAssistantError(f"HAPM: Chore '{chore_id}' not found.")

    if "name" in data:
        chore.name = data["name"]
    if "description" in data:
        chore.description = data["description"]
    if "value" in data:
        chore.value = data["value"]
    if "recurrence" in data:
        chore.recurrence = data["recurrence"]
        if chore.recurrence != RECURRENCE_MANUAL:
            chore.next_due = _calculate_next_due(chore)
        else:
            chore.next_due = None
    if "pay_mode" in data:
        chore.pay_mode = data["pay_mode"]
    if "occurrences_required" in data:
        chore.occurrences_required = data["occurrences_required"]
    if "category" in data:
        setattr(chore, "category", data["category"])
    if "occurrences_required" in data or "recurrence" in data:
        chore.occurrence_window_days = (
            _window_days_for_recurrence(chore.recurrence, chore.occurrences_required)
            if chore.occurrences_required > 1 else None
        )

    await store.async_update_chore(chore)
    _fire_data_changed(hass)
    _LOGGER.info("HAPM: Updated chore '%s' (id=%s)", chore.name, chore_id)


async def handle_complete_chore(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    chore_id = call.data["chore_id"]
    child_entry_id = call.data["child_entry_id"]
    note = call.data.get("note")

    chore = store.get_chore(chore_id)
    if not chore:
        raise HomeAssistantError(f"HAPM: Chore '{chore_id}' not found.")
    if not store.is_chore_active(chore):
        raise HomeAssistantError(f"HAPM: Chore '{chore.name}' is currently paused or disabled.")
    if chore.occurrences_required > 1:
        raise HomeAssistantError(
            f"HAPM: Chore '{chore.name}' requires multiple occurrences. Use log_occurrence instead."
        )

    amount = _calculate_per_child_amount(chore)
    events = _credit_children(chore, child_entry_id, amount, EVENT_CHORE_COMPLETED, note=note or chore.name)
    for event in events:
        await store.async_add_ledger_event(event)

    chore.last_completed = datetime.utcnow()
    chore.next_due = _calculate_next_due(chore)
    await store.async_update_chore(chore)
    _fire_data_changed(hass)
    _LOGGER.info("HAPM: Chore '%s' completed by '%s'. Credited: %.2f", chore.name, child_entry_id, amount)


async def handle_log_occurrence(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    chore_id = call.data["chore_id"]
    child_entry_id = call.data["child_entry_id"]
    note = call.data.get("note")

    chore = store.get_chore(chore_id)
    if not chore:
        raise HomeAssistantError(f"HAPM: Chore '{chore_id}' not found.")
    if not store.is_chore_active(chore):
        raise HomeAssistantError(f"HAPM: Chore '{chore.name}' is currently paused or disabled.")
    if chore.occurrences_required <= 1:
        raise HomeAssistantError(
            f"HAPM: Chore '{chore.name}' is a single-occurrence chore. Use complete_chore instead."
        )

    now = datetime.utcnow()
    window = store.get_open_window(chore_id)
    if window is None:
        window_days = chore.occurrence_window_days or _window_days_for_recurrence(
            chore.recurrence, chore.occurrences_required
        )
        window = OccurrenceWindow(
            chore_id=chore_id,
            window_start=now,
            window_end=now + timedelta(days=window_days),
            total_required=chore.occurrences_required,
        )
        await store.async_open_window(window)

    if now > window.window_end:
        window.status = OCCURRENCE_STATUS_EXPIRED
        await store.async_update_window(window)
        raise HomeAssistantError(
            f"HAPM: The occurrence window for '{chore.name}' has expired with "
            f"{window.total_completed}/{window.total_required} completions."
        )

    occurrence_number = window.total_completed + 1
    window.completions.append({
        "child_id": child_entry_id,
        "timestamp": now.isoformat(),
        "occurrence_number": occurrence_number,
    })

    amount = _calculate_per_child_amount(chore)

    if chore.pay_mode == PAY_MODE_PER_OCCURRENCE:
        per_occ_amount = round(amount / chore.occurrences_required, 2)
        events = _credit_children(
            chore, child_entry_id, per_occ_amount, EVENT_OCCURRENCE_LOGGED,
            occurrence_number=occurrence_number, note=note or chore.name,
        )
        for event in events:
            await store.async_add_ledger_event(event)

    if window.is_complete:
        window.status = OCCURRENCE_STATUS_COMPLETE
        chore.last_completed = now
        chore.next_due = _calculate_next_due(chore)
        await store.async_update_chore(chore)

        if chore.pay_mode == PAY_MODE_ON_COMPLETION:
            events = _credit_children(
                chore, child_entry_id, amount,
                EVENT_CHORE_COMPLETED,
                note=f"{chore.name} — all {chore.occurrences_required} occurrences complete",
            )
            for event in events:
                await store.async_add_ledger_event(event)

        _LOGGER.info("HAPM: Chore '%s' fully completed (%d/%d).", chore.name, occurrence_number, chore.occurrences_required)
    else:
        _LOGGER.info("HAPM: Occurrence %d/%d logged for '%s'.", occurrence_number, chore.occurrences_required, chore.name)

    await store.async_update_window(window)
    _fire_data_changed(hass)


async def handle_mark_paid(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    child_entry_id = call.data["child_entry_id"]
    note = call.data.get("note")
    balance = store.get_balance(child_entry_id)
    if balance <= 0:
        raise HomeAssistantError(f"HAPM: Child '{child_entry_id}' has no outstanding balance to pay.")
    await store.async_clear_balance(child_entry_id, note=note)
    _fire_data_changed(hass)
    _LOGGER.info("HAPM: Balance of %.2f paid for '%s'.", balance, child_entry_id)


async def handle_pause_chore(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    chore_id = call.data["chore_id"]
    days: Optional[int] = call.data.get("days")
    chore = store.get_chore(chore_id)
    if not chore:
        raise HomeAssistantError(f"HAPM: Chore '{chore_id}' not found.")
    await store.async_pause_chore(chore_id, days)
    _fire_data_changed(hass)
    if days is None:
        _LOGGER.info("HAPM: Chore '%s' paused indefinitely.", chore.name)
    else:
        _LOGGER.info("HAPM: Chore '%s' paused for %d day(s).", chore.name, days)


async def handle_resume_chore(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    chore_id = call.data["chore_id"]
    chore = store.get_chore(chore_id)
    if not chore:
        raise HomeAssistantError(f"HAPM: Chore '{chore_id}' not found.")
    await store.async_resume_chore(chore_id)
    _fire_data_changed(hass)
    _LOGGER.info("HAPM: Chore '%s' resumed.", chore.name)


async def handle_set_holiday_mode(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    days = call.data["days"]
    await store.async_set_holiday_mode(days)
    _fire_data_changed(hass)
    _LOGGER.info("HAPM: Holiday mode enabled for %d day(s).", days)


async def handle_clear_holiday_mode(call: ServiceCall, store: HAPMStore, hass: HomeAssistant) -> None:
    await store.async_clear_holiday_mode()
    _fire_data_changed(hass)
    _LOGGER.info("HAPM: Holiday mode cleared.")


def async_register_services(hass: HomeAssistant) -> None:
    def _get_store() -> HAPMStore:
        store = hass.data.get(DOMAIN, {}).get(DATA_STORE)
        if store is None:
            raise HomeAssistantError("HAPM store is not initialised.")
        return store

    async def _add_chore(call):    await handle_add_chore(call, _get_store(), hass)
    async def _update_chore(call): await handle_update_chore(call, _get_store(), hass)
    async def _complete_chore(call): await handle_complete_chore(call, _get_store(), hass)
    async def _log_occurrence(call): await handle_log_occurrence(call, _get_store(), hass)
    async def _mark_paid(call):    await handle_mark_paid(call, _get_store(), hass)
    async def _pause_chore(call):  await handle_pause_chore(call, _get_store(), hass)
    async def _resume_chore(call): await handle_resume_chore(call, _get_store(), hass)
    async def _set_holiday_mode(call):   await handle_set_holiday_mode(call, _get_store(), hass)
    async def _clear_holiday_mode(call): await handle_clear_holiday_mode(call, _get_store(), hass)

    hass.services.async_register(DOMAIN, SERVICE_ADD_CHORE,       _add_chore,    schema=SCHEMA_ADD_CHORE)
    hass.services.async_register(DOMAIN, SERVICE_UPDATE_CHORE,    _update_chore, schema=SCHEMA_UPDATE_CHORE)
    hass.services.async_register(DOMAIN, SERVICE_COMPLETE_CHORE,  _complete_chore, schema=SCHEMA_COMPLETE_CHORE)
    hass.services.async_register(DOMAIN, SERVICE_LOG_OCCURRENCE,  _log_occurrence, schema=SCHEMA_LOG_OCCURRENCE)
    hass.services.async_register(DOMAIN, SERVICE_MARK_PAID,       _mark_paid,    schema=SCHEMA_MARK_PAID)
    hass.services.async_register(DOMAIN, SERVICE_PAUSE_CHORE,     _pause_chore,  schema=SCHEMA_PAUSE_CHORE)
    hass.services.async_register(DOMAIN, SERVICE_RESUME_CHORE,    _resume_chore, schema=SCHEMA_RESUME_CHORE)
    hass.services.async_register(DOMAIN, SERVICE_SET_HOLIDAY_MODE,   _set_holiday_mode,   schema=SCHEMA_SET_HOLIDAY_MODE)
    hass.services.async_register(DOMAIN, SERVICE_CLEAR_HOLIDAY_MODE, _clear_holiday_mode, schema=SCHEMA_CLEAR_HOLIDAY_MODE)
    _LOGGER.debug("HAPM: All services registered.")
