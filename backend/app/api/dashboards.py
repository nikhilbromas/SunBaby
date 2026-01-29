"""FastAPI endpoints for analytics dashboards."""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.models.dashboard import DashboardCreate, DashboardListResponse, DashboardResponse, DashboardUpdate
from app.services.dashboard_service import dashboard_service
from app.utils.company_schema import ensure_company_schema
from app.utils.session import require_session

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])


def _ensure_company_context(session) -> None:
    """
    Ensure we're operating on the selected company DB.

    This app uses a process-global DB context; other requests can flip it back to auth DB.
    Dashboards must run against the company DB because tables live there.
    """
    company_id = getattr(session, "company_id", None)
    details = getattr(session, "company_db_details", None)
    if not company_id or not details:
        raise HTTPException(status_code=400, detail="Company context not selected. Please select a company.")

    db.switch_to_company_db(details)
    ensure_company_schema()


@router.get("", response_model=DashboardListResponse)
def list_dashboards(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    session=Depends(require_session),
):
    _ensure_company_context(session)
    return dashboard_service.list_dashboards(skip=skip, limit=limit)


@router.post("", response_model=DashboardResponse)
def create_dashboard(payload: DashboardCreate, session=Depends(require_session)):
    _ensure_company_context(session)
    created_by = session.email if getattr(session, "email", None) else None
    if payload.CreatedBy is None and created_by:
        payload.CreatedBy = created_by
    return dashboard_service.create_dashboard(payload)


@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(dashboard_id: int, session=Depends(require_session)):
    _ensure_company_context(session)
    dash = dashboard_service.get_dashboard(dashboard_id)
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dash


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(dashboard_id: int, payload: DashboardUpdate, session=Depends(require_session)):
    _ensure_company_context(session)
    updated = dashboard_service.update_dashboard(dashboard_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return updated


@router.delete("/{dashboard_id}")
def delete_dashboard(dashboard_id: int, session=Depends(require_session)) -> Dict[str, Any]:
    _ensure_company_context(session)
    deleted = dashboard_service.delete_dashboard(dashboard_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {"success": True}


@router.get("/{dashboard_id}/run")
async def run_dashboard(dashboard_id: int, session=Depends(require_session)):
    _ensure_company_context(session)
    result = await dashboard_service.run_dashboard(dashboard_id)
    if not result:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return result


