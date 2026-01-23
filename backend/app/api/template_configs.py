"""
FastAPI endpoints for Template Config management.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.template_config import TemplateConfigCreate, TemplateConfigUpdate, TemplateConfigResponse, TemplateConfigListResponse
from app.services.template_config_service import template_config_service
from app.services.auth_service import auth_service
from app.database import db
from app.utils.company_schema import ensure_company_schema
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/template-configs", tags=["Template Configs"])


@router.post("", response_model=TemplateConfigResponse, status_code=201)
async def create_template_config(
    config_data: TemplateConfigCreate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """
    Create a new template config.
    
    - **TemplateId**: Template ID from ReportTemplates
    - **PresetId**: Preset ID from ReportSqlPresets
    - **InterfaceId**: Interface ID from ainterface table
    - **DepartmentId**: Optional Department ID from aDepartmentMaster
    - **ShopId**: Optional Shop ID from ashops
    - **Type**: Type of configuration
    - **Description**: Description of the configuration
    - **CreatedBy**: User who created the config
    """
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.TemplateConfig','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to create template configs",
                )

        config = template_config_service.create_template_config(config_data)
        return config
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "TemplateConfig" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to create template configs",
            )
        logger.error(f"Error creating template config: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.get("/{config_id}", response_model=TemplateConfigResponse)
async def get_template_config(
    config_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Get a template config by ID."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.TemplateConfig','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access template configs",
                )

        config = await template_config_service.get_template_config(config_id)
        if not config:
            raise HTTPException(status_code=404, detail="Template config not found")
        return config
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "TemplateConfig" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to access template configs",
            )
        logger.error(f"Error getting template config: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.get("", response_model=TemplateConfigListResponse)
async def list_template_configs(
    template_id: Optional[int] = Query(None, description="Filter by template ID"),
    preset_id: Optional[int] = Query(None, description="Filter by preset ID"),
    interface_id: Optional[int] = Query(None, description="Filter by interface ID"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    shop_id: Optional[int] = Query(None, description="Filter by shop ID"),
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return")
):
    """List template configs, optionally filtered."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.TemplateConfig','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to list template configs",
                )

        configs, total = template_config_service.list_template_configs(
            template_id=template_id,
            preset_id=preset_id,
            interface_id=interface_id,
            department_id=department_id,
            shop_id=shop_id,
            skip=skip,
            limit=limit
        )
        return TemplateConfigListResponse(configs=configs, total=total)
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        logger.error(f"Error listing template configs: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.put("/{config_id}", response_model=TemplateConfigResponse)
async def update_template_config(
    config_id: int,
    config_data: TemplateConfigUpdate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Update an existing template config."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.TemplateConfig','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to update template configs",
                )

        config = template_config_service.update_template_config(config_id, config_data)
        if not config:
            raise HTTPException(status_code=404, detail="Template config not found")
        return config
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "TemplateConfig" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to update template configs",
            )
        logger.error(f"Error updating template config: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.delete("/{config_id}", status_code=204)
async def delete_template_config(
    config_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Delete a template config (soft delete)."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.TemplateConfig','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to delete template configs",
                )

        success = template_config_service.delete_template_config(config_id)
        if not success:
            raise HTTPException(status_code=404, detail="Template config not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "TemplateConfig" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to delete template configs",
            )
        logger.error(f"Error deleting template config: {msg}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")

