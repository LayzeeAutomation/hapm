"""Register the HAPM Lovelace card resource."""
from __future__ import annotations

import logging
import pathlib

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

CARD_URL = "/hapm_static/hapm-panel-card.js"
WWW_DIR = pathlib.Path(__file__).parent / "www"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card JS and register it as a Lovelace resource."""

    # Serve www/ under /hapm_static/ (note: no space in the path!)
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/hapm_static", str(WWW_DIR), cache_headers=False)]
    )

    # Inject into every Lovelace page — this is what makes it appear in the card picker
    add_extra_js_url(hass, CARD_URL)
    _LOGGER.debug("HAPM: Lovelace card registered at %s", CARD_URL)
