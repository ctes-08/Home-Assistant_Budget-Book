"""Small Home Assistant boundary doubles for offline integration checks."""
import copy
import importlib
import importlib.util
import sys
import types
from datetime import datetime
from enum import Enum
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
if (ROOT / ".test-deps").exists():
    sys.path.insert(0, str(ROOT / ".test-deps"))


class Services:
    def __init__(self):
        self.registered = {}

    def async_register(self, domain, name, handler, **options):
        self.registered[(domain, name)] = (handler, options)

    async def call(self, name, **data):
        handler, options = self.registered[("budget_book", name)]
        return await handler(types.SimpleNamespace(data=options["schema"](data)))


class Hass:
    def __init__(self):
        self.data = {}
        self.storage = {}
        self.services = Services()
        self.schedules = []
        self.signals = []


class Store:
    def __init__(self, hass, _version, key):
        self.hass = hass
        self.key = key

    async def async_load(self):
        return copy.deepcopy(self.hass.storage.get(self.key))

    async def async_save(self, data):
        self.hass.storage[self.key] = copy.deepcopy(data)


class ServiceValidationError(Exception):
    pass


def load_integration():
    modules = {}
    clock = types.SimpleNamespace(value=datetime(2026, 10, 13, 12, tzinfo=ZoneInfo("Asia/Taipei")))

    def module(name, **attrs):
        item = types.ModuleType(name)
        item.__path__ = []
        item.__dict__.update(attrs)
        modules[name] = item
        return item

    def subscribe(collection, callback, **options):
        item = {"callback": callback, "options": options, "active": True}
        collection.append(item)
        return lambda: item.update(active=False)

    def send(hass, _signal):
        for item in hass.signals:
            if item["active"]:
                item["callback"]()

    class SupportsResponse(Enum):
        ONLY = 2

    for name in ("homeassistant", "homeassistant.components", "homeassistant.helpers", "homeassistant.util"):
        module(name)
    module("homeassistant.components.frontend", async_register_built_in_panel=lambda *a, **k: None)
    module("homeassistant.components.http", StaticPathConfig=object)
    module("homeassistant.components.sensor", SensorEntity=object,
           SensorStateClass=types.SimpleNamespace(MEASUREMENT="measurement", TOTAL_INCREASING="total_increasing"))
    module("homeassistant.config_entries", ConfigEntry=object)
    module("homeassistant.core", HomeAssistant=Hass, ServiceCall=object,
           SupportsResponse=SupportsResponse, callback=lambda func: func)
    module("homeassistant.exceptions", ServiceValidationError=ServiceValidationError)
    module("homeassistant.helpers.config_validation", string=str)
    module("homeassistant.helpers.dispatcher",
           async_dispatcher_connect=lambda hass, signal, cb: subscribe(hass.signals, cb),
           async_dispatcher_send=send)
    module("homeassistant.helpers.event",
           async_track_time_change=lambda hass, cb, **opts: subscribe(hass.schedules, cb, **opts))
    module("homeassistant.helpers.entity", EntityCategory=types.SimpleNamespace(DIAGNOSTIC="diagnostic"))
    module("homeassistant.helpers.entity_platform", AddEntitiesCallback=object)
    module("homeassistant.helpers.storage", Store=Store)
    module("homeassistant.util.dt", now=lambda: clock.value)

    package = "budget_book_under_test"
    spec = importlib.util.spec_from_file_location(
        package, ROOT / "custom_components/budget_book/__init__.py",
        submodule_search_locations=[str(ROOT / "custom_components/budget_book")],
    )
    core = importlib.util.module_from_spec(spec)
    modules[package] = core
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(core)
        sensor = importlib.import_module(package + ".sensor")
    return core, sensor, clock
