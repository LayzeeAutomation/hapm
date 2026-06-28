"""Register the HAPM Lovelace card resource.

Registers the card JS as a persistent Lovelace resource using HA's
ResourceStorageCollection, so it survives restarts and appears in the
dashboard card picker without any manual steps.
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
    """Serve the card JS and register it as a persistent Lovelace resource."""

    # Serve www/ directory under /hapm_static/
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/hapm_static", str(WWW_DIR), cache_headers=True)]
    )

    # Register as a persistent Lovelace resource via the storage collection.
    # This is the only method that reliably survives HA restarts for custom integrations.
    await _ensure_lovelace_resource(hass)


async def _ensure_lovelace_resource(hass: HomeAssistant) -> None:
    """Add the card URL to Lovelace resources if not already present."""
    try:
        from homeassistant.components.lovelace.resources import ResourceStorageCollection  # noqa: PLC0415

        # HA stores the resource collection in hass.data["lovelace"]["resources"]
        lovelace_data = hass.data.get("lovelace", {})
        resources: ResourceStorageCollection | None = lovelace_data.get("resources")

        if resources is None:
            _LOGGER.warning(
                "HAPM: Lovelace resource collection not available. "
                "Add manually: Settings → Dashboards → Resources → %s (JavaScript Module)",
                CARD_URL,
            )
            return

        await resources.async_load()

        # Check if already registered
        existing_urls = {item["url"] for item in resources.async_items()}
        if CARD_URL in existing_urls:
            _LOGGER.debug("HAPM: Card resource already registered.")
            return

        await resources.async_create_item({"res_type": "module", "url": CARD_URL})
        _LOGGER.info("HAPM: Card resource registered at %s", CARD_URL)

    except ImportError:
        _LOGGER.warning("HAPM: Could not import lovelace resources module.")
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning(
            "HAPM: Could not register Lovelace resource automatically (%s). "
            "Add manually: Settings → Dashboards → Resources → %s (JavaScript Module)",
            err, CARD_URL,
        )
