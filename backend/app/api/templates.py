"""
FastAPI endpoints for Template management.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.template import TemplateCreate, TemplateUpdate, TemplateResponse, TemplateListResponse
from app.services.template_service import template_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/templates", tags=["Templates"])


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(template_data: TemplateCreate):
    """
    Create a new template.
    
    - **PresetId**: Linked SQL preset ID
    - **TemplateName**: Name of the template
    - **TemplateJson**: JSON string with template configuration
    - **CreatedBy**: User who created the template
    """
    try:
        template = template_service.create_template(template_data)
        return template
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating template: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: int):
    """Get a template by ID."""
    template = template_service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    preset_id: Optional[int] = Query(None, description="Filter by preset ID"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return")
):
    """List templates, optionally filtered by preset."""
    try:
        templates, total = template_service.list_templates(preset_id=preset_id, skip=skip, limit=limit)
        return TemplateListResponse(templates=templates, total=total)
    except Exception as e:
        logger.error(f"Error listing templates: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: int, template_data: TemplateUpdate):
    """Update an existing template."""
    try:
        template = template_service.update_template(template_id, template_data)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template
    except Exception as e:
        logger.error(f"Error updating template: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: int):
    """Delete a template (soft delete)."""
    success = template_service.delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return None

