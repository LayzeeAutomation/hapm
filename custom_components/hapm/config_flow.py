"""Config flow for HAPM - Home Assistant Pocket Money."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import CONF_CHILD_NAME, CONF_CURRENCY, DEFAULT_CURRENCY, DOMAIN


class HAPMConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the initial config flow to add a child profile."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> FlowResult:
        """Step 1: enter child name and currency."""
        errors: dict[str, str] = {}

        if user_input is not None:
            child_name = user_input[CONF_CHILD_NAME].strip()
            if not child_name:
                errors[CONF_CHILD_NAME] = "invalid_child_name"
            else:
                await self.async_set_unique_id(child_name.lower())
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=child_name,
                    data={
                        CONF_CHILD_NAME: child_name,
                        CONF_CURRENCY: user_input.get(CONF_CURRENCY, DEFAULT_CURRENCY),
                    },
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_CHILD_NAME): str,
                vol.Optional(CONF_CURRENCY, default=DEFAULT_CURRENCY): str,
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )
