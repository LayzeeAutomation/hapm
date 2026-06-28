"""Register the HAPM Lovelace card resource.

Registers the card JS as a persistent Lovelace resource using HA's
ResourceStorageCollection, so it survives restarts and appears in the
dashboard card picker without any manual steps.

The resource URL includes a ?v= query string that must be bumped
whenever the JS file changes so that browsers (especially iOS Safari
which caches aggressively) fetch the new version.

Registration is deferred to EVENT_HOMEASSISTANT_STARTED so Lovelace is
fully initialised — this is the correct pattern for fresh installs.
"""
from __future__ import annotations

import asyncio
import logging
import pathlib

from homeassistant.components.http import StaticPathConfig
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

# Bump this every time hapm-panel-card.js changes.
CARD_VERSION = "0.1.3"
CARD_BASE_URL = "/hapm_static/hapm-panel-card.js"
CARD_URL = f"{CARD_BASE_URL}?v={CARD_VERSION}"
WWW_DIR = pathlib.Path(__file__).parent / "www"

REGISTER_RETRIES = 5
REGISTER_RETRY_DELAY = 2  # seconds


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card JS and schedule Lovelace resource registration."""

    # Serve www/ directory under /hapm_static/
    # cache_headers=False — the ?v= query string is the sole cache-busting mechanism.
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/hapm_static", str(WWW_DIR), cache_headers=False)]
    )

    if hass.is_running:
        # HA already started (e.g. integration reload) — register immediately.
        registered = await _ensure_lovelace_resource(hass)
        if not registered:
            hass.async_create_task(_retry_registration(hass))
    else:
        # Fresh start / install — wait until HA has fully booted so that
        # Lovelace and its resource collection are guaranteed to be ready.
        async def _on_started(event) -> None:  # noqa: ANN001
            registered = await _ensure_lovelace_resource(hass)
            if not registered:
                hass.async_create_task(_retry_registration(hass))

        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _on_started)


async def _retry_registration(hass: HomeAssistant) -> None:
    """Retry resource registration until Lovelace is ready."""
    for attempt in range(1, REGISTER_RETRIES + 1):
        await asyncio.sleep(REGISTER_RETRY_DELAY)
        _LOGGER.debug(
            "HAPM: Retrying Lovelace resource registration (attempt %d/%d)",
            attempt, REGISTER_RETRIES,
        )
        if await _ensure_lovelace_resource(hass):
            return
    _LOGGER.warning(
        "HAPM: Could not register Lovelace resource after %d attempts. "
        "Add manually: Settings \u2192 Dashboards \u2192 Resources \u2192 %s (JavaScript Module)",
        REGISTER_RETRIES, CARD_URL,
    )


async def _ensure_lovelace_resource(hass: HomeAssistant) -> bool:
    """Add (or update) the card URL in Lovelace resources.

    Returns True if the resource is confirmed registered, False if Lovelace
    was not ready yet (caller should retry).
    """
    try:
        # HA stores a LovelaceData *object* at hass.data["lovelace"] —
        # resources is an attribute, NOT a dict key.
        lovelace = hass.data.get("lovelace")
        if lovelace is None:
            _LOGGER.debug("HAPM: hass.data['lovelace'] not present yet, will retry.")
            return False

        resources = getattr(lovelace, "resources", None)
        if resources is None or not hasattr(resources, "async_create_item"):
            _LOGGER.debug("HAPM: Lovelace resource collection not ready yet, will retry.")
            return False

        await resources.async_load()
        items = resources.async_items()

        # Remove any stale HAPM resource entries (old versions or unversioned)
        for item in list(items):
            if CARD_BASE_URL in item["url"] and item["url"] != CARD_URL:
                _LOGGER.info("HAPM: Removing stale resource entry: %s", item["url"])
                try:
                    await resources.async_delete_item(item["id"])
                except Exception:  # noqa: BLE001
                    pass

        # Re-check after deletions
        existing_urls = {item["url"] for item in resources.async_items()}
        if CARD_URL in existing_urls:
            _LOGGER.debug("HAPM: Card resource already registered at %s", CARD_URL)
            return True

        await resources.async_create_item({"res_type": "module", "url": CARD_URL})
        _LOGGER.info("HAPM: Card resource registered at %s", CARD_URL)
        return True

    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("HAPM: Unexpected error registering Lovelace resource: %s", err)
        return False
