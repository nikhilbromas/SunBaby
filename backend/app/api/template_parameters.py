"""
FastAPI endpoints for Template Parameter management.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.template_parameter import (
    TemplateParameterCreate,
    TemplateParameterUpdate,
    TemplateParameterResponse,
    TemplateParameterListResponse,
    BulkTemplateParameterUpdate
)
from app.services.template_parameter_service import template_parameter_service
from app.services.auth_service import auth_service
from app.database import db
from app.utils.company_schema import ensure_company_schema

router = APIRouter(prefix="/template-parameters", tags=["Template Parameters"])


@router.post("", response_model=TemplateParameterResponse, status_code=201)
async def create_template_parameter(
    parameter_data: TemplateParameterCreate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """
    Create a new template parameter.
    
    - **TemplateId**: Template ID
    - **ParameterName**: Parameter name
    - **ParameterValue**: Parameter value (JSON string)
    - **CreatedBy**: User who created the parameter
    """
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to create template parameters",
                )

        parameter = await template_parameter_service.create_parameter(parameter_data)
        return parameter
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplateParameters" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to create template parameters",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.get("/template/{template_id}", response_model=TemplateParameterListResponse)
async def get_template_parameters(
    template_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Get all parameters for a template."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access template parameters",
                )

        parameters = await template_parameter_service.get_parameters_by_template(template_id)
        return TemplateParameterListResponse(parameters=parameters, total=len(parameters))
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplateParameters" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to access template parameters",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.get("/{parameter_id}", response_model=TemplateParameterResponse)
async def get_template_parameter(
    parameter_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Get a template parameter by ID."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access template parameters",
                )

        parameter = await template_parameter_service.get_parameter(parameter_id)
        if not parameter:
            raise HTTPException(status_code=404, detail="Template parameter not found")
        return parameter
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplateParameters" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to access template parameters",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.put("/{parameter_id}", response_model=TemplateParameterResponse)
async def update_template_parameter(
    parameter_id: int,
    parameter_data: TemplateParameterUpdate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Update an existing template parameter."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to update template parameters",
                )

        parameter = await template_parameter_service.update_parameter(parameter_id, parameter_data)
        if not parameter:
            raise HTTPException(status_code=404, detail="Template parameter not found")
        return parameter
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplateParameters" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to update template parameters",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.delete("/{parameter_id}", status_code=204)
async def delete_template_parameter(
    parameter_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Delete a template parameter (soft delete)."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to delete template parameters",
                )

        success = await template_parameter_service.delete_parameter(parameter_id)
        if not success:
            raise HTTPException(status_code=404, detail="Template parameter not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplateParameters" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to delete template parameters",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.post("/bulk", response_model=TemplateParameterListResponse)
async def bulk_update_template_parameters(
    bulk_data: BulkTemplateParameterUpdate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Bulk create/update parameters for a template."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to bulk update template parameters",
                )

        parameters = await template_parameter_service.bulk_update_parameters(bulk_data)
        return TemplateParameterListResponse(parameters=parameters, total=len(parameters))
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportTemplateParameters" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to bulk update template parameters",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass

