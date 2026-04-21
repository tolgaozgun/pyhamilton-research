"""Generic request and response schemas for the API."""
from typing import Any, Generic, TypeVar, Optional
from pydantic import BaseModel, Field
from enum import Enum


# Generic type variable for data payloads
T = TypeVar('T')


class ResponseStatus(str, Enum):
    """Standard response status values."""
    SUCCESS = "success"
    ERROR = "error"
    VALIDATION_ERROR = "validation_error"
    NOT_FOUND = "not_found"
    EXTERNAL_SERVICE_ERROR = "external_service_error"
    RATE_LIMIT_ERROR = "rate_limit_error"


class ApiResponse(BaseModel, Generic[T]):
    """
    Standard API response format.

    All API endpoints should return responses in this format.
    """
    success: bool = Field(..., description="Whether the request was successful")
    message: str = Field(..., description="Human-readable message about the result")
    data: Optional[T] = Field(None, description="Response data payload")
    details: Optional[dict[str, Any]] = Field(None, description="Additional error or metadata details")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Request completed successfully",
                "data": {"id": 123, "name": "Example"},
                "details": None
            }
        }


class PaginationInfo(BaseModel):
    """Pagination metadata for list responses."""
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response."""
    success: bool = True
    message: str = "Data retrieved successfully"
    data: list[T] = Field(default_factory=list, description="List of items")
    pagination: PaginationInfo = Field(..., description="Pagination information")
    details: Optional[dict[str, Any]] = None


class ErrorDetail(BaseModel):
    """Detailed error information."""
    code: str = Field(..., description="Error code")
    field: Optional[str] = Field(None, description="Field that caused the error (for validation errors)")
    message: str = Field(..., description="Error message")
    details: Optional[dict[str, Any]] = Field(None, description="Additional error details")


class ErrorResponse(BaseModel):
    """Standard error response format."""
    success: bool = False
    message: str = Field(..., description="Error message")
    data: None = None
    errors: Optional[list[ErrorDetail]] = Field(None, description="List of specific errors")
    details: Optional[dict[str, Any]] = Field(None, description="Additional error context")


# Common response instances
def success_response(data: Any = None, message: str = "Success") -> dict:
    """Create a success response dictionary."""
    return {
        "success": True,
        "message": message,
        "data": data,
        "details": None
    }


def error_response(
    message: str,
    data: Any = None,
    details: dict = None,
    errors: list = None
) -> dict:
    """Create an error response dictionary."""
    response = {
        "success": False,
        "message": message,
        "data": data,
        "details": details
    }
    if errors:
        response["errors"] = errors
    return response


def validation_error_response(errors: dict) -> dict:
    """Create a validation error response."""
    error_list = [
        ErrorDetail(
            code="VALIDATION_ERROR",
            field=field,
            message=msg
        )
        for field, msg in errors.items()
    ]
    return {
        "success": False,
        "message": "Request validation failed",
        "data": None,
        "errors": error_list,
        "details": {"error_type": "validation"}
    }


def not_found_response(resource: str = "Resource") -> dict:
    """Create a not found error response."""
    return {
        "success": False,
        "message": f"{resource} not found",
        "data": None,
        "details": {"error_type": "not_found", "resource_type": resource}
    }


def external_service_error_response(
    service: str,
    message: str,
    details: dict = None
) -> dict:
    """Create an external service error response."""
    return {
        "success": False,
        "message": f"{service}: {message}",
        "data": None,
        "details": {
            "error_type": "external_service",
            "service": service,
            **(details or {})
        }
    }


def rate_limit_error_response(
    message: str = "Rate limit exceeded",
    retry_after: int = None
) -> dict:
    """Create a rate limit error response."""
    details = {"error_type": "rate_limit"}
    if retry_after:
        details["retry_after_seconds"] = retry_after

    return {
        "success": False,
        "message": message,
        "data": None,
        "details": details
    }
