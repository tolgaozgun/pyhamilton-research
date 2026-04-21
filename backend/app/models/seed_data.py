"""Seed data for carrier types and labware."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.labware import CarrierType, LabwareType, DeckPreset
from app.database import Base


# Default carrier types (from backend/app/deck.py)
DEFAULT_CARRIER_TYPES = [
    {
        "name": "Tip Carrier (5-position)",
        "code": "TIP_CAR_480_A00",
        "category": "tip",
        "width_rails": 6,
        "num_slots": 5,
        "accepts": ["tip_rack"],
        "description": "Holds 5x 96-tip racks (Hamilton 480)",
        "properties": {
            "manufacturer": "Hamilton",
            "part_number": "TIP_CAR_480_A00",
            "max_channels": 8,
        }
    },
    {
        "name": "Tip Carrier (3-position)",
        "code": "TIP_CAR_288_C00",
        "category": "tip",
        "width_rails": 4,
        "num_slots": 3,
        "accepts": ["tip_rack"],
        "description": "Holds 3x 96-tip racks (Hamilton 288)",
        "properties": {
            "manufacturer": "Hamilton",
            "part_number": "TIP_CAR_288_C00",
            "max_channels": 8,
        }
    },
    {
        "name": "Plate Carrier (5-position)",
        "code": "PLT_CAR_L5AC_A00",
        "category": "plate",
        "width_rails": 6,
        "num_slots": 5,
        "accepts": ["plate", "deep_well"],
        "description": "Holds 5 ANSI/SLAS plates (landscape)",
        "properties": {
            "manufacturer": "Hamilton",
            "part_number": "PLT_CAR_L5AC_A00",
            "orientation": "landscape",
        }
    },
    {
        "name": "Plate Carrier (3-position)",
        "code": "PLT_CAR_P3AC",
        "category": "plate",
        "width_rails": 6,
        "num_slots": 3,
        "accepts": ["plate"],
        "description": "Holds 3 plates (portrait orientation)",
        "properties": {
            "manufacturer": "Hamilton",
            "part_number": "PLT_CAR_P3AC",
            "orientation": "portrait",
        }
    },
    {
        "name": "Reagent Carrier (3-position)",
        "code": "RGT_CAR_3R_A00",
        "category": "reagent",
        "width_rails": 6,
        "num_slots": 3,
        "accepts": ["reservoir", "trough"],
        "description": "Holds 3 reagent troughs/reservoirs",
        "properties": {
            "manufacturer": "Hamilton",
            "part_number": "RGT_CAR_3R_A00",
            "max_channels": 8,
        }
    },
]

# Default labware types
DEFAULT_LABWARE_TYPES = [
    # Tip racks
    {
        "name": "10µL Tips",
        "code": "10uL",
        "category": "tip_rack",
        "description": "96-tip rack (10µL volume range)",
        "properties": {
            "count": 96,
            "volume_range_ul": "0.5-10",
            "tip_type": "standard",
            "filter": "none"
        }
    },
    {
        "name": "50µL Tips",
        "code": "50uL",
        "category": "tip_rack",
        "description": "96-tip rack (50µL volume range)",
        "properties": {
            "count": 96,
            "volume_range_ul": "1-50",
            "tip_type": "standard",
            "filter": "none"
        }
    },
    {
        "name": "300µL Tips",
        "code": "300uL",
        "category": "tip_rack",
        "description": "96-tip rack (300µL volume range)",
        "properties": {
            "count": 96,
            "volume_range_ul": "1-300",
            "tip_type": "standard",
            "filter": "none"
        }
    },
    {
        "name": "1000µL Tips",
        "code": "1000uL",
        "category": "tip_rack",
        "description": "96-tip rack (1000µL volume range)",
        "properties": {
            "count": 96,
            "volume_range_ul": "5-1000",
            "tip_type": "standard",
            "filter": "none"
        }
    },
    {
        "name": "5mL Tips",
        "code": "5mL",
        "category": "tip_rack",
        "description": "24-tip rack (5mL volume range)",
        "properties": {
            "count": 24,
            "volume_range_ul": "50-5000",
            "tip_type": "standard",
            "filter": "none"
        }
    },
    # Plates
    {
        "name": "96-Well Plate",
        "code": "96_well",
        "category": "plate",
        "description": "Standard ANSI/SLAS 96-well plate",
        "properties": {
            "wells": 96,
            "max_volume_ul": 360,
            "well_format": "standard",
            "plate_format": "ANSI_SLAS"
        }
    },
    {
        "name": "96 Deep Well Plate",
        "code": "96_deep_well",
        "category": "plate",
        "description": "96 deep well plate for larger volumes",
        "properties": {
            "wells": 96,
            "max_volume_ul": 2000,
            "well_format": "deep",
            "plate_format": "ANSI_SLAS"
        }
    },
    {
        "name": "384-Well Plate",
        "code": "384_well",
        "category": "plate",
        "description": "384-well plate for high-throughput",
        "properties": {
            "wells": 384,
            "max_volume_ul": 120,
            "well_format": "standard",
            "plate_format": "ANSI_SLAS"
        }
    },
    {
        "name": "PCR Plate",
        "code": "pcr_plate",
        "category": "plate",
        "description": "PCR plate for thermal cycling",
        "properties": {
            "wells": 96,
            "max_volume_ul": 200,
            "well_format": "standard",
            "plate_format": "PCR"
        }
    },
    # Reservoirs
    {
        "name": "300mL Trough",
        "code": "trough_300ml",
        "category": "reservoir",
        "description": "300mL trough for reagents",
        "properties": {
            "channels": 8,
            "max_volume_ml": 300,
            "shape": "trough"
        }
    },
]

# Default deck presets
DEFAULT_DECK_PRESETS = [
    {
        "name": "Basic Setup",
        "description": "Simple tip and plate carrier setup for basic liquid handling",
        "category": "basic",
        "configuration": {
            "carriers": [
                {
                    "carrier_type": "TIP_CAR_480_A00",
                    "start_rail": 1,
                    "slots": [
                        {"type": "tip_rack", "subtype": "300uL", "name": "300µL Tips #1"},
                        {"type": "tip_rack", "subtype": "300uL", "name": "300µL Tips #2"},
                        None, None, None,
                    ]
                },
                {
                    "carrier_type": "PLT_CAR_L5AC_A00",
                    "start_rail": 8,
                    "slots": [
                        {"type": "plate", "subtype": "96_well", "name": "Source Plate"},
                        {"type": "plate", "subtype": "96_well", "name": "Destination Plate"},
                        None, None, None,
                    ]
                }
            ],
            "aspiration_settings": {
                "volume_ul": 100.0,
                "flow_rate_ul_per_s": 100.0,
                "mix_cycles": 0,
                "mix_volume_ul": 0.0,
                "liquid_class": "Water",
                "tip_type": "300uL",
                "pre_wet": False,
                "touch_off": True
            },
            "total_rails": 55
        }
    },
    {
        "name": "HTP Setup",
        "description": "High-throughput screening setup with 3 tip carriers and 4 plates",
        "category": "htp",
        "configuration": {
            "carriers": [
                {
                    "carrier_type": "TIP_CAR_480_A00",
                    "start_rail": 1,
                    "slots": [
                        {"type": "tip_rack", "subtype": "300uL", "name": "300µL Tips #1"},
                        {"type": "tip_rack", "subtype": "300uL", "name": "300µL Tips #2"},
                        {"type": "tip_rack", "subtype": "300uL", "name": "300µL Tips #3"},
                        None, None,
                    ]
                },
                {
                    "carrier_type": "PLT_CAR_L5AC_A00",
                    "start_rail": 8,
                    "slots": [
                        {"type": "plate", "subtype": "384_well", "name": "Plate 1"},
                        {"type": "plate", "subtype": "384_well", "name": "Plate 2"},
                        {"type": "plate", "subtype": "384_well", "name": "Plate 3"},
                        {"type": "plate", "subtype": "384_well", "name": "Plate 4"},
                        None,
                    ]
                }
            ],
            "aspiration_settings": {
                "volume_ul": 100.0,
                "flow_rate_ul_per_s": 100.0,
                "mix_cycles": 0,
                "mix_volume_ul": 0.0,
                "liquid_class": "Water",
                "tip_type": "300uL",
                "pre_wet": False,
                "touch_off": True
            },
            "total_rails": 55
        }
    },
    {
        "name": "ELISA Setup",
        "description": "ELISA plate setup with tip and reagent carriers",
        "category": "elisa",
        "configuration": {
            "carriers": [
                {
                    "carrier_type": "TIP_CAR_480_A00",
                    "start_rail": 1,
                    "slots": [
                        {"type": "tip_rack", "subtype": "300uL", "name": "300µL Tips #1"},
                        {"type": "tip_rack", "subtype": "300uL", "name": "300µL Tips #2"},
                        None, None, None,
                    ]
                },
                {
                    "carrier_type": "RGT_CAR_3R_A00",
                    "start_rail": 7,
                    "slots": [
                        {"type": "reservoir", "subtype": "trough_300ml", "name": "Coating Antibody"},
                        {"type": "reservoir", "subtype": "trough_300ml", "name": "Sample"},
                        {"type": "reservoir", "subtype": "trough_300ml", "name": "Detection Antibody"},
                    ]
                },
                {
                    "carrier_type": "PLT_CAR_L5AC_A00",
                    "start_rail": 14,
                    "slots": [
                        {"type": "plate", "subtype": "96_well", "name": "Plate 1"},
                        {"type": "plate", "subtype": "96_well", "name": "Plate 2"},
                        None, None, None,
                    ]
                }
            ],
            "aspiration_settings": {
                "volume_ul": 100.0,
                "flow_rate_ul_per_s": 100.0,
                "mix_cycles": 3,
                "mix_volume_ul": 50.0,
                "liquid_class": "Water",
                "tip_type": "300uL",
                "pre_wet": False,
                "touch_off": True
            },
            "total_rails": 55
        }
    },
]


async def seed_labware_data(session: AsyncSession):
    """Seed the database with default carrier types, labware types, and deck presets."""
    # Check if data already exists
    result = await session.execute(select(CarrierType).limit(1))
    if result.scalars().first():
        print("Labware data already seeded, skipping...")
        return

    print("Seeding labware data...")

    # Seed carrier types
    for carrier_data in DEFAULT_CARRIER_TYPES:
        carrier = CarrierType(**carrier_data)
        session.add(carrier)

    # Seed labware types
    for labware_data in DEFAULT_LABWARE_TYPES:
        labware = LabwareType(**labware_data)
        session.add(labware)

    # Seed deck presets
    for preset_data in DEFAULT_DECK_PRESETS:
        preset = DeckPreset(**preset_data)
        session.add(preset)

    await session.commit()
    print(f"Seeded {len(DEFAULT_CARRIER_TYPES)} carrier types, {len(DEFAULT_LABWARE_TYPES)} labware types, and {len(DEFAULT_DECK_PRESETS)} deck presets.")
