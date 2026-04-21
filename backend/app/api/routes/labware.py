from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# Type alias for database session to avoid FastAPI issues
DbSession = AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.database import get_db
from app.models.labware import CarrierType, LabwareType, DeckPreset
from app.core.responses import ApiResponse

router = APIRouter(prefix="/api/labware", tags=["labware"])


# ============================================================================
# CARRIER TYPES - Must be defined BEFORE /{labware_id} to avoid route conflicts
# ============================================================================

class CarrierTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    category: str = Field(..., min_length=1, max_length=50)
    width_rails: int = Field(..., ge=1, le=55)
    num_slots: int = Field(..., ge=1, le=10)
    accepts: List[str] = Field(..., min_length=1)
    description: Optional[str] = Field(None, max_length=500)
    properties: Optional[Dict[str, Any]] = None


class CarrierTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    width_rails: Optional[int] = Field(None, ge=1, le=55)
    num_slots: Optional[int] = Field(None, ge=1, le=10)
    accepts: Optional[List[str]] = None
    description: Optional[str] = Field(None, max_length=500)
    properties: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class CarrierTypeResponse(BaseModel):
    id: int
    name: str
    code: str
    category: str
    width_rails: int
    num_slots: int
    accepts: List[str]
    description: Optional[str]
    properties: Optional[Dict[str, Any]]
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("/carriers")
async def list_carrier_types(
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    db: DbSession = Depends(get_db)
):
    """Get all carrier types with optional filtering"""
    try:
        query = select(CarrierType)

        if category:
            query = query.where(CarrierType.category == category)
        if is_active is not None:
            query = query.where(CarrierType.is_active == is_active)

        query = query.order_by(CarrierType.category, CarrierType.name)

        result = await db.execute(query)
        carriers = result.scalars().all()

        return ApiResponse.success(
            data=[CarrierTypeResponse.model_validate(c).model_dump() for c in carriers],
            message="Carrier types retrieved successfully"
        )
    except Exception as e:
        return ApiResponse.error(message=f"Failed to get carrier types: {str(e)}", status_code=500)


@router.get("/carriers/{carrier_id}")
async def get_carrier_type(carrier_id: int, db: DbSession = Depends(get_db)):
    """Get a specific carrier type by ID"""
    try:
        result = await db.execute(select(CarrierType).where(CarrierType.id == carrier_id))
        carrier = result.scalar_one_or_none()

        if not carrier:
            return ApiResponse.not_found(message="Carrier type not found", resource_type="carrier_type")

        return ApiResponse.success(
            data=CarrierTypeResponse.model_validate(carrier).model_dump(),
            message="Carrier type retrieved successfully"
        )
    except Exception as e:
        return ApiResponse.error(message=f"Failed to get carrier type: {str(e)}", status_code=500)


@router.post("/carriers", status_code=201)
async def create_carrier_type(carrier: CarrierTypeCreate, db: DbSession = Depends(get_db)):
    """Create a new carrier type"""
    try:
        existing = await db.execute(select(CarrierType).where(CarrierType.code == carrier.code))
        if existing.scalar_one_or_none():
            return ApiResponse.validation_error(
                message=f"Carrier type with code '{carrier.code}' already exists",
                errors={"code": f"Code '{carrier.code}' already exists"}
            )

        new_carrier = CarrierType(**carrier.model_dump())
        db.add(new_carrier)
        await db.commit()
        await db.refresh(new_carrier)

        return ApiResponse.success(
            data=CarrierTypeResponse.model_validate(new_carrier).model_dump(),
            message="Carrier type created successfully",
            status_code=201
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to create carrier type: {str(e)}", status_code=500)


@router.put("/carriers/{carrier_id}")
async def update_carrier_type(
    carrier_id: int,
    carrier: CarrierTypeUpdate,
    db: DbSession = Depends(get_db)
):
    """Update an existing carrier type"""
    try:
        result = await db.execute(select(CarrierType).where(CarrierType.id == carrier_id))
        existing = result.scalar_one_or_none()

        if not existing:
            return ApiResponse.not_found(message="Carrier type not found", resource_type="carrier_type")

        update_data = carrier.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing, field, value)

        await db.commit()
        await db.refresh(existing)

        return ApiResponse.success(
            data=CarrierTypeResponse.model_validate(existing).model_dump(),
            message="Carrier type updated successfully"
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to update carrier type: {str(e)}", status_code=500)


@router.delete("/carriers/{carrier_id}")
async def delete_carrier_type(carrier_id: int, db: DbSession = Depends(get_db)):
    """Delete a carrier type"""
    try:
        result = await db.execute(select(CarrierType).where(CarrierType.id == carrier_id))
        existing = result.scalar_one_or_none()

        if not existing:
            return ApiResponse.not_found(message="Carrier type not found", resource_type="carrier_type")

        await db.execute(delete(CarrierType).where(CarrierType.id == carrier_id))
        await db.commit()

        return ApiResponse.success(data={"deleted": True}, message="Carrier type deleted successfully")
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to delete carrier type: {str(e)}", status_code=500)


# ============================================================================
# LABWARE TYPES - Must be defined BEFORE /{labware_id} to avoid route conflicts
# ============================================================================

class LabwareTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    category: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    properties: Optional[Dict[str, Any]] = None


class LabwareTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    properties: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class LabwareTypeResponse(BaseModel):
    id: int
    name: str
    code: str
    category: str
    description: Optional[str]
    properties: Optional[Dict[str, Any]]
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("/labware-types")
async def list_labware_types(
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    db: DbSession = Depends(get_db)
):
    """Get all labware types with optional filtering"""
    try:
        query = select(LabwareType)

        if category:
            query = query.where(LabwareType.category == category)
        if is_active is not None:
            query = query.where(LabwareType.is_active == is_active)

        query = query.order_by(LabwareType.category, LabwareType.name)

        result = await db.execute(query)
        labware_types = result.scalars().all()

        return ApiResponse.success(
            data=[LabwareTypeResponse.model_validate(lt).model_dump() for lt in labware_types],
            message="Labware types retrieved successfully"
        )
    except Exception as e:
        return ApiResponse.error(message=f"Failed to get labware types: {str(e)}", status_code=500)


@router.get("/labware-types/{labware_type_id}")
async def get_labware_type(labware_type_id: int, db: DbSession = Depends(get_db)):
    """Get a specific labware type by ID"""
    try:
        result = await db.execute(select(LabwareType).where(LabwareType.id == labware_type_id))
        labware_type = result.scalar_one_or_none()

        if not labware_type:
            return ApiResponse.not_found(message="Labware type not found", resource_type="labware_type")

        return ApiResponse.success(
            data=LabwareTypeResponse.model_validate(labware_type).model_dump(),
            message="Labware type retrieved successfully"
        )
    except Exception as e:
        return ApiResponse.error(message=f"Failed to get labware type: {str(e)}", status_code=500)


@router.post("/labware-types", status_code=201)
async def create_labware_type(labware: LabwareTypeCreate, db: DbSession = Depends(get_db)):
    """Create a new labware type"""
    try:
        existing = await db.execute(select(LabwareType).where(LabwareType.code == labware.code))
        if existing.scalar_one_or_none():
            return ApiResponse.validation_error(
                message=f"Labware type with code '{labware.code}' already exists",
                errors={"code": f"Code '{labware.code}' already exists"}
            )

        new_labware = LabwareType(**labware.model_dump())
        db.add(new_labware)
        await db.commit()
        await db.refresh(new_labware)

        return ApiResponse.success(
            data=LabwareTypeResponse.model_validate(new_labware).model_dump(),
            message="Labware type created successfully",
            status_code=201
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to create labware type: {str(e)}", status_code=500)


@router.put("/labware-types/{labware_type_id}")
async def update_labware_type(
    labware_type_id: int,
    labware: LabwareTypeUpdate,
    db: DbSession = Depends(get_db)
):
    """Update an existing labware type"""
    try:
        result = await db.execute(select(LabwareType).where(LabwareType.id == labware_type_id))
        existing = result.scalar_one_or_none()

        if not existing:
            return ApiResponse.not_found(message="Labware type not found", resource_type="labware_type")

        update_data = labware.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing, field, value)

        await db.commit()
        await db.refresh(existing)

        return ApiResponse.success(
            data=LabwareTypeResponse.model_validate(existing).model_dump(),
            message="Labware type updated successfully"
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to update labware type: {str(e)}", status_code=500)


@router.delete("/labware-types/{labware_type_id}")
async def delete_labware_type(labware_type_id: int, db: DbSession = Depends(get_db)):
    """Delete a labware type"""
    try:
        result = await db.execute(select(LabwareType).where(LabwareType.id == labware_type_id))
        existing = result.scalar_one_or_none()

        if not existing:
            return ApiResponse.not_found(message="Labware type not found", resource_type="labware_type")

        await db.execute(delete(LabwareType).where(LabwareType.id == labware_type_id))
        await db.commit()

        return ApiResponse.success(data={"deleted": True}, message="Labware type deleted successfully")
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to delete labware type: {str(e)}", status_code=500)


# ============================================================================
# DECK PRESETS - Must be defined BEFORE /{labware_id} to avoid route conflicts
# ============================================================================

class DeckPresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=50)
    configuration: Dict[str, Any] = Field(...)


class DeckPresetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=50)
    configuration: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class DeckPresetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    configuration: Dict[str, Any]
    is_active: bool
    is_default: bool

    model_config = {"from_attributes": True}


@router.get("/presets")
async def list_deck_presets(
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    db: DbSession = Depends(get_db)
):
    """Get all deck presets with optional filtering"""
    try:
        query = select(DeckPreset)

        if category:
            query = query.where(DeckPreset.category == category)
        if is_active is not None:
            query = query.where(DeckPreset.is_active == is_active)

        query = query.order_by(DeckPreset.category, DeckPreset.name)

        result = await db.execute(query)
        presets = result.scalars().all()

        return ApiResponse.success(
            data=[DeckPresetResponse.model_validate(p).model_dump() for p in presets],
            message="Deck presets retrieved successfully"
        )
    except Exception as e:
        return ApiResponse.error(message=f"Failed to get deck presets: {str(e)}", status_code=500)


@router.get("/presets/{preset_id}")
async def get_deck_preset(preset_id: int, db: DbSession = Depends(get_db)):
    """Get a specific deck preset by ID"""
    try:
        result = await db.execute(select(DeckPreset).where(DeckPreset.id == preset_id))
        preset = result.scalar_one_or_none()

        if not preset:
            return ApiResponse.not_found(message="Deck preset not found", resource_type="deck_preset")

        return ApiResponse.success(
            data=DeckPresetResponse.model_validate(preset).model_dump(),
            message="Deck preset retrieved successfully"
        )
    except Exception as e:
        return ApiResponse.error(message=f"Failed to get deck preset: {str(e)}", status_code=500)


@router.post("/presets", status_code=201)
async def create_deck_preset(preset: DeckPresetCreate, db: DbSession = Depends(get_db)):
    """Create a new deck preset"""
    try:
        existing = await db.execute(select(DeckPreset).where(DeckPreset.name == preset.name))
        if existing.scalar_one_or_none():
            return ApiResponse.validation_error(
                message=f"Deck preset with name '{preset.name}' already exists",
                errors={"name": f"Name '{preset.name}' already exists"}
            )

        new_preset = DeckPreset(**preset.model_dump())
        db.add(new_preset)
        await db.commit()
        await db.refresh(new_preset)

        return ApiResponse.success(
            data=DeckPresetResponse.model_validate(new_preset).model_dump(),
            message="Deck preset created successfully",
            status_code=201
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to create deck preset: {str(e)}", status_code=500)


@router.put("/presets/{preset_id}")
async def update_deck_preset(
    preset_id: int,
    preset: DeckPresetUpdate,
    db: DbSession = Depends(get_db)
):
    """Update an existing deck preset"""
    try:
        result = await db.execute(select(DeckPreset).where(DeckPreset.id == preset_id))
        existing = result.scalar_one_or_none()

        if not existing:
            return ApiResponse.not_found(message="Deck preset not found", resource_type="deck_preset")

        update_data = preset.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing, field, value)

        await db.commit()
        await db.refresh(existing)

        return ApiResponse.success(
            data=DeckPresetResponse.model_validate(existing).model_dump(),
            message="Deck preset updated successfully"
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to update deck preset: {str(e)}", status_code=500)


@router.delete("/presets/{preset_id}")
async def delete_deck_preset(preset_id: int, db: DbSession = Depends(get_db)):
    """Delete a deck preset"""
    try:
        result = await db.execute(select(DeckPreset).where(DeckPreset.id == preset_id))
        existing = result.scalar_one_or_none()

        if not existing:
            return ApiResponse.not_found(message="Deck preset not found", resource_type="deck_preset")

        await db.execute(delete(DeckPreset).where(DeckPreset.id == preset_id))
        await db.commit()

        return ApiResponse.success(data={"deleted": True}, message="Deck preset deleted successfully")
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(message=f"Failed to delete deck preset: {str(e)}", status_code=500)


