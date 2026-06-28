"""Register the HAPM Lovelace card as a frontend resource.

Compatible with HA 2024.7+ which replaced hass.http.register_static_path()
with hass.http.async_register_static_paths(StaticPathConfig(...)).
"""
from __future__ import annotations

import logging
import pathlib

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.core import HomeAssistant

try:
    from homeassistant.components.http import StaticPathConfig
    _USE_STATIC_PATH_CONFIG = True
except ImportError:
    _USE_STATIC_PATH_CONFIG = False

_LOGGER = logging.getLogger(__name__)

CARD_URL = "/hapm_static/hapm-panel-card.js"
WWW_DIR = pathlib.Path(__file__).parent / "www"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card JS and register it as a Lovelace resource."""
    if _USE_STATIC_PATH_CONFIG:
        # HA 2024.7+
        await hass.http.async_register_static_paths(
            [StaticPathConfig("/hapm_static", str(WWW_DIR), cache_headers=True)]
        )
    else:
        # Older HA builds
        hass.http.register_static_path("/hapm_static", str(WWW_DIR), cache_headers=True)

    add_extra_js_url(hass, CARD_URL)
    _LOGGER.debug("HAPM: Lovelace card registered at %s", CARD_URL)
