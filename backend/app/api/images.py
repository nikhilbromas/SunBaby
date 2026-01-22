"""
FastAPI endpoints for Image management.
"""
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from typing import Optional
from app.models.image import ImageResponse, ImageListResponse
from app.services.image_service import image_service
from app.services.auth_service import auth_service
from app.database import db
from app.utils.company_schema import ensure_company_schema
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["Images"])


@router.post("/upload", response_model=ImageResponse, status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
    created_by: Optional[str] = Query(None, description="User who uploaded the image"),
):
    """
    Upload a new image.
    
    - **file**: Image file to upload (multipart/form-data)
    - **company_id**: Optional company ID to select company DB
    - **created_by**: Optional user identifier
    """
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportImages','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to upload images",
                )
        
        # Read file content
        file_content = await file.read()
        
        # Get MIME type
        mime_type = file.content_type or 'application/octet-stream'
        
        # Upload and process image
        image = image_service.upload_image(
            file_content=file_content,
            filename=file.filename or 'image',
            mime_type=mime_type,
            company_id=company_id or 0,  # Use 0 if no company_id provided
            created_by=created_by
        )
        
        return image
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportImages" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to upload images",
            )
        logger.error(f"Error uploading image: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(
    image_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Get an image by ID."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportImages','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access images",
                )
        
        image = image_service.get_image(image_id, company_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        return image
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportImages" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to access images",
            )
        logger.error(f"Error getting image: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.get("", response_model=ImageListResponse)
async def list_images(
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return")
):
    """List all active images."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportImages','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to list images",
                )
        
        images, total = image_service.list_images(company_id=company_id, skip=skip, limit=limit)
        return ImageListResponse(images=images, total=total)
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        logger.error(f"Error listing images: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.delete("/{image_id}", status_code=204)
async def delete_image(
    image_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Delete an image (soft delete)."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportImages','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to delete images",
                )
        
        success = image_service.delete_image(image_id, company_id)
        if not success:
            raise HTTPException(status_code=404, detail="Image not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportImages" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to delete images",
            )
        logger.error(f"Error deleting image: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")

