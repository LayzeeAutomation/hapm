"""Home Assistant Pocket Money (HAPM).

A custom integration for tracking children's chores and pocket money balances.
Supports multiple children via separate config entries, recurring chore schedules,
running balance tracking, and payment/reset workflow.
"""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DATA_STORE, DOMAIN, PLATFORMS
from .store import HAPMStore


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up HAPM integration."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up HAPM from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Initialise and load the shared store (one instance for the whole integration)
    if DATA_STORE not in hass.data[DOMAIN]:
        store = HAPMStore(hass)
        await store.async_load()
        hass.data[DOMAIN][DATA_STORE] = store

    hass.data[DOMAIN][entry.entry_id] = {}

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    # Remove the store only when no child entries remain
    remaining = [
        k for k in hass.data[DOMAIN]
        if k not in (DATA_STORE,)
    ]
    if not remaining and DATA_STORE in hass.data[DOMAIN]:
        hass.data[DOMAIN].pop(DATA_STORE)

    return unload_ok
