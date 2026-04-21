"""Authentication dependencies for route protection."""
from typing import Optional
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer

from app.database import get_db, DbSession
from app.models.user import User
from app.core.auth import get_current_user as auth_get_current_user

# Kept for any code that imports oauth2_scheme directly
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def _extract_token(request: Request) -> Optional[str]:
    """
    Extract access token from the request.
    Priority: httpOnly cookie → Authorization Bearer header.
    """
    token = request.cookies.get("access_token")
    if token:
        return token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def get_current_user(
    request: Request,
    db: DbSession = Depends(get_db),
) -> User:
    """
    Get current authenticated user.
    Reads token from httpOnly cookie or Authorization header.
    """
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return await auth_get_current_user(token, db)
    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current verified user."""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Email verification required. Please verify your email address.",
        )
    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current superuser."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser privileges required")
    return current_user


async def get_optional_user(
    request: Request,
    db: DbSession = Depends(get_db),
) -> Optional[User]:
    """Return current user if authenticated, otherwise None."""
    token = _extract_token(request)
    if not token:
        return None
    try:
        return await auth_get_current_user(token, db)
    except (ValueError, HTTPException):
        return None
