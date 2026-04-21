"""Authentication routes for user registration, login, and token management."""
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, Cookie
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field, validator
from email_validator import validate_email

from app.database import get_db, DbSession
from app.models.user import User, UserRole
from app.core.auth import (
    auth_service,
    create_user_tokens,
    validate_refresh_token,
    revoke_refresh_token,
    revoke_all_user_tokens
)
from app.core.responses import ApiResponse
from app.api.deps_auth import get_current_user, get_current_active_user

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# OAuth2 scheme for token handling
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


# ============================================================================
# Pydantic Schemas
# ============================================================================

class UserRegister(BaseModel):
    """User registration schema."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)
    organization: Optional[str] = Field(None, max_length=255)

    @validator('username')
    def validate_username(cls, v):
        if not v or not v.strip():
            raise ValueError('Username is required')
        if len(v.strip()) < 3:
            raise ValueError('Username must be at least 3 characters')
        return v.strip()

    @validator('password')
    def validate_password_strength(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserLogin(BaseModel):
    """User login schema."""
    identifier: str = Field(..., description="Email or username")
    password: str


class ForgotPassword(BaseModel):
    """Password reset request."""
    email: EmailStr


class ResetPassword(BaseModel):
    """Password reset with token."""
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)


class ChangePassword(BaseModel):
    """Password change for authenticated users."""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


# ============================================================================
# Helper Functions
# ============================================================================

async def get_user_by_email_or_username(identifier: str, db: DbSession) -> Optional[User]:
    """Get user by email or username."""
    result = await db.execute(
        select(User).where(
            (User.email == identifier) | (User.username == identifier)
        )
    )
    return result.scalar_one_or_none()


async def get_request_info(request: Request) -> tuple[str, str]:
    """Extract user agent and IP address from request."""
    user_agent = request.headers.get("user-agent", "unknown")[:500]
    # Handle proxy headers for IP
    ip_address = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip() or
        request.headers.get("x-real-ip", "") or
        request.client.host if request.client else "unknown"
    )
    return user_agent, ip_address


# ============================================================================
# Registration Endpoints
# ============================================================================

@router.post("/register", status_code=201)
async def register(
    user_data: UserRegister,
    request: Request,
    db: DbSession = Depends(get_db)
):
    """
    Register a new user account.

    * Requires unique email and username
    * Sends verification email (in production)
    * Returns access and refresh tokens as HTTP-only cookies
    """
    # Check if user already exists
    existing = await get_user_by_email_or_username(user_data.email, db)
    if existing:
        return ApiResponse.validation_error(
            message="User with this email or username already exists",
            errors={"email": "Email already exists", "username": "Username already exists"}
        )

    existing = await get_user_by_email_or_username(user_data.username, db)
    if existing:
        return ApiResponse.validation_error(
            message="User with this email or username already exists",
            errors={"username": "Username already exists"}
        )

    # Create user
    user = User(
        email=user_data.email.lower(),
        username=user_data.username.lower(),
        full_name=user_data.full_name,
        organization=user_data.organization,
        role=UserRole.USER,
        is_active=True,
        is_verified=False  # Require email verification
    )

    user.set_password(user_data.password)
    user.generate_verification_token()

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Log the user in immediately
    user.record_login()

    # Generate tokens
    user_agent, ip_address = await get_request_info(request)
    tokens = await create_user_tokens(user, db, user_agent, ip_address)

    # Tokens are delivered via httpOnly cookies only — never expose values in body
    response_data = {
        "success": True,
        "message": "Registration successful. Please check your email to verify your account.",
        "data": {
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "role": user.role.value,
                "is_verified": user.is_verified
            },
            "session": {
                "token_type": tokens["token_type"],
                "expires_in": tokens["expires_in"]
            }
        }
    }

    # Create response and set cookies
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=response_data, status_code=201)

    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=tokens["expires_in"]
    )

    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=7 * 24 * 60 * 60  # 7 days
    )

    # TODO: Send verification email in production

    return response


@router.post("/login")
async def login(
    credentials: UserLogin,
    request: Request,
    db: DbSession = Depends(get_db)
):
    """
    Authenticate user and return tokens.

    * Accepts email or username
    * Implements account lockout after failed attempts
    * Returns HTTP-only cookies with tokens
    """
    # Find user
    user = await get_user_by_email_or_username(credentials.identifier, db)

    if not user:
        return ApiResponse.validation_error(
            message="Invalid credentials",
            errors={"identifier": "Invalid email or username, or password"}
        )

    # Check if account is locked
    if user.is_locked():
        return ApiResponse.error(
            message=f"Account locked. Try again after {user.locked_until.strftime('%Y-%m-%d %H:%M:%S UTC')}",
            status_code=423
        )

    # Verify password
    if not user.verify_password(credentials.password):
        user.record_failed_login()
        await db.commit()

        return ApiResponse.validation_error(
            message="Invalid credentials",
            errors={"identifier": "Invalid email or username, or password"}
        )

    # Check if user is active
    if not user.is_active:
        return ApiResponse.error(
            message="Account is inactive. Please contact support.",
            status_code=403
        )

    # Record successful login
    user.record_login()
    await db.commit()

    # Generate tokens
    user_agent, ip_address = await get_request_info(request)
    tokens = await create_user_tokens(user, db, user_agent, ip_address)

    # Tokens are delivered via httpOnly cookies only — never expose values in body
    response_data = {
        "success": True,
        "message": "Login successful",
        "data": {
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "role": user.role.value,
                "is_verified": user.is_verified
            },
            "session": {
                "token_type": tokens["token_type"],
                "expires_in": tokens["expires_in"]
            }
        }
    }

    # Create response and set cookies
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=response_data)

    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=tokens["expires_in"]
    )

    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=7 * 24 * 60 * 60  # 7 days
    )

    return response


@router.post("/refresh")
async def refresh_token(
    request: Request,
    db: DbSession = Depends(get_db)
):
    """
    Refresh access token using refresh token.

    * Validates refresh token from database
    * Returns new access and refresh tokens
    * Rotates refresh token for security
    """
    # Get refresh token from cookie
    refresh_token_cookie = request.cookies.get("refresh_token")
    if not refresh_token_cookie:
        return ApiResponse.validation_error(
            message="No refresh token provided",
            errors={"refresh_token": "Refresh token is required"}
        )

    try:
        # Validate refresh token and get user
        user = await validate_refresh_token(refresh_token_cookie, db)

        # Revoke old refresh token
        await revoke_refresh_token(refresh_token_cookie, db)

        # Generate new tokens
        user_agent, ip_address = await get_request_info(request)
        tokens = await create_user_tokens(user, db, user_agent, ip_address)

        # Tokens are delivered via httpOnly cookies only — never expose values in body
        response_data = {
            "success": True,
            "message": "Token refreshed successfully",
            "data": {
                "session": {
                    "token_type": tokens["token_type"],
                    "expires_in": tokens["expires_in"]
                }
            }
        }

        # Create response and set new cookies
        from fastapi.responses import JSONResponse
        response = JSONResponse(content=response_data)

        response.set_cookie(
            key="access_token",
            value=tokens["access_token"],
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=tokens["expires_in"]
        )

        response.set_cookie(
            key="refresh_token",
            value=tokens["refresh_token"],
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=7 * 24 * 60 * 60
        )

        return response

    except ValueError as e:
        return ApiResponse.validation_error(
            message=str(e),
            errors={"refresh_token": str(e)}
        )


@router.post("/logout")
async def logout(
    request: Request,
    db: DbSession = Depends(get_db)
):
    """
    Logout user by revoking refresh token and clearing cookies.

    * Revokes the provided refresh token
    * Clears HTTP-only cookies
    """
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        revoked = await revoke_refresh_token(refresh_token, db)
    else:
        revoked = False

    # Create JSON response with standardized format
    response_data = {
        "success": True,
        "message": "Successfully logged out",
        "data": {"revoked": revoked}
    }

    # Create response and clear cookies
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=response_data)

    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")

    return response


@router.post("/logout-all")
async def logout_all(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db)
):
    """
    Logout from all devices by revoking all refresh tokens.

    * Requires valid access token
    * Revokes ALL refresh tokens for the user
    * Clears HTTP-only cookies
    """
    count = await revoke_all_user_tokens(current_user.id, db)

    # Create JSON response with standardized format
    response_data = {
        "success": True,
        "message": f"Successfully logged out from {count} device(s)",
        "data": {"logged_out_devices": count}
    }

    # Create response and clear cookies
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=response_data)

    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")

    return response


# ============================================================================
# User Management
# ============================================================================

@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """Get current user information."""
    user_data = {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
        "is_verified": current_user.is_verified,
        "is_superuser": current_user.is_superuser,
        "full_name": current_user.full_name,
        "organization": current_user.organization,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
        "created_at": current_user.created_at.isoformat()
    }
    return ApiResponse.success(data=user_data, message="User information retrieved successfully")


@router.post("/verify-email/{token}")
async def verify_email(
    token: str,
    db: DbSession = Depends(get_db)
):
    """
    Verify user email using verification token.

    * Checks token validity and expiration
    * Marks user as verified
    """
    result = await db.execute(
        select(User).where(User.verification_token == token)
    )
    user = result.scalar_one_or_none()

    if not user:
        return ApiResponse.not_found(
            message="Invalid verification token",
            resource_type="verification_token"
        )

    if user.is_verified:
        return ApiResponse.success(
            data={"verified": True},
            message="Email already verified"
        )

    if user.verification_expires and user.verification_expires < datetime.utcnow():
        return ApiResponse.error(
            message="Verification token has expired",
            status_code=400,
            details={"error_type": "token_expired"}
        )

    # Mark user as verified
    user.is_verified = True
    user.verified_at = datetime.utcnow()
    user.verification_token = None
    user.verification_expires = None

    await db.commit()

    return ApiResponse.success(
        data={"verified": True},
        message="Email successfully verified"
    )


@router.post("/forgot-password")
async def forgot_password(
    forgot_request: ForgotPassword,
    db: DbSession = Depends(get_db)
):
    """
    Request password reset.

    * Generates password reset token
    * Sends reset email (in production)
    """
    result = await db.execute(
        select(User).where(User.email == forgot_request.email.lower())
    )
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if not user:
        return ApiResponse.success(
            data={"email_sent": True},
            message="If an account exists with this email, a password reset link has been sent."
        )

    # Generate reset token
    reset_token = user.generate_reset_token()
    await db.commit()

    # TODO: Send password reset email in production
    # For now, just log the token (remove in production!)
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Password reset token for {user.email}: {reset_token}")

    return ApiResponse.success(
        data={"email_sent": True},
        message="If an account exists with this email, a password reset link has been sent."
    )


@router.post("/reset-password")
async def reset_password(
    reset_request: ResetPassword,
    db: DbSession = Depends(get_db)
):
    """
    Reset password using reset token.

    * Validates reset token and expiration
    * Updates user password
    """
    result = await db.execute(
        select(User).where(User.reset_token == reset_request.token)
    )
    user = result.scalar_one_or_none()

    if not user:
        return ApiResponse.not_found(
            message="Invalid reset token",
            resource_type="reset_token"
        )

    if user.reset_expires and user.reset_expires < datetime.utcnow():
        return ApiResponse.error(
            message="Reset token has expired",
            status_code=400,
            details={"error_type": "token_expired"}
        )

    # Set new password
    user.set_password(reset_request.new_password)
    user.reset_token = None
    user.reset_expires = None
    user.failed_login_attempts = 0
    user.locked_until = None

    await db.commit()

    # Revoke all refresh tokens for security
    await revoke_all_user_tokens(user.id, db)

    return ApiResponse.success(
        data={"password_reset": True},
        message="Password has been reset successfully. Please login with your new password."
    )


@router.post("/change-password")
async def change_password(
    change_request: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db)
):
    """
    Change password for authenticated user.

    * Verifies old password
    * Updates to new password
    * Revokes all refresh tokens for security
    """
    # Verify old password
    if not current_user.verify_password(change_request.old_password):
        return ApiResponse.validation_error(
            message="Current password is incorrect",
            errors={"old_password": "Current password is incorrect"}
        )

    # Set new password
    current_user.set_password(change_request.new_password)
    await db.commit()

    # Revoke all refresh tokens for security
    await revoke_all_user_tokens(current_user.id, db)

    return ApiResponse.success(
        data={"password_changed": True},
        message="Password changed successfully. Please login again."
    )