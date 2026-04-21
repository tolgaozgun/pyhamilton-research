"""Standardized response handlers for the application."""
from typing import Any, Optional
from fastapi import status
from fastapi.responses import JSONResponse


class ApiResponse:
    """Standardized API response format."""

    @staticmethod
    def success(
        data: Any = None,
        message: str = "Success",
        status_code: int = status.HTTP_200_OK
    ) -> JSONResponse:
        """
        Create a success response.

        Args:
            data: The response data
            message: Success message
            status_code: HTTP status code

        Returns:
            JSONResponse with standardized format
        """
        return JSONResponse(
            status_code=status_code,
            content={
                "success": True,
                "message": message,
                "data": data
            }
        )

    @staticmethod
    def error(
        message: str = "An error occurred",
        data: Any = None,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[dict] = None
    ) -> JSONResponse:
        """
        Create an error response.

        Args:
            message: Error message
            data: Additional error data
            status_code: HTTP status code
            details: Additional error details

        Returns:
            JSONResponse with standardized error format
        """
        content = {
            "success": False,
            "message": message,
            "data": data
        }

        if details:
            content["details"] = details

        return JSONResponse(
            status_code=status_code,
            content=content
        )

    @staticmethod
    def validation_error(
        message: str = "Validation failed",
        errors: dict = None
    ) -> JSONResponse:
        """
        Create a validation error response.

        Args:
            message: Validation error message
            errors: Dictionary of field validation errors

        Returns:
            JSONResponse with validation error format
        """
        return ApiResponse.error(
            message=message,
            data=errors,
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"error_type": "validation"}
        )

    @staticmethod
    def not_found(
        message: str = "Resource not found",
        resource_type: str = None
    ) -> JSONResponse:
        """
        Create a not found error response.

        Args:
            message: Error message
            resource_type: Type of resource that was not found

        Returns:
            JSONResponse with not found format
        """
        details = {"error_type": "not_found"}
        if resource_type:
            details["resource_type"] = resource_type

        return ApiResponse.error(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details
        )

    @staticmethod
    def external_service_error(
        message: str,
        service_name: str = "external service",
        details: dict = None
    ) -> JSONResponse:
        """
        Create an external service error response.

        Args:
            message: Error message
            service_name: Name of the external service
            details: Additional details

        Returns:
            JSONResponse with external service error format
        """
        enhanced_details = {
            "error_type": "external_service",
            "service": service_name,
            **(details or {})
        }

        return ApiResponse.error(
            message=message,
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=enhanced_details
        )

    @staticmethod
    def rate_limit_error(
        message: str = "Rate limit exceeded",
        retry_after: int = None
    ) -> JSONResponse:
        """
        Create a rate limit error response.

        Args:
            message: Error message
            retry_after: Seconds to wait before retrying

        Returns:
            JSONResponse with rate limit format
        """
        details = {"error_type": "rate_limit"}
        if retry_after:
            details["retry_after_seconds"] = retry_after

        return ApiResponse.error(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details
        )


async def app_exception_handler(request, exc):
    """Handle custom application exceptions."""
    return ApiResponse.error(
        message=exc.message,
        data=exc.data,
        status_code=exc.status_code,
        details=exc.details
    )


async def general_exception_handler(request, exc):
    """Handle unexpected exceptions."""
    return ApiResponse.error(
        message="An unexpected error occurred",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        details={
            "error_type": "internal_error",
            "details": str(exc) if len(str(exc)) < 100 else "Error details too long"
        }
    )
