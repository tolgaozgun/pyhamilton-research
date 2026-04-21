"""User authentication and management model."""
import secrets
from datetime import datetime, timedelta
from typing import Optional
from enum import Enum

from sqlalchemy import Boolean, String, Integer, DateTime, Enum as SQLEnum, ForeignKey, event
from sqlalchemy.orm import Mapped, mapped_column, relationship
from passlib.context import CryptContext

from app.database import Base

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class User(Base):
    """User account for authentication and data isolation."""
    __tablename__ = "users"

    # Primary fields
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    # Authentication
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(SQLEnum(UserRole, name="userrole", create_constraint=True), default=UserRole.USER.value, nullable=False)

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Profile
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    organization: Mapped[Optional[str]] = mapped_column(String(255))

    # Security
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime)
    password_changed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Email verification
    verification_token: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    verification_expires: Mapped[Optional[datetime]] = mapped_column(DateTime)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Password reset
    reset_token: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    reset_expires: Mapped[Optional[datetime]] = mapped_column(DateTime)

    def set_password(self, password: str) -> None:
        """Hash and set user password."""
        self.password_hash = pwd_context.hash(password)
        self.password_changed_at = datetime.utcnow()

    def verify_password(self, password: str) -> bool:
        """Verify user password."""
        if self.locked_until and self.locked_until > datetime.utcnow():
            return False
        return pwd_context.verify(password, self.password_hash)

    def generate_verification_token(self) -> str:
        """Generate email verification token."""
        self.verification_token = secrets.token_urlsafe(32)
        self.verification_expires = datetime.utcnow() + timedelta(hours=24)
        return self.verification_token

    def generate_reset_token(self) -> str:
        """Generate password reset token."""
        self.reset_token = secrets.token_urlsafe(32)
        self.reset_expires = datetime.utcnow() + timedelta(hours=1)
        return self.reset_token

    def record_login(self) -> None:
        """Record successful login."""
        self.last_login = datetime.utcnow()
        self.failed_login_attempts = 0
        self.locked_until = None

    def record_failed_login(self) -> None:
        """Record failed login attempt and lock account if needed."""
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.locked_until = datetime.utcnow() + timedelta(minutes=15)

    def is_locked(self) -> bool:
        """Check if account is locked."""
        return (
            self.locked_until is not None and
            self.locked_until > datetime.utcnow()
        )

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert user to dictionary (excluding sensitive data by default)."""
        data = {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "role": self.role.value,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "is_superuser": self.is_superuser,
            "full_name": self.full_name,
            "organization": self.organization,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        if include_sensitive:
            data.update({
                "failed_login_attempts": self.failed_login_attempts,
                "locked_until": self.locked_until.isoformat() if self.locked_until else None,
                "password_changed_at": self.password_changed_at.isoformat() if self.password_changed_at else None,
            })

        return data


class RefreshToken(Base):
    """JWT refresh tokens for user sessions."""
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # Token metadata
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Device info
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))  # IPv6 support

    # Relationship
    user: Mapped["User"] = relationship("User", backref="refresh_tokens")

    def is_valid(self) -> bool:
        """Check if token is valid (not expired or revoked)."""
        return (
            self.revoked_at is None and
            self.expires_at > datetime.utcnow()
        )

    def revoke(self) -> None:
        """Revoke this refresh token."""
        self.revoked_at = datetime.utcnow()
