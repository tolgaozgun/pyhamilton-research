from sqlalchemy import Boolean, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base

# Import all models
from app.models.user import User, RefreshToken, UserRole
from app.models.labware import CarrierType, LabwareType, DeckPreset
from app.models.deck_layout import UserDeckLayout


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
    "UserSettings",
    "CarrierType",
    "LabwareType",
    "DeckPreset",
    "UserDeckLayout",
]
