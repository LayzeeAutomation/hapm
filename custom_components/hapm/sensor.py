"""Sensor platform for HAPM - Home Assistant Pocket Money."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval

from .const import (
    CONF_AVATAR_COLOUR,
    CONF_CHILD_NAME,
    CONF_CURRENCY_SYMBOL,
    DATA_STORE,
    DOMAIN,
    EVENT_HAPM_DATA_CHANGED,
    RECURRENCE_MANUAL,
)
from .store import HAPMStore

_LOGGER = logging.getLogger(__name__)

SENSOR_UPDATE_INTERVAL = timedelta(minutes=1)
LEDGER_MAX_ENTRIES = 50


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    store: HAPMStore = hass.data[DOMAIN][DATA_STORE]
    child_name = entry.data[CONF_CHILD_NAME]
    currency = entry.data.get(CONF_CURRENCY_SYMBOL, "\u00a3")
    colour = entry.data.get(CONF_AVATAR_COLOUR, "teal")

    balance_sensor = HAPMBalanceSensor(
        hass, store, entry.entry_id, child_name, currency, colour
    )
    chores_due_sensor = HAPMChoresDueSensor(
        hass, store, entry.entry_id, child_name, colour
    )

    async_add_entities([balance_sensor, chores_due_sensor], update_before_add=True)


class HAPMBalanceSensor(SensorEntity):
    _attr_state_class = SensorStateClass.TOTAL
    _attr_should_poll = False

    def __init__(self, hass, store, child_entry_id, child_name, currency, colour):
        self._hass = hass
        self._store = store
        self._child_entry_id = child_entry_id
        self._child_name = child_name
        self._currency = currency
        self._colour = colour
        self._attr_unique_id = f"hapm_{child_entry_id}_balance"
        self._attr_name = f"{child_name} Pocket Money Balance"
        self._attr_native_unit_of_measurement = currency
        self._attr_icon = "mdi:piggy-bank"
        self._unsub_interval = None
        self._unsub_event = None

    async def async_added_to_hass(self) -> None:
        self._unsub_interval = async_track_time_interval(self._hass, self._async_update_and_write, SENSOR_UPDATE_INTERVAL)
        self._unsub_event = self._hass.bus.async_listen(EVENT_HAPM_DATA_CHANGED, self._on_data_changed)

    async def async_will_remove_from_hass(self) -> None:
        if self._unsub_interval:
            self._unsub_interval()
        if self._unsub_event:
            self._unsub_event()

    @callback
    def _on_data_changed(self, _event) -> None:
        self.async_write_ha_state()

    @callback
    async def _async_update_and_write(self, _now) -> None:
        self.async_write_ha_state()

    @property
    def native_value(self) -> float:
        return round(self._store.get_balance(self._child_entry_id), 2)

    @property
    def extra_state_attributes(self) -> dict:
        all_entries = self._store.get_ledger_for_child(self._child_entry_id)
        last_payment = next((e for e in reversed(all_entries) if e.event_type == "payment_made"), None)
        recent = list(reversed(all_entries[-LEDGER_MAX_ENTRIES:]))
        return {
            "entry_id": self._child_entry_id,
            "child_name": self._child_name,
            "avatar_colour": self._colour,
            "currency": self._currency,
            "ledger_event_count": len(all_entries),
            "last_paid": last_payment.timestamp.isoformat() if last_payment else None,
            "ledger": [
                {
                    "event_type": e.event_type,
                    "amount": round(e.amount, 2),
                    "timestamp": e.timestamp.isoformat(),
                    "note": e.note or "",
                }
                for e in recent
            ],
        }


class HAPMChoresDueSensor(SensorEntity):
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_should_poll = False

    def __init__(self, hass, store, child_entry_id, child_name, colour):
        self._hass = hass
        self._store = store
        self._child_entry_id = child_entry_id
        self._child_name = child_name
        self._colour = colour
        self._attr_unique_id = f"hapm_{child_entry_id}_chores_due"
        self._attr_name = f"{child_name} Chores Due"
        self._attr_native_unit_of_measurement = "chores"
        self._attr_icon = "mdi:checkbox-marked-circle-outline"
        self._unsub_interval = None
        self._unsub_event = None

    async def async_added_to_hass(self) -> None:
        self._unsub_interval = async_track_time_interval(self._hass, self._async_update_and_write, SENSOR_UPDATE_INTERVAL)
        self._unsub_event = self._hass.bus.async_listen(EVENT_HAPM_DATA_CHANGED, self._on_data_changed)

    async def async_will_remove_from_hass(self) -> None:
        if self._unsub_interval:
            self._unsub_interval()
        if self._unsub_event:
            self._unsub_event()

    @callback
    def _on_data_changed(self, _event) -> None:
        self.async_write_ha_state()

    @callback
    async def _async_update_and_write(self, _now) -> None:
        self.async_write_ha_state()

    def _serialize_chore(self, c) -> dict:
        return {
            "id": c.id,
            "name": c.name,
            "value": c.value,
            "recurrence": c.recurrence,
            "next_due": c.next_due.isoformat() if c.next_due else None,
            "last_completed": c.last_completed.isoformat() if c.last_completed else None,
            "occurrences_required": c.occurrences_required,
            "occurrences_completed": (
                self._store.get_open_window(c.id).total_completed
                if c.occurrences_required > 1 and self._store.get_open_window(c.id)
                else 0
            ),
            "description": c.description,
            "category": c.category,
            "pay_mode": c.pay_mode,
            "assignment_mode": c.assignment_mode,
            "pay_split_mode": c.pay_split_mode,
            "paused_until": c.paused_until.isoformat() if c.paused_until else None,
            "enabled": c.enabled,
        }

    def _get_due_chores(self):
        now = datetime.utcnow()
        due = []
        for chore in self._store.get_chores():
            if self._child_entry_id not in chore.assigned_to:
                continue
            if not self._store.is_chore_active(chore):
                continue
            if chore.recurrence != RECURRENCE_MANUAL:
                if chore.next_due is None or chore.next_due > now:
                    continue
            due.append(chore)
        return due

    def _get_paused_chores(self):
        paused = []
        for chore in self._store.get_chores():
            if self._child_entry_id not in chore.assigned_to:
                continue
            if not chore.enabled:
                continue
            if self._store.is_paused(chore):
                paused.append(chore)
        return paused

    def _get_all_chores(self):
        return [
            c for c in self._store.get_chores()
            if self._child_entry_id in c.assigned_to and c.enabled
        ]

    @property
    def native_value(self) -> int:
        return len(self._get_due_chores())

    @property
    def extra_state_attributes(self) -> dict:
        due_chores    = self._get_due_chores()
        paused_chores = self._get_paused_chores()
        all_chores    = self._get_all_chores()
        due_ids    = {c.id for c in due_chores}
        paused_ids = {c.id for c in paused_chores}
        complete_chores = [c for c in all_chores if c.id not in due_ids and c.id not in paused_ids]
        return {
            "entry_id": self._child_entry_id,
            "child_name": self._child_name,
            "avatar_colour": self._colour,
            "due_chores":      [self._serialize_chore(c) for c in due_chores],
            "paused_chores":   [self._serialize_chore(c) for c in paused_chores],
            "complete_chores": [self._serialize_chore(c) for c in complete_chores],
        }
