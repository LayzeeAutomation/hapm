"""Sensor platform for HAPM - Home Assistant Pocket Money."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_CHILD_NAME, CONF_CURRENCY, DATA_STORE, DEFAULT_CURRENCY, DOMAIN
from .store import HAPMStore


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up HAPM sensors for a child."""
    child_name = entry.data[CONF_CHILD_NAME]
    currency = entry.data.get(CONF_CURRENCY, DEFAULT_CURRENCY)
    store: HAPMStore = hass.data[DOMAIN][DATA_STORE]

    async_add_entities(
        [
            HAPMBalanceSensor(entry, child_name, currency, store),
            HAPMChoresDueSensor(entry, child_name, store),
        ],
        update_before_add=True,
    )


class HAPMBalanceSensor(SensorEntity):
    """Current owed pocket money balance for a child."""

    _attr_state_class = SensorStateClass.TOTAL
    _attr_icon = "mdi:piggy-bank"

    def __init__(
        self,
        entry: ConfigEntry,
        child_name: str,
        currency: str,
        store: HAPMStore,
    ) -> None:
        """Initialise the balance sensor."""
        self._entry = entry
        self._child_name = child_name
        self._store = store
        self._attr_native_unit_of_measurement = currency
        self._attr_name = f"{child_name} Pocket Money Balance"
        self._attr_unique_id = f"hapm_{entry.entry_id}_balance"
        self._attr_native_value: float = 0.0

    async def async_update(self) -> None:
        """Read balance from the store."""
        self._attr_native_value = round(
            self._store.get_balance(self._entry.entry_id), 2
        )


class HAPMChoresDueSensor(SensorEntity):
    """Number of active chores currently due for a child."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:format-list-checks"
    _attr_native_unit_of_measurement = "chores"

    def __init__(
        self,
        entry: ConfigEntry,
        child_name: str,
        store: HAPMStore,
    ) -> None:
        """Initialise the chores due sensor."""
        self._entry = entry
        self._child_name = child_name
        self._store = store
        self._attr_name = f"{child_name} Chores Due"
        self._attr_unique_id = f"hapm_{entry.entry_id}_chores_due"
        self._attr_native_value: int = 0

    async def async_update(self) -> None:
        """Count active due chores for this child."""
        from datetime import datetime
        now = datetime.utcnow()
        due = 0
        for chore in self._store.get_chores_for_child(self._entry.entry_id):
            if not self._store.is_chore_active(chore):
                continue
            if chore.next_due and chore.next_due <= now:
                due += 1
        self._attr_native_value = due
