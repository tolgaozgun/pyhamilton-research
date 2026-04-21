from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps_auth import get_current_active_user
from app.core.responses import ApiResponse
from app.database import get_db, DbSession
from app.models import UserSettings
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["rag"])


async def _get_openai_client(db: DbSession, user: User):
    """Resolve user's OpenAI API key and return an async OpenAI client."""
    import openai  # lazy import to avoid hard dependency at startup

    result = await db.execute(
        select(UserSettings).where(
            UserSettings.user_id == user.id,
            UserSettings.provider == "openai",
        )
    )
    settings = result.scalar_one_or_none()
    api_key = settings.api_key if settings else None

    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No OpenAI API key configured. Please save your OpenAI API key in Settings.",
        )

    return openai.AsyncOpenAI(api_key=api_key)


# ─── Request/Response Models ──────────────────────────────────────────────────

class CreateVectorStoreRequest(BaseModel):
    name: str
    file_ids: list[str] = []
    expires_after_days: Optional[int] = None


class AddFileToVectorStoreRequest(BaseModel):
    file_id: str


class SearchVectorStoreRequest(BaseModel):
    query: str
    max_results: int = 5


# ─── Files ───────────────────────────────────────────────────────────────────

@router.get("/files")
async def list_files(
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all uploaded files (purpose=assistants)."""
    client = await _get_openai_client(db, current_user)
    files = await client.files.list(purpose="assistants")
    return ApiResponse.success(
        data={"files": [f.model_dump() for f in files.data]},
        message="Files retrieved successfully",
    )


@router.post("/files")
async def upload_file(
    file: UploadFile = File(...),
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Upload a file for use in vector stores."""
    client = await _get_openai_client(db, current_user)
    content = await file.read()
    response = await client.files.create(
        file=(file.filename, content, file.content_type or "application/octet-stream"),
        purpose="assistants",
    )
    return ApiResponse.success(data=response.model_dump(), message="File uploaded successfully")


@router.get("/files/{file_id}")
async def get_file(
    file_id: str,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve metadata for a single file."""
    client = await _get_openai_client(db, current_user)
    file_obj = await client.files.retrieve(file_id)
    return ApiResponse.success(data=file_obj.model_dump(), message="File retrieved")


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a file from OpenAI storage."""
    client = await _get_openai_client(db, current_user)
    result = await client.files.delete(file_id)
    return ApiResponse.success(data=result.model_dump(), message="File deleted successfully")


# ─── Vector Stores ────────────────────────────────────────────────────────────

@router.get("/vector-stores")
async def list_vector_stores(
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all vector stores."""
    client = await _get_openai_client(db, current_user)
    stores = await client.vector_stores.list()
    return ApiResponse.success(
        data={"vector_stores": [s.model_dump() for s in stores.data]},
        message="Vector stores retrieved successfully",
    )


@router.post("/vector-stores")
async def create_vector_store(
    req: CreateVectorStoreRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new vector store, optionally seeding it with file IDs."""
    client = await _get_openai_client(db, current_user)

    kwargs: dict = {"name": req.name}
    if req.file_ids:
        kwargs["file_ids"] = req.file_ids
    if req.expires_after_days:
        kwargs["expires_after"] = {
            "anchor": "last_active_at",
            "days": req.expires_after_days,
        }

    store = await client.vector_stores.create(**kwargs)
    return ApiResponse.success(data=store.model_dump(), message="Vector store created successfully")


@router.get("/vector-stores/{vector_store_id}")
async def get_vector_store(
    vector_store_id: str,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve a single vector store."""
    client = await _get_openai_client(db, current_user)
    store = await client.vector_stores.retrieve(vector_store_id)
    return ApiResponse.success(data=store.model_dump(), message="Vector store retrieved")


@router.delete("/vector-stores/{vector_store_id}")
async def delete_vector_store(
    vector_store_id: str,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a vector store."""
    client = await _get_openai_client(db, current_user)
    result = await client.vector_stores.delete(vector_store_id)
    return ApiResponse.success(data=result.model_dump(), message="Vector store deleted successfully")


# ─── Vector Store Files ───────────────────────────────────────────────────────

@router.get("/vector-stores/{vector_store_id}/files")
async def list_vector_store_files(
    vector_store_id: str,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all files attached to a vector store."""
    client = await _get_openai_client(db, current_user)
    files = await client.vector_stores.files.list(vector_store_id)
    return ApiResponse.success(
        data={"files": [f.model_dump() for f in files.data]},
        message="Vector store files retrieved",
    )


@router.post("/vector-stores/{vector_store_id}/files")
async def add_file_to_vector_store(
    vector_store_id: str,
    req: AddFileToVectorStoreRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Attach an existing file to a vector store."""
    client = await _get_openai_client(db, current_user)
    result = await client.vector_stores.files.create(
        vector_store_id=vector_store_id,
        file_id=req.file_id,
    )
    return ApiResponse.success(data=result.model_dump(), message="File added to vector store")


@router.delete("/vector-stores/{vector_store_id}/files/{file_id}")
async def remove_file_from_vector_store(
    vector_store_id: str,
    file_id: str,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Detach a file from a vector store (does not delete the file itself)."""
    client = await _get_openai_client(db, current_user)
    result = await client.vector_stores.files.delete(
        vector_store_id=vector_store_id,
        file_id=file_id,
    )
    return ApiResponse.success(data=result.model_dump(), message="File removed from vector store")


@router.post("/vector-stores/{vector_store_id}/search")
async def search_vector_store(
    vector_store_id: str,
    req: SearchVectorStoreRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Semantic search within a vector store."""
    client = await _get_openai_client(db, current_user)
    results = await client.vector_stores.search(
        vector_store_id=vector_store_id,
        query=req.query,
        max_num_results=req.max_results,
    )
    return ApiResponse.success(
        data={"results": [r.model_dump() for r in results.data]},
        message="Search completed",
    )
