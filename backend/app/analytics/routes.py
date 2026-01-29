"""
FastAPI routes for analytics metrics API.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.analytics.schemas import MetricErrorContext, MetricErrorResponse, MetricResponse
from app.analytics.service import analytics_service
from app.database import db
from app.services.auth_service import auth_service
from app.utils.company_schema import ensure_company_schema
from app.utils.session import require_session

router = APIRouter(prefix="/analytics/metrics", tags=["Analytics Metrics"])


def _ensure_company_db_context(company_id: int) -> None:
    """
    Ensure the global db context is switched to the requested company DB.

    This app uses a process-global DB context (auth vs company). Other endpoints can
    flip it back to auth DB. Analytics must defensively re-select the company DB
    before touching company tables (ReportSqlPresets, etc.).
    """
    try:
        if getattr(db, "_current_db_context", None) == "company":
            exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportSqlPresets','U')") is not None
            if exists:
                return
    except Exception:
        pass

    details = auth_service.get_company_details(company_id)
    if not details:
        raise HTTPException(status_code=404, detail="Company not found")

    db.switch_to_company_db(details)
    ensure_company_schema()


@router.get("/{metric_name}", response_model=MetricResponse)
async def get_metric(
    metric_name: str,
    parameters: Optional[str] = Query(None, description="JSON string of parameters"),
    company_id: Optional[int] = Query(None, description="Company ID"),
    session=Depends(require_session),
):
    """
    Get a metric by name.

    Returns normalized metric data with aggregation and grouping applied.
    """
    # Determine company context
    resolved_company_id = company_id or (session.company_id if hasattr(session, "company_id") else None)
    if resolved_company_id is None:
        raise HTTPException(
            status_code=400,
            detail="Company context not selected. Please select a company before running analytics.",
        )

    _ensure_company_db_context(int(resolved_company_id))

    # Parse parameters
    parsed_parameters: Dict[str, Any] = {}
    if parameters:
        try:
            parsed_parameters = json.loads(parameters)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid parameters JSON")

    try:
        response = await analytics_service.execute_metric(
            metric_name=metric_name,
            parameters=parsed_parameters,
            company_id=resolved_company_id,
        )
        return response
    except ValueError as e:
        error_msg = str(e)
        error_code = "EXECUTION_FAILED"
        context = MetricErrorContext(metric=metric_name)

        # Determine specific error code
        if "not found in registry" in error_msg:
            error_code = "PRESET_NOT_FOUND"
        elif "requires column" in error_msg or "MissingColumnError" in error_msg:
            error_code = "MISSING_COLUMN"
            # Try to extract column name from error
            if "column '" in error_msg:
                try:
                    col_start = error_msg.index("column '") + 8
                    col_end = error_msg.index("'", col_start)
                    context.column = error_msg[col_start:col_end]
                except ValueError:
                    pass
        elif "no rows" in error_msg.lower() or "empty" in error_msg.lower():
            error_code = "EMPTY_RESULT"

        error_response = MetricErrorResponse(
            error_code=error_code,
            message=error_msg,
            context=context,
        )
        raise HTTPException(status_code=400, detail=error_response.model_dump())

