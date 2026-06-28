"""Register the HAPM Lovelace card resource."""
from __future__ import annotations

import asyncio
import logging
import pathlib

from homeassistant.components.http import StaticPathConfig
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

CARD_VERSION = "0.1.10"
CARD_BASE_URL = "/hapm_static/hapm-panel-card.js"
CARD_URL = f"{CARD_BASE_URL}?v={CARD_VERSION}"
WWW_DIR = pathlib.Path(__file__).parent / "www"

REGISTER_RETRIES = 5
REGISTER_RETRY_DELAY = 2


async def async_register_frontend(hass: HomeAssistant) -> None:
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/hapm_static", str(WWW_DIR), cache_headers=False)]
    )
    if hass.is_running:
        registered = await _ensure_lovelace_resource(hass)
        if not registered:
            hass.async_create_task(_retry_registration(hass))
    else:
        async def _on_started(event) -> None:
            registered = await _ensure_lovelace_resource(hass)
            if not registered:
                hass.async_create_task(_retry_registration(hass))
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _on_started)


async def _retry_registration(hass: HomeAssistant) -> None:
    for attempt in range(1, REGISTER_RETRIES + 1):
        await asyncio.sleep(REGISTER_RETRY_DELAY)
        if await _ensure_lovelace_resource(hass):
            return
    _LOGGER.warning(
        "HAPM: Could not register Lovelace resource after %d attempts. "
        "Add manually: Settings \u2192 Dashboards \u2192 Resources \u2192 %s (JavaScript Module)",
        REGISTER_RETRIES, CARD_URL,
    )


async def _ensure_lovelace_resource(hass: HomeAssistant) -> bool:
    try:
        lovelace = hass.data.get("lovelace")
        if lovelace is None:
            return False
        resources = getattr(lovelace, "resources", None)
        if resources is None or not hasattr(resources, "async_create_item"):
            return False
        await resources.async_load()
        items = resources.async_items()
        for item in list(items):
            if CARD_BASE_URL in item["url"] and item["url"] != CARD_URL:
                try:
                    await resources.async_delete_item(item["id"])
                except Exception:
                    pass
        existing_urls = {item["url"] for item in resources.async_items()}
        if CARD_URL in existing_urls:
            return True
        await resources.async_create_item({"res_type": "module", "url": CARD_URL})
        _LOGGER.info("HAPM: Card resource registered at %s", CARD_URL)
        return True
    except Exception as err:
        _LOGGER.warning("HAPM: Unexpected error registering Lovelace resource: %s", err)
        return False
