"""Register the HAPM Lovelace card as a frontend resource.

This runs on integration setup so HACS users get the card
automatically — no manual resource registration needed.
"""
from __future__ import annotations

import logging
import pathlib

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

CARD_URL = "/hapm_static/hapm-panel-card.js"
WWW_DIR = pathlib.Path(__file__).parent / "www"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card JS and register it as a Lovelace resource."""
    # Serve the www/ directory under /hapm_static/
    hass.http.register_static_path(
        "/hapm_static",
        str(WWW_DIR),
        cache_headers=True,
    )
    # Inject the card into every Lovelace page automatically
    add_extra_js_url(hass, CARD_URL)
    _LOGGER.debug("HAPM: Lovelace card registered at %s", CARD_URL)
