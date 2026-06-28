"""Home Assistant Pocket Money (HAPM).

A custom integration for tracking children's chores and pocket money balances.
Supports multiple children via separate config entries, recurring chore schedules,
running balance tracking, and payment/reset workflow.
"""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DATA_STORE, DOMAIN, PLATFORMS
from .services import async_register_services
from .store import HAPMStore


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up HAPM integration."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up HAPM from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Initialise the shared store once across all child entries
    if DATA_STORE not in hass.data[DOMAIN]:
        store = HAPMStore(hass)
        await store.async_load()
        hass.data[DOMAIN][DATA_STORE] = store
        # Register services the first time any entry loads
        async_register_services(hass)

    hass.data[DOMAIN][entry.entry_id] = {}

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    # Remove the store only when no child entries remain
    remaining = [k for k in hass.data[DOMAIN] if k != DATA_STORE]
    if not remaining:
        hass.data[DOMAIN].pop(DATA_STORE, None)

    return unload_ok
