"""Authentication service for JWT tokens and user management."""
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.models.user import User, RefreshToken
from app.database import DbSession, DbSession
from sqlalchemy import select


# Security configuration
SECRET_KEY = secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


class AuthService:
    """Service for authentication operations."""

    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.secret_key = SECRET_KEY
        self.algorithm = ALGORITHM

    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token."""
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({
            "exp": expire,
            "type": "access"
        })

        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT refresh token."""
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

        to_encode.update({
            "exp": expire,
            "type": "refresh",
            "jti": secrets.token_urlsafe(32)  # JWT ID for revocation
        })

        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def decode_token(self, token: str) -> Dict[str, Any]:
        """Decode and validate JWT token."""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            return payload
        except JWTError as e:
            raise ValueError(f"Invalid token: {str(e)}")

    def hash_password(self, password: str) -> str:
        """Hash password for storage."""
        return self.pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash."""
        return self.pwd_context.verify(plain_password, hashed_password)


class TokenData(BaseModel):
    """Schema for token payload data."""
    sub: int  # user ID
    email: str
    username: str
    role: str
    type: str  # "access" or "refresh"


# Create global auth service instance
auth_service = AuthService()


async def get_current_user(
    token: str,
    db: DbSession
) -> User:
    """Validate access token and return current user."""
    try:
        payload = auth_service.decode_token(token)

        if payload.get("type") != "access":
            raise ValueError("Invalid token type")

        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Token missing user ID")

        # Get user from database
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        if not user.is_active:
            raise ValueError("User account is inactive")

        return user

    except ValueError as e:
        raise ValueError(f"Invalid authentication: {str(e)}")


async def create_user_tokens(
    user: User,
    db: DbSession,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None
) -> Dict[str, Any]:
    """Create access and refresh tokens for user."""
    # Create access token
    access_token = auth_service.create_access_token({
        "sub": str(user.id),  # Convert to string for JWT compliance
        "email": user.email,
        "username": user.username,
        "role": user.role.value,
    })

    # Create refresh token
    refresh_token = auth_service.create_refresh_token({
        "sub": str(user.id),  # Convert to string for JWT compliance
        "email": user.email,
        "username": user.username,
        "role": user.role.value,
    })

    # Store refresh token in database
    token_record = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address
    )

    db.add(token_record)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


async def validate_refresh_token(
    token: str,
    db: DbSession
) -> User:
    """Validate refresh token and return user."""
    try:
        payload = auth_service.decode_token(token)

        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")

        # Check if token exists in database and is not revoked
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token == token)
        )
        token_record = result.scalar_one_or_none()

        if not token_record or not token_record.is_valid():
            raise ValueError("Invalid or expired refresh token")

        # Get user
        user_result = await db.execute(
            select(User).where(User.id == token_record.user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user or not user.is_active:
            raise ValueError("User not found or inactive")

        return user

    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Token validation failed: {str(e)}")


async def revoke_refresh_token(token: str, db: DbSession) -> bool:
    """Revoke a refresh token."""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == token)
    )
    token_record = result.scalar_one_or_none()

    if token_record:
        token_record.revoke()
        await db.commit()
        return True

    return False


async def revoke_all_user_tokens(user_id: int, db: DbSession) -> int:
    """Revoke all refresh tokens for a user."""
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None)
        )
    )
    tokens = result.scalars().all()

    count = 0
    for token in tokens:
        token.revoke()
        count += 1

    await db.commit()
    return count