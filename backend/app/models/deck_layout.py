"""User deck layout model."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, String, Integer, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserDeckLayout(Base):
    """Saved deck configurations belonging to a user."""
    __tablename__ = "user_deck_layouts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Full DeckConfig JSON (carriers + aspiration_settings + total_rails)
    configuration: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Validation state: 'unvalidated' | 'valid' | 'invalid'
    validation_status: Mapped[str] = mapped_column(String(20), default="unvalidated", nullable=False)
    validation_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Source of the layout
    source: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)  # 'manual' | 'imported'
    source_filename: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user = relationship("User", backref="deck_layouts")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "configuration": self.configuration,
            "validation_status": self.validation_status,
            "validation_feedback": self.validation_feedback,
            "source": self.source,
            "source_filename": self.source_filename,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
