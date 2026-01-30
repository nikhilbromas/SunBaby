"""
FastAPI endpoints for SQL Preset management.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.models.preset import PresetCreate, PresetUpdate, PresetResponse, PresetListResponse
from app.services.preset_service import preset_service
from app.utils.sql_validator import SQLValidationError
from app.services.auth_service import auth_service
from app.database import db
from app.utils.company_schema import ensure_company_schema

router = APIRouter(prefix="/presets", tags=["Presets"])


class TestPresetRequest(BaseModel):
    """Request model for testing preset queries."""
    parameters: Dict[str, Any]


@router.post("", response_model=PresetResponse, status_code=201)
async def create_preset(
    preset_data: PresetCreate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """
    Create a new SQL preset.
    
    - **PresetName**: Name of the preset
    - **SqlJson**: JSON string with headerQuery and/or itemQuery
    - **ExpectedParams**: Comma-separated list of expected parameters
    - **CreatedBy**: User who created the preset
    """
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportSqlPresets','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to create presets",
                )

        preset = preset_service.create_preset(preset_data)
        return preset
    except HTTPException:
        raise
    except SQLValidationError as e:
        raise HTTPException(status_code=400, detail=f"SQL validation failed: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportSqlPresets" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to create presets",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.get("/{preset_id}", response_model=PresetResponse)
async def get_preset(
    preset_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Get a preset by ID."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportSqlPresets','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to access presets",
                )

        preset = await preset_service.get_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        return preset
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.get("", response_model=PresetListResponse)
async def list_presets(
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return")
):
    """List all active presets."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportSqlPresets','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to list presets",
                )

        presets, total = preset_service.list_presets(skip=skip, limit=limit)
        return PresetListResponse(presets=presets, total=total)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.put("/{preset_id}", response_model=PresetResponse)
async def update_preset(
    preset_id: int,
    preset_data: PresetUpdate,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Update an existing preset."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportSqlPresets','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to update presets",
                )

        preset = preset_service.update_preset(preset_id, preset_data)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        return preset
    except HTTPException:
        raise
    except SQLValidationError as e:
        raise HTTPException(status_code=400, detail=f"SQL validation failed: {str(e)}")
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportSqlPresets" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to update presets",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.delete("/{preset_id}", status_code=204)
async def delete_preset(
    preset_id: int,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """Delete a preset (soft delete)."""
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportSqlPresets','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to delete presets",
                )

        success = preset_service.delete_preset(preset_id)
        if not success:
            raise HTTPException(status_code=404, detail="Preset not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if company_id is None and "Invalid object name" in msg and "ReportSqlPresets" in msg:
            raise HTTPException(
                status_code=400,
                detail="company_id is required (or select company via /auth/select-company) to delete presets",
            )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if company_id is not None:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass


@router.post("/{preset_id}/test")
async def test_preset_queries(
    preset_id: int,
    request: TestPresetRequest,
    company_id: Optional[int] = Query(None, description="Optional company ID to select company DB"),
):
    """
    Test preset queries with parameters and return sample data.
    Useful for template designers to see available fields.
    
    - **preset_id**: Preset ID to test
    - **parameters**: Dictionary of parameter values for SQL queries
    """
    import json
    import re
    
    try:
        if company_id is not None:
            details = auth_service.get_company_details(company_id)
            if not details:
                raise HTTPException(status_code=404, detail="Company not found")
            db.switch_to_company_db(details)
            ensure_company_schema()
        else:
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportSqlPresets','U')") is not None
            if not exists:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required (or select company via /auth/select-company) to test presets",
                )

        # Get preset
        preset = await preset_service.get_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        # Parse SQL JSON
        sql_json = json.loads(preset.SqlJson)
        
        # Extract required parameters
        param_pattern = r'@(\w+)'
        required_params_set = set()  # Use set to avoid duplicates (case-insensitive)
        
        # Extract from headerQuery and itemQuery
        if 'headerQuery' in sql_json and sql_json['headerQuery']:
            params = re.findall(param_pattern, sql_json['headerQuery'], re.IGNORECASE)
            for p in params:
                required_params_set.add(p.lower())
        
        if 'itemQuery' in sql_json and sql_json['itemQuery']:
            params = re.findall(param_pattern, sql_json['itemQuery'], re.IGNORECASE)
            for p in params:
                required_params_set.add(p.lower())
        
        # Extract from contentDetails
        if 'contentDetails' in sql_json and isinstance(sql_json['contentDetails'], list):
            for content_detail in sql_json['contentDetails']:
                if isinstance(content_detail, dict) and 'query' in content_detail:
                    params = re.findall(param_pattern, content_detail['query'], re.IGNORECASE)
                    for p in params:
                        required_params_set.add(p.lower())
        
        # Build case-insensitive map of provided parameters
        provided_params_lower = {k.lower(): v for k, v in request.parameters.items()}
        
        # Validate parameters (case-insensitive)
        missing_params = [p for p in required_params_set if p not in provided_params_lower]
        if missing_params:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required parameters: {', '.join(missing_params)}"
            )
        
        # Normalize parameters for SQL execution (use lowercase keys)
        normalized_params = {k.lower(): v for k, v in request.parameters.items()}
        
        # Execute queries and get sample data
        header_data = None
        items_data = None
        header_fields = []
        items_fields = []
        content_details_data = {}
        
        # Use normalized parameters for execution (handles case differences)
        exec_params = normalized_params
        
        if 'headerQuery' in sql_json:
            try:
                query = sql_json['headerQuery']
                header_data = db.execute_query(query, exec_params)
                if header_data and len(header_data) > 0:
                    header_fields = list(header_data[0].keys())
                    header_data = header_data[0]  # Return first row as sample
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error executing header query: {str(e)}")
        
        if 'itemQuery' in sql_json:
            try:
                query = sql_json['itemQuery']
                items_data = db.execute_query(query, exec_params)
                if items_data and len(items_data) > 0:
                    items_fields = list(items_data[0].keys())
                    items_data = items_data[:5]  # Return first 5 rows as samples
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error executing item query: {str(e)}")
        
        # Execute contentDetails queries
        if 'contentDetails' in sql_json and isinstance(sql_json['contentDetails'], list):
            for content_detail in sql_json['contentDetails']:
                if not isinstance(content_detail, dict) or 'name' not in content_detail or 'query' not in content_detail:
                    continue
                
                name = content_detail['name']
                query = content_detail['query']
                data_type = content_detail.get('dataType', 'array')  # Default to 'array' for backward compatibility
                
                try:
                    cd_data = db.execute_query(query, exec_params)
                    cd_fields = []
                    
                    if data_type == 'object':
                        # Object type: return single row (first row) like header
                        if cd_data and len(cd_data) > 0:
                            cd_fields = list(cd_data[0].keys())
                            cd_data = cd_data[0]  # Return first row as single object
                        else:
                            cd_data = None
                        
                        content_details_data[name] = {
                            "data": cd_data,
                            "fields": cd_fields,
                            "sampleCount": 1 if cd_data else 0,
                            "dataType": "object"
                        }
                    else:
                        # Array type: return multiple rows like items
                        if cd_data and len(cd_data) > 0:
                            cd_fields = list(cd_data[0].keys())
                            cd_data = cd_data[:5]  # Return first 5 rows as samples
                        else:
                            cd_data = []
                        
                        content_details_data[name] = {
                            "data": cd_data if cd_data else [],
                            "fields": cd_fields,
                            "sampleCount": len(cd_data) if cd_data else 0,
                            "dataType": "array"
                        }
                except Exception as e:
                    content_details_data[name] = {
                        "data": [] if data_type == 'array' else None,
                        "fields": [],
                        "sampleCount": 0,
                        "dataType": data_type,
                        "error": str(e)
                    }
        
        return {
            "header": {
                "data": header_data,
                "fields": header_fields
            },
            "items": {
                "data": items_data,
                "fields": items_fields,
                "sampleCount": len(items_data) if items_data else 0
            },
            "contentDetails": content_details_data
        }
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

