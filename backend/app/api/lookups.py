"""
FastAPI endpoints for lookup data (departments, shops, interfaces).
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.database import db
from app.services.auth_service import auth_service
from app.utils.company_schema import ensure_company_schema

router = APIRouter(prefix="/lookups", tags=["Lookups"])


class Department(BaseModel):
    """Department model."""
    DepartmentID: int
    DepartmentName: str
    CompanyID: Optional[int] = None


class Shop(BaseModel):
    """Shop model."""
    ShopID: int
    ShopName: str
    DepartmentID: Optional[int] = None
    ShopLocation: Optional[str] = None


class Interface(BaseModel):
    """Interface model."""
    InterfaceID: int
    InterfaceName: str
    ModuleCode: Optional[str] = None
    CompanyID: Optional[int] = None


@router.get("/departments", response_model=List[Department])
async def get_departments(
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Get all departments from aDepartmentMaster table."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            # Check if table exists
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.aDepartmentMaster','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access departments",
                )
        
        query = "SELECT DepartmentID, DepartmentName, CompanyID FROM aDepartmentMaster ORDER BY DepartmentName"
        results = await db.execute_query_async(query, {})
        
        departments = []
        for row in results:
            departments.append(Department(
                DepartmentID=row.get('DepartmentID'),
                DepartmentName=row.get('DepartmentName', ''),
                CompanyID=row.get('CompanyID')
            ))
        
        return departments
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.get("/shops", response_model=List[Shop])
async def get_shops(
    department_id: Optional[int] = Query(None, description="Filter shops by department ID"),
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Get shops from ashops table, optionally filtered by department."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            # Check if table exists
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ashops','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access shops",
                )
        
        if department_id is not None:
            query = "SELECT ShopID, ShopName, DepartmentID, ShopLocation FROM ashops WHERE DepartmentID = @department_id ORDER BY ShopName"
            params = {"department_id": department_id}
        else:
            query = "SELECT ShopID, ShopName, DepartmentID, ShopLocation FROM ashops ORDER BY ShopName"
            params = {}
        
        results = await db.execute_query_async(query, params)
        
        shops = []
        for row in results:
            shops.append(Shop(
                ShopID=row.get('ShopID'),
                ShopName=row.get('ShopName', ''),
                DepartmentID=row.get('DepartmentID'),
                ShopLocation=row.get('ShopLocation')
            ))
        
        return shops
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.get("/interfaces", response_model=List[Interface])
async def get_interfaces(
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    search: Optional[str] = Query(None, description="Search by interface name"),
):
    """Get interfaces from ainterface table with pagination and optional search."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            # Check if table exists
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ainterface','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access interfaces",
                )
        
        # Build query with optional search
        if search:
            query = """
                SELECT InterfaceID, InterfaceName, ModuleCode, CompanyID 
                FROM ainterface 
                WHERE InterfaceName LIKE @search_pattern
                ORDER BY InterfaceName
                OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
            """
            params = {
                "search_pattern": f"%{search}%",
                "skip": skip,
                "limit": limit
            }
        else:
            query = """
                SELECT InterfaceID, InterfaceName, ModuleCode, CompanyID 
                FROM ainterface 
                ORDER BY InterfaceName
                OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
            """
            params = {
                "skip": skip,
                "limit": limit
            }
        
        results = await db.execute_query_async(query, params)
        
        interfaces = []
        for row in results:
            interfaces.append(Interface(
                InterfaceID=row.get('InterfaceID'),
                InterfaceName=row.get('InterfaceName', ''),
                ModuleCode=row.get('ModuleCode'),
                CompanyID=row.get('CompanyID')
            ))
        
        return interfaces
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass

