"""Config flow for HAPM - Home Assistant Pocket Money."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import CONF_CHILD_NAME, CONF_AVATAR_COLOUR, CONF_CURRENCY_SYMBOL, DOMAIN

AVATAR_COLOURS = [
    "red", "orange", "yellow", "green", "teal",
    "blue", "purple", "pink", "grey",
]


class HAPMConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for HAPM."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> config_entries.FlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            name = user_input[CONF_CHILD_NAME].strip()
            if not name:
                errors[CONF_CHILD_NAME] = "name_required"
            else:
                # Prevent duplicate child names
                existing = [
                    e.data[CONF_CHILD_NAME]
                    for e in self._async_current_entries()
                ]
                if name in existing:
                    errors[CONF_CHILD_NAME] = "name_exists"

            if not errors:
                return self.async_create_entry(
                    title=name,
                    data={
                        CONF_CHILD_NAME: name,
                        CONF_AVATAR_COLOUR: user_input[CONF_AVATAR_COLOUR],
                        CONF_CURRENCY_SYMBOL: user_input.get(CONF_CURRENCY_SYMBOL, "£"),
                    },
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_CHILD_NAME): str,
                vol.Optional(CONF_AVATAR_COLOUR, default="teal"): vol.In(AVATAR_COLOURS),
                vol.Optional(CONF_CURRENCY_SYMBOL, default="£"): str,
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Return the options flow."""
        return HAPMOptionsFlow(config_entry)


class HAPMOptionsFlow(config_entries.OptionsFlow):
    """Handle HAPM options (edit child settings)."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._entry = config_entry

    async def async_step_init(
        self, user_input: dict | None = None
    ) -> config_entries.FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_AVATAR_COLOUR,
                    default=self._entry.data.get(CONF_AVATAR_COLOUR, "teal"),
                ): vol.In(AVATAR_COLOURS),
                vol.Optional(
                    CONF_CURRENCY_SYMBOL,
                    default=self._entry.data.get(CONF_CURRENCY_SYMBOL, "£"),
                ): str,
            }
        )

        return self.async_show_form(step_id="init", data_schema=schema)
