from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import re

from app.api.routes.agentic import router as agentic_router
from app.api.routes.auth import router as auth_router
from app.api.routes.config_routes import router as config_router
from app.api.routes.deck import router as deck_router
from app.api.routes.labware import router as labware_router
from app.api.routes.rag import router as rag_router
from app.api.routes.settings import router as settings_router
from app.api.routes.simulation import router as simulation_router
from app.database import init_db, AsyncSessionLocal
from app.models.seed_data import seed_labware_data
from app.core.responses import ApiResponse
from app.core.exceptions import AppException

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()

    # Seed data for new tables
    async with AsyncSessionLocal() as session:
        # Seed labware data (if not already seeded)
        await seed_labware_data(session)

        # Create default admin user if no users exist
        from sqlalchemy import select
        from app.models.user import User, UserRole

        result = await session.execute(select(User).limit(1))
        if not result.scalar_one_or_none():
            admin = User(
                email="admin@hamilton.local",
                username="admin",
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,  # Skip verification for initial admin
                is_superuser=True
            )
            admin.set_password("Admin123!")  # Change on first login!
            session.add(admin)
            await session.commit()
            logging.warning("Created default admin user: admin@hamilton.local / Admin123!")

    yield
    # Shutdown
    pass


app = FastAPI(
    title="PyHamilton Automation Agent",
    description="AI-powered PyHamilton script generation backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware with cookie support
# allow_origins must be explicit (never "*") when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://pyhamilton.tolgaozgun.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "X-Total-Count"],
)

# Exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Convert HTTPException to standardized response format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            "data": None,
        },
        headers=dict(exc.headers) if exc.headers else None,
    )


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """Handle custom application exceptions."""
    return ApiResponse.error(
        message=exc.message,
        data=exc.data,
        status_code=exc.status_code,
        details=exc.details
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle FastAPI validation errors."""
    errors = {}
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors[field] = error["msg"]

    return ApiResponse.validation_error(
        message="Request validation failed",
        errors=errors
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    # Log the full exception for debugging
    logger.exception(f"Unexpected error: {exc}")

    # Handle Google API errors
    exc_type = type(exc).__name__
    exc_module = type(exc).__module__

    # Check for Google API errors
    if "google" in exc_module.lower() or "genai" in exc_module.lower():
        error_message = str(exc)
        status_code = getattr(exc, "status_code", None)

        # Parse rate limit error with retry info
        if status_code == 429 or "RESOURCE_EXHAUSTED" in error_message or "quota" in error_message.lower():
            retry_after = None
            retry_match = re.search(r'retry in ([\d.]+)s', error_message)
            if retry_match:
                retry_after = int(float(retry_match.group(1)))

            details = {
                "error_type": "rate_limit_error",
                "service": "Google AI"
            }
            if retry_after:
                details["retry_after_seconds"] = retry_after

            return ApiResponse.error(
                message="Google API rate limit exceeded. Please try again later.",
                status_code=429,
                details=details
            )

        # Other Google API errors
        return ApiResponse.error(
            message=f"Google AI service error: {error_message[:200]}",
            status_code=502,
            details={
                "error_type": "google_api_error",
                "service": "Google AI"
            }
        )

    # Generic error with more context
    return ApiResponse.error(
        message=f"An unexpected error occurred: {exc_type}",
        status_code=500,
        details={
            "error_type": "internal_error",
            "error_class": exc_type,
            "error_message": str(exc)[:500]  # Increased limit for better debugging
        }
    )


# Include routers
app.include_router(auth_router)  # Authentication routes (must be first for proper ordering)
app.include_router(agentic_router)
app.include_router(config_router)
app.include_router(deck_router)
app.include_router(labware_router)
app.include_router(rag_router)
app.include_router(settings_router)
app.include_router(simulation_router)


@app.get("/")
async def root():
    return ApiResponse.success(
        data={
            "name": "PyHamilton Automation Agent",
            "version": "0.1.0",
            "docs": "/docs",
        },
        message="Welcome to PyHamilton Automation Agent API"
    )


@app.get("/api/health")
async def health_check():
    return ApiResponse.success(
        data={"status": "healthy"},
        message="Service is running"
    )
