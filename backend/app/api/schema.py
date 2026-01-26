"""
FastAPI endpoints for database schema introspection.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.schema import (
    TableListResponse,
    ColumnListResponse,
    RelationshipListResponse
)
from app.services.schema_service import schema_service
from app.services.auth_service import auth_service
from app.database import db
from app.utils.company_schema import ensure_company_schema
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schema", tags=["Schema"])


@router.get("/tables", response_model=TableListResponse)
async def get_tables(
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
    search: Optional[str] = Query(None, description="Search term to filter tables by name"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(500, ge=1, le=1000, description="Maximum number of records to return")
):
    """
    Get list of tables and views from the database.
    
    - **search**: Optional search term to filter by table name
    - **skip**: Pagination offset
    - **limit**: Maximum results to return
    """
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        
        tables, total = schema_service.get_tables_and_views(
            search=search,
            skip=skip,
            limit=limit
        )
        
        return TableListResponse(tables=tables, total=total)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tables: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.get("/tables/{table_name}/columns", response_model=ColumnListResponse)
async def get_table_columns(
    table_name: str,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB")
):
    """
    Get columns for a specific table or view.
    
    - **table_name**: Name of the table or view
    """
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        
        columns = schema_service.get_table_columns(table_name)
        
        if not columns:
            raise HTTPException(
                status_code=404, 
                detail=f"Table '{table_name}' not found or has no columns"
            )
        
        return ColumnListResponse(columns=columns)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting columns for {table_name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")


@router.get("/relationships", response_model=RelationshipListResponse)
async def get_relationships(
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB")
):
    """
    Get foreign key relationships between tables.
    Useful for suggesting JOIN conditions.
    """
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        
        relationships = schema_service.get_table_relationships()
        
        return RelationshipListResponse(relationships=relationships)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting relationships: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                logger.exception("Failed to switch back to auth DB")

