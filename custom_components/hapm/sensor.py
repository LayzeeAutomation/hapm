"""Sensor platform for HAPM - Home Assistant Pocket Money."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_CHILD_NAME, CONF_CURRENCY, DATA_BALANCE, DEFAULT_CURRENCY, DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up HAPM sensors for a child."""
    child_name = entry.data[CONF_CHILD_NAME]
    currency = entry.data.get(CONF_CURRENCY, DEFAULT_CURRENCY)

    async_add_entities(
        [
            HAPMBalanceSensor(hass, entry, child_name, currency),
        ],
        update_before_add=True,
    )


class HAPMBalanceSensor(SensorEntity):
    """Sensor showing current owed balance for a child."""

    _attr_state_class = SensorStateClass.TOTAL

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        child_name: str,
        currency: str,
    ) -> None:
        """Initialise the balance sensor."""
        self._hass = hass
        self._entry = entry
        self._child_name = child_name
        self._attr_native_unit_of_measurement = currency
        self._attr_name = f"{child_name} Pocket Money Balance"
        self._attr_unique_id = f"hapm_{entry.entry_id}_balance"
        self._attr_native_value: float = 0.0

    async def async_update(self) -> None:
        """Fetch current balance from integration store."""
        store = self._hass.data.get(DOMAIN, {}).get(self._entry.entry_id, {})
        self._attr_native_value = store.get(DATA_BALANCE, 0.0)
