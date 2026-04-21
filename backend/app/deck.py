from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class TipType(str, Enum):
    T10 = "10uL"
    T50 = "50uL"
    T300 = "300uL"
    T1000 = "1000uL"
    T5000 = "5mL"


class PlateType(str, Enum):
    WELL_96 = "96_well"
    WELL_96_DEEP = "96_deep_well"
    WELL_384 = "384_well"
    PCR = "pcr_plate"


class ReservoirType(str, Enum):
    TROUGH_300ML = "trough_300ml"


class CarrierType(str, Enum):
    TIP_CARRIER_480 = "TIP_CAR_480_A00"
    TIP_CARRIER_288 = "TIP_CAR_288_C00"
    PLATE_CARRIER_5 = "PLT_CAR_L5AC_A00"
    PLATE_CARRIER_3P = "PLT_CAR_P3AC"
    REAGENT_CARRIER_3 = "RGT_CAR_3R_A00"


CARRIER_INFO = {
    CarrierType.TIP_CARRIER_480: {
        "name": "Tip Carrier (5 slots)",
        "width_rails": 6,
        "slots": 5,
        "accepts": ["tip_rack"],
        "description": "Holds 5x 96-tip racks",
    },
    CarrierType.TIP_CARRIER_288: {
        "name": "Tip Carrier (3 slots)",
        "width_rails": 4,
        "slots": 3,
        "accepts": ["tip_rack"],
        "description": "Holds 3x 96-tip racks",
    },
    CarrierType.PLATE_CARRIER_5: {
        "name": "Plate Carrier (5 slots)",
        "width_rails": 6,
        "slots": 5,
        "accepts": ["plate", "deep_well"],
        "description": "Holds 5 ANSI/SLAS plates (landscape)",
    },
    CarrierType.PLATE_CARRIER_3P: {
        "name": "Plate Carrier (3 slots, portrait)",
        "width_rails": 6,
        "slots": 3,
        "accepts": ["plate"],
        "description": "Holds 3 plates (portrait orientation)",
    },
    CarrierType.REAGENT_CARRIER_3: {
        "name": "Reagent Carrier (3 slots)",
        "width_rails": 6,
        "slots": 3,
        "accepts": ["reservoir"],
        "description": "Holds 3 reagent troughs/reservoirs",
    },
}

TIP_TYPE_INFO = {
    TipType.T10: {"name": "10µL Tips", "volume_range": "0.5–10 µL", "count": 96},
    TipType.T50: {"name": "50µL Tips", "volume_range": "1–50 µL", "count": 96},
    TipType.T300: {"name": "300µL Tips", "volume_range": "1–300 µL", "count": 96},
    TipType.T1000: {"name": "1000µL Tips", "volume_range": "5–1000 µL", "count": 96},
    TipType.T5000: {"name": "5mL Tips", "volume_range": "50–5000 µL", "count": 24},
}

PLATE_TYPE_INFO = {
    PlateType.WELL_96: {"name": "96-Well Plate", "wells": 96, "max_volume_ul": 360},
    PlateType.WELL_96_DEEP: {"name": "96 Deep Well Plate", "wells": 96, "max_volume_ul": 2000},
    PlateType.WELL_384: {"name": "384-Well Plate", "wells": 384, "max_volume_ul": 120},
    PlateType.PCR: {"name": "PCR Plate", "wells": 96, "max_volume_ul": 200},
}

RESERVOIR_TYPE_INFO = {
    ReservoirType.TROUGH_300ML: {"name": "300mL Trough", "channels": 8, "max_volume_ml": 300},
}


class LabwareItem(BaseModel):
    """A specific piece of labware in a carrier slot."""
    type: str
    subtype: str
    name: str = ""
    contents: Optional[str] = None


class CarrierPlacement(BaseModel):
    """A carrier placed on the deck at a specific rail position."""
    carrier_type: CarrierType
    start_rail: int = Field(ge=1, le=55)
    slots: list[Optional[LabwareItem]] = Field(default_factory=list)

    def model_post_init(self, __context):
        info = CARRIER_INFO[self.carrier_type]
        while len(self.slots) < info["slots"]:
            self.slots.append(None)


class AspirationSettings(BaseModel):
    volume_ul: float = Field(default=100.0, ge=0.5, le=5000.0)
    flow_rate_ul_per_s: float = Field(default=100.0, ge=1.0, le=500.0)
    mix_cycles: int = Field(default=0, ge=0, le=20)
    mix_volume_ul: float = Field(default=0.0, ge=0.0)
    liquid_class: str = "Water"
    tip_type: TipType = TipType.T300
    pre_wet: bool = False
    touch_off: bool = True


class DeckConfiguration(BaseModel):
    """Complete Hamilton STAR deck configuration."""
    carriers: list[CarrierPlacement] = Field(default_factory=list)
    aspiration_settings: AspirationSettings = Field(default_factory=AspirationSettings)
    total_rails: int = 55

    def to_prompt_context(self) -> str:
        """Convert deck config to text for LLM prompt injection."""
        lines = ["## Deck Configuration (Hamilton STAR)"]
        for cp in self.carriers:
            info = CARRIER_INFO[cp.carrier_type]
            end_rail = cp.start_rail + info["width_rails"] - 1
            lines.append(f"\nRails {cp.start_rail}-{end_rail}: {info['name']} ({cp.carrier_type.value})")
            for i, slot in enumerate(cp.slots):
                if slot:
                    contents = f" [{slot.contents}]" if slot.contents else ""
                    lines.append(f"  Slot {i}: {slot.name or slot.subtype}{contents}")
                else:
                    lines.append(f"  Slot {i}: <empty>")

        asp = self.aspiration_settings
        lines.append("\n## Aspiration Settings")
        lines.append(f"Volume: {asp.volume_ul} µL")
        lines.append(f"Flow rate: {asp.flow_rate_ul_per_s} µL/s")
        lines.append(f"Tip type: {asp.tip_type.value}")
        lines.append(f"Liquid class: {asp.liquid_class}")
        if asp.mix_cycles > 0:
            lines.append(f"Mixing: {asp.mix_cycles}x at {asp.mix_volume_ul} µL")
        return "\n".join(lines)


def get_default_deck() -> DeckConfiguration:
    """A sensible default deck setup."""
    return DeckConfiguration(
        carriers=[
            CarrierPlacement(
                carrier_type=CarrierType.TIP_CARRIER_480,
                start_rail=1,
                slots=[
                    LabwareItem(type="tip_rack", subtype="300uL", name="Tips 300µL #1"),
                    LabwareItem(type="tip_rack", subtype="300uL", name="Tips 300µL #2"),
                    None, None, None,
                ],
            ),
            CarrierPlacement(
                carrier_type=CarrierType.PLATE_CARRIER_5,
                start_rail=7,
                slots=[
                    LabwareItem(type="plate", subtype="96_well", name="Source Plate"),
                    LabwareItem(type="plate", subtype="96_well", name="Destination Plate"),
                    None, None, None,
                ],
            ),
        ],
    )
