"""Register the HAPM Lovelace card resource.

Uses HA's lovelace resource storage so the card persists across restarts
and shows up reliably in the dashboard card picker.
"""
from __future__ import annotations

import logging
import pathlib

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

CARD_URL = "/hapm_static/hapm-panel-card.js"
WWW_DIR = pathlib.Path(__file__).parent / "www"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card JS and register it as a Lovelace resource."""

    # 1. Serve the www/ directory under /hapm_static/
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/ hapm_static", str(WWW_DIR), cache_headers=False)]
    )

    # 2. Register as a Lovelace resource via resource storage
    # This is the reliable way — it persists and shows in the card picker.
    try:
        from homeassistant.components.lovelace import resources as ll_resources  # noqa: PLC0415

        resource_collection = await _get_resource_collection(hass)
        if resource_collection is None:
            _LOGGER.warning("HAPM: Could not access Lovelace resource collection.")
            return

        # Check if already registered to avoid duplicates
        existing = [
            item["url"] for item in resource_collection.async_items()
        ]
        if CARD_URL not in existing:
            await resource_collection.async_create_item(
                {"res_type": "module", "url": CARD_URL}
            )
            _LOGGER.debug("HAPM: Lovelace resource registered at %s", CARD_URL)
        else:
            _LOGGER.debug("HAPM: Lovelace resource already registered at %s", CARD_URL)

    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("HAPM: Could not register Lovelace resource automatically: %s", err)
        _LOGGER.warning(
            "HAPM: Add manually in Settings → Dashboards → Resources: "
            "URL=%s, Type=JavaScript Module", CARD_URL
        )


async def _get_resource_collection(hass: HomeAssistant):
    """Return the Lovelace resource collection, or None if unavailable."""
    try:
        lovelace = hass.data.get("lovelace")
        if lovelace is None:
            return None
        resource_collection = lovelace.get("resources")
        if resource_collection is None:
            return None
        if not hasattr(resource_collection, "async_load"):
            return None
        await resource_collection.async_load()
        return resource_collection
    except Exception:  # noqa: BLE001
        return None
