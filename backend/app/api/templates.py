"""
FastAPI endpoints for Template management.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.template import TemplateCreate, TemplateUpdate, TemplateResponse, TemplateListResponse
from app.services.template_service import template_service
from app.services.auth_service import auth_service
from app.database import db
from app.utils.company_schema import ensure_company_schema
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/templates", tags=["Templates"])


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(
    template_data: TemplateCreate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """
    Create a new template.
    
    - **PresetId**: Linked SQL preset ID
    - **TemplateName**: Name of the template
    - **TemplateJson**: JSON string with template configuration
    - **CreatedBy**: User who created the template
    """
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplates','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to create templates",
                )

        template = await template_service.create_template(template_data)
        return template
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplates" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to create templates",
            )
        logger.error(f"Error creating template: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Get a template by ID."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            # If caller didn't provide company_id, ensure the current DB has the template tables.
            # This avoids confusing 500s when the app is still on auth DB.
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplates','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access templates",
                )

        template = await template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template
    except HTTPException:
        raise
    except Exception as e:
        # Common misconfiguration: hitting auth DB (no ReportTemplates) without selecting company DB.
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplates" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to access templates",
            )
        logger.error(f"Error getting template: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    preset_id: Optional[int] = Query(None, description="Filter by preset ID"),
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return")
):
    """List templates, optionally filtered by preset."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplates','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to list templates",
                )

        templates, total = template_service.list_templates(preset_id=preset_id, skip=skip, limit=limit)
        return TemplateListResponse(templates=templates, total=total)
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        logger.error(f"Error listing templates: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    template_data: TemplateUpdate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Update an existing template."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplates','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to update templates",
                )

        template = template_service.update_template(template_id, template_data)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplates" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to update templates",
            )
        logger.error(f"Error updating template: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Delete a template (soft delete)."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplates','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to delete templates",
                )

        success = template_service.delete_template(template_id)
        if not success:
            raise HTTPException(status_code=404, detail="Template not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplates" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to delete templates",
            )
        logger.error(f"Error deleting template: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")

