"""Request/response handlers and decorators for consistent API behavior."""
from functools import wraps
from typing import Any, Callable, Optional, TypeVar, Generic
import logging
from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse
from google.api_core.exceptions import GoogleAPIError
from httpx import HTTPStatusError as HttpxStatusError

from app.core.schemas import (
    ApiResponse,
    ErrorResponse,
    ErrorDetail,
    error_response,
    validation_error_response,
    not_found_response,
    external_service_error_response,
    rate_limit_error_response
)
from app.core.exceptions import (
    AppException,
    ValidationException,
    NotFoundException,
    ExternalServiceException,
    RateLimitException
)

logger = logging.getLogger(__name__)

T = TypeVar('T')


class ApiHandler:
    """Generic API response handler."""

    @staticmethod
    def success(data: Any = None, message: str = "Success", status_code: int = 200) -> JSONResponse:
        """Create a success response."""
        return JSONResponse(
            status_code=status_code,
            content=success_response(data, message)
        )

    @staticmethod
    def error(
        message: str,
        status_code: int = 500,
        data: Any = None,
        details: dict = None,
        errors: list = None
    ) -> JSONResponse:
        """Create an error response."""
        return JSONResponse(
            status_code=status_code,
            content=error_response(message, data, details, errors)
        )

    @staticmethod
    def validation_error(errors: dict) -> JSONResponse:
        """Create a validation error response."""
        return JSONResponse(
            status_code=400,
            content=validation_error_response(errors)
        )

    @staticmethod
    def not_found(resource: str = "Resource") -> JSONResponse:
        """Create a not found response."""
        return JSONResponse(
            status_code=404,
            content=not_found_response(resource)
        )

    @staticmethod
    def external_service_error(
        service: str,
        message: str,
        details: dict = None
    ) -> JSONResponse:
        """Create an external service error response."""
        return JSONResponse(
            status_code=502,
            content=external_service_error_response(service, message, details)
        )

    @staticmethod
    def rate_limit_error(
        message: str = "Rate limit exceeded",
        retry_after: int = None
    ) -> JSONResponse:
        """Create a rate limit error response."""
        return JSONResponse(
            status_code=429,
            content=rate_limit_error_response(message, retry_after)
        )


def handle_api_errors(func: Callable) -> Callable:
    """
    Decorator to handle API errors consistently.

    Usage:
        @handle_api_errors
        async def my_endpoint():
            # Your code here
            pass
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except AppException as e:
            # Handle our custom exceptions
            return ApiHandler.error(
                message=e.message,
                status_code=e.status_code,
                data=e.data,
                details=e.details
            )
        except GoogleAPIError as e:
            # Handle Google API errors specifically
            logger.error(f"Google API error: {e}")

            # Check for rate limiting
            if hasattr(e, 'status_code') and e.status_code == 429:
                retry_after = None
                if hasattr(e, 'message') and 'retryDelay' in str(e.message):
                    try:
                        import re
                        retry_match = re.search(r'retry in ([\d.]+)s', str(e.message))
                        if retry_match:
                            retry_after = int(float(retry_match.group(1)))
                    except:
                        pass

                return ApiHandler.rate_limit_error(
                    message="Google API rate limit exceeded. Please try again later.",
                    retry_after=retry_after
                )

            return ApiHandler.external_service_error(
                service="Google AI",
                message=str(e),
                details={"error_type": "google_api_error"}
            )
        except HttpxStatusError as e:
            # Handle HTTP client errors
            logger.error(f"HTTP client error: {e}")
            return ApiHandler.external_service_error(
                service="External HTTP service",
                message=f"HTTP request failed: {e.response.status_code}",
                details={"status_code": e.response.status_code}
            )
        except Exception as e:
            # Handle unexpected errors
            logger.exception(f"Unexpected error in {func.__name__}")
            return ApiHandler.error(
                message="An unexpected error occurred",
                details={"error_type": "internal_error"}
            )

    return wrapper


def validate_required_fields(data: dict, required_fields: list[str]) -> None:
    """
    Validate that required fields are present in data.

    Args:
        data: Dictionary to validate
        required_fields: List of required field names

    Raises:
        ValidationException: If any required fields are missing
    """
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    if missing_fields:
        raise ValidationException(
            message=f"Missing required fields: {', '.join(missing_fields)}",
            details={"missing_fields": missing_fields}
        )


async def safe_execute(
    func: Callable,
    error_message: str = "Operation failed",
    default_value: Any = None,
    raise_on_error: bool = False
) -> Any:
    """
    Safely execute a function with error handling.

    Args:
        func: Function to execute
        error_message: Message to use if error occurs
        default_value: Value to return on error (if not raising)
        raise_on_error: Whether to raise exceptions or return default

    Returns:
        Function result or default_value on error
    """
    try:
        return await func()
    except Exception as e:
        logger.error(f"{error_message}: {e}")
        if raise_on_error:
            raise
        return default_value


class PaginatedResponseHandler:
    """Handler for paginated responses."""

    @staticmethod
    def create_response(
        items: list[Any],
        total: int,
        page: int = 1,
        page_size: int = 10,
        message: str = "Data retrieved successfully"
    ) -> dict:
        """
        Create a paginated response.

        Args:
            items: List of items for current page
            total: Total number of items
            page: Current page number
            page_size: Number of items per page
            message: Success message

        Returns:
            Paginated response dictionary
        """
        from app.core.schemas import PaginationInfo, PaginatedResponse

        total_pages = (total + page_size - 1) // page_size

        return {
            "success": True,
            "message": message,
            "data": items,
            "pagination": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            },
            "details": None
        }


def with_error_handling(func: Callable) -> Callable:
    """
    Alternative decorator that returns standardized responses.

    This decorator ensures the function always returns a dict
    in the standardized API response format.

    Usage:
        @with_error_handling
        async def my_function():
            # Your code here
            return {"data": "result"}  # Will be wrapped in success response
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            result = await func(*args, **kwargs)

            # If result is already a dict with success field, return as-is
            if isinstance(result, dict) and "success" in result:
                return result

            # Otherwise wrap in success response
            return success_response(data=result, message="Operation completed")

        except AppException as e:
            return error_response(
                message=e.message,
                data=e.data,
                details=e.details
            )
        except Exception as e:
            logger.exception(f"Unexpected error in {func.__name__}")
            return error_response(
                message="An unexpected error occurred",
                details={"error_type": "internal_error", "error_details": str(e)[:200]}
            )

    return wrapper


# Request validators
class RequestValidator:
    """Generic request validation utilities."""

    @staticmethod
    def validate_positive_integer(value: Any, field_name: str = "value") -> int:
        """Validate and convert to positive integer."""
        try:
            int_value = int(value)
            if int_value <= 0:
                raise ValidationException(
                    message=f"{field_name} must be a positive integer",
                    details={"field": field_name, "provided_value": value}
                )
            return int_value
        except (ValueError, TypeError):
            raise ValidationException(
                message=f"{field_name} must be a valid integer",
                details={"field": field_name, "provided_value": value}
            )

    @staticmethod
    def validate_string_length(
        value: Any,
        field_name: str = "value",
        min_length: int = 0,
        max_length: int = 10000
    ) -> str:
        """Validate string length."""
        if not isinstance(value, str):
            raise ValidationException(
                message=f"{field_name} must be a string",
                details={"field": field_name, "provided_type": type(value).__name__}
            )

        if len(value) < min_length:
            raise ValidationException(
                message=f"{field_name} must be at least {min_length} characters",
                details={"field": field_name, "length": len(value)}
            )

        if len(value) > max_length:
            raise ValidationException(
                message=f"{field_name} must be no more than {max_length} characters",
                details={"field": field_name, "length": len(value)}
            )

        return value

    @staticmethod
    def validate_enum(value: Any, field_name: str, valid_values: list[str]) -> str:
        """Validate enum value."""
        if value not in valid_values:
            raise ValidationException(
                message=f"{field_name} must be one of: {', '.join(valid_values)}",
                details={"field": field_name, "provided_value": value, "valid_values": valid_values}
            )
        return value
