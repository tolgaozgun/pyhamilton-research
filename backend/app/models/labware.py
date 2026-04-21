"""Database models for labware and carrier types."""

from sqlalchemy import String, Integer, Boolean, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CarrierType(Base):
    """Hamilton carrier types (tips, plates, reagents)."""
    __tablename__ = "carrier_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., TIP_CAR_480_A00
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # tip, plate, reagent
    width_rails: Mapped[int] = mapped_column(Integer, nullable=False)
    num_slots: Mapped[int] = mapped_column(Integer, nullable=False)
    accepts: Mapped[list[str]] = mapped_column(JSON, nullable=False)  # ['tip_rack', 'plate']
    description: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Additional properties stored as JSON
    properties: Mapped[dict] = mapped_column(JSON, nullable=True)


class LabwareType(Base):
    """Labware type definitions (tips, plates, reservoirs)."""
    __tablename__ = "labware_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., 300uL, 96_well
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # tip_rack, plate, reservoir
    description: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Type-specific properties (stored as JSON for flexibility)
    properties: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict)
    # For tip_racks: {count: 96, volume_range: "1-300uL", tip_type: "standard"}
    # For plates: {wells: 96, max_volume_ul: 360, well_format: "standard"}
    # For reservoirs: {channels: 8, max_volume_ml: 300, shape: "trough"}


class DeckPreset(Base):
    """Named deck configurations for common workflows."""
    __tablename__ = "deck_presets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[str | None] = mapped_column(String(50))  # basic, htp, elisa, pcr
    configuration: Mapped[dict] = mapped_column(JSON, nullable=False)  # Full deck config
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
