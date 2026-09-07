from app.catalog.adapters.base import BrandAdapter
from app.catalog.adapters.bluebonnet import BluebonnetAdapter
from app.catalog.adapters.gaia_herbs import GaiaHerbsAdapter
from app.catalog.adapters.garden_of_life import GardenOfLifeAdapter
from app.catalog.adapters.life_extension import LifeExtensionAdapter
from app.catalog.adapters.maryruths import MaryruthsAdapter
from app.catalog.adapters.megafood import MegafoodAdapter
from app.catalog.adapters.natures_way import NaturesWayAdapter
from app.catalog.adapters.naturesplus import NaturesplusAdapter
from app.catalog.adapters.now_foods import NowFoodsAdapter
from app.catalog.adapters.solgar import SolgarAdapter
from app.catalog.adapters.twinlab import TwinlabAdapter
from app.catalog.adapters.vital_planet import VitalPlanetAdapter
from app.catalog.adapters.woodstock import WoodstockAdapter

_ADAPTERS: dict[str, type[BrandAdapter]] = {
    "solgar": SolgarAdapter,
    "life-extension": LifeExtensionAdapter,
    "natures-way": NaturesWayAdapter,
    "twinlab": TwinlabAdapter,
    "now-foods": NowFoodsAdapter,
    "garden-of-life": GardenOfLifeAdapter,
    "bluebonnet": BluebonnetAdapter,
    "megafood": MegafoodAdapter,
    "maryruths": MaryruthsAdapter,
    "naturesplus": NaturesplusAdapter,
    "woodstock-foods": WoodstockAdapter,
    "gaia-herbs": GaiaHerbsAdapter,
    "vital-planet": VitalPlanetAdapter,
}


def get_adapter(slug: str) -> BrandAdapter:
    cls = _ADAPTERS.get(slug)
    if cls is None:
        raise KeyError(f"Unknown catalog source '{slug}'.")
    return cls()


def all_adapter_slugs() -> list[str]:
    return list(_ADAPTERS.keys())
