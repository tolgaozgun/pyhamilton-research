from sqlalchemy import Boolean, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base

# Import all models
from app.models.user import User, RefreshToken, UserRole
from app.models.labware import CarrierType, LabwareType, DeckPreset


class Labware(Base):
    """
    Legacy labware model for backwards compatibility.
    Now includes user_id for user isolation with shared defaults.
    """
    __tablename__ = "labware"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(50))
    subtype: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    wells: Mapped[int | None] = mapped_column(Integer, nullable=True)
    volume: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[float | None] = mapped_column(nullable=True)
    color: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # User isolation with shared defaults
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # True = shared default labware

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user: Mapped["User"] = relationship("User", backref="labware")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "subtype": self.subtype,
            "description": self.description,
            "wells": self.wells,
            "volume": self.volume,
            "height": self.height,
            "color": self.color,
            "icon": self.icon,
            "is_active": self.is_active,
            "user_id": self.user_id,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserSettings(Base):
    """
    User settings for API providers and preferences.
    Now properly linked to users instead of hardcoded "default" user.
    """
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50))
    api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    selected_model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    models_list: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    models_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user: Mapped["User"] = relationship("User", backref="api_settings")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "api_key": self.api_key,
            "selected_model": self.selected_model,
            "models_list": self.models_list,
            "models_fetched_at": self.models_fetched_at.isoformat() if self.models_fetched_at else None,
            "preferences": self.preferences or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# Export all models
__all__ = [
    "User",
    "RefreshToken",
    "UserRole",
    "Labware",
    "UserSettings",
    "CarrierType",
    "LabwareType",
    "DeckPreset",
]
