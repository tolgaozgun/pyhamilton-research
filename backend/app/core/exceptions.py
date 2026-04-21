"""Custom exceptions for the application."""
from typing import Any, Optional
from fastapi import HTTPException, status


class AppException(HTTPException):
    """Base exception for application errors."""

    def __init__(
        self,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        message: str = "An unexpected error occurred",
        data: Optional[Any] = None,
        details: Optional[dict] = None
    ):
        self.status_code = status_code
        self.message = message
        self.data = data
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message)


class ValidationException(AppException):
    """Exception for validation errors."""

    def __init__(
        self,
        message: str = "Validation failed",
        data: Optional[Any] = None,
        details: Optional[dict] = None
    ):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=message,
            data=data,
            details=details
        )


class AuthenticationException(AppException):
    """Exception for authentication errors."""

    def __init__(
        self,
        message: str = "Authentication failed",
        data: Optional[Any] = None,
        details: Optional[dict] = None
    ):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message=message,
            data=data,
            details=details
        )


class NotFoundException(AppException):
    """Exception for resource not found errors."""

    def __init__(
        self,
        message: str = "Resource not found",
        data: Optional[Any] = None,
        details: Optional[dict] = None
    ):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            message=message,
            data=data,
            details=details
        )


class ExternalServiceException(AppException):
    """Exception for external service errors (e.g., AI providers)."""

    def __init__(
        self,
        message: str = "External service error",
        service_name: str = "external service",
        data: Optional[Any] = None,
        details: Optional[dict] = None
    ):
        enhanced_message = f"{service_name}: {message}"
        enhanced_details = {**details, "service": service_name} if details else {"service": service_name}
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            message=enhanced_message,
            data=data,
            details=enhanced_details
        )


class RateLimitException(AppException):
    """Exception for rate limiting errors."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        data: Optional[Any] = None,
        details: Optional[dict] = None
    ):
        enhanced_details = {**details, "retry_after": retry_after} if retry_after else details
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            message=message,
            data=data,
            details=enhanced_details
        )


class ConfigurationException(AppException):
    """Exception for configuration errors."""

    def __init__(
        self,
        message: str = "Configuration error",
        data: Optional[Any] = None,
        details: Optional[dict] = None
    ):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=message,
            data=data,
            details=details
        )
