"""Home Assistant Pocket Money (HAPM).

A custom integration for tracking children's chores and pocket money balances.
Supports multiple children via separate config entries, recurring chore schedules,
running balance tracking, and payment/reset workflow.
"""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DATA_STORE, DOMAIN, PLATFORMS
from .frontend import async_register_frontend
from .scheduler import async_setup_scheduler, DATA_SCHEDULER_UNSUB
from .services import async_register_services
from .store import HAPMStore


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up HAPM integration."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up HAPM from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Initialise shared store, services and scheduler once across all entries
    if DATA_STORE not in hass.data[DOMAIN]:
        store = HAPMStore(hass)
        await store.async_load()
        hass.data[DOMAIN][DATA_STORE] = store

        async_register_services(hass)

        unsub = async_setup_scheduler(hass)
        hass.data[DOMAIN][DATA_SCHEDULER_UNSUB] = unsub

    # Always register / re-register the Lovelace card resource on every startup.
    # This ensures the versioned URL is present even after a cache-bust version bump
    # or if the previous registration was lost. The function is idempotent — it
    # removes any stale entries and only creates a new one when needed.
    await async_register_frontend(hass)

    hass.data[DOMAIN][entry.entry_id] = {}
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    remaining = [
        k for k in hass.data[DOMAIN]
        if k not in (DATA_STORE, DATA_SCHEDULER_UNSUB)
    ]
    if not remaining:
        unsub = hass.data[DOMAIN].pop(DATA_SCHEDULER_UNSUB, None)
        if unsub:
            unsub()
        hass.data[DOMAIN].pop(DATA_STORE, None)

    return unload_ok
