"""FastAPI endpoints for analytics execution."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import db
from app.services.analytics_service import analytics_service
from app.services.auth_service import auth_service
from app.services.preset_execution_service import preset_execution_service
from app.utils.company_schema import ensure_company_schema
from app.utils.session import require_session

router = APIRouter(prefix="/analytics", tags=["Analytics"])


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


class WidgetRequest(BaseModel):
    id: str
    type: str = Field(description="kpi | chart | table")
    config: Dict[str, Any] = Field(default_factory=dict)


class AnalyticsDataset(BaseModel):
    headerRow: Optional[Dict[str, Any]] = None
    itemsRows: List[Dict[str, Any]] = Field(default_factory=list)
    contentDetails: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    fieldsMetadata: Dict[str, Any] = Field(default_factory=dict)


class AnalyticsRunRequest(BaseModel):
    preset_id: int
    parameters: Dict[str, Any] = Field(default_factory=dict)
    company_id: Optional[int] = None
    widgetRequests: Optional[List[WidgetRequest]] = None


class AnalyticsRunResponse(BaseModel):
    dataset: AnalyticsDataset
    widgets: Optional[List[Dict[str, Any]]] = None


class MultiPresetSpec(BaseModel):
    preset_id: int
    parameters: Dict[str, Any] = Field(default_factory=dict)


class AnalyticsRunMultiRequest(BaseModel):
    presets: List[MultiPresetSpec]
    company_id: Optional[int] = None
    unionMode: Optional[str] = None


class AnalyticsRunMultiResponse(BaseModel):
    results: List[AnalyticsDataset]


class AnalyticsCompareSide(BaseModel):
    preset_id: int
    parameters: Dict[str, Any] = Field(default_factory=dict)


class AnalyticsCompareRequest(BaseModel):
    left: AnalyticsCompareSide
    right: AnalyticsCompareSide
    company_id: Optional[int] = None
    joinKeys: Optional[List[str]] = None


class AnalyticsCompareSummary(BaseModel):
    leftCount: int
    rightCount: int
    countVariance: Dict[str, Optional[float]]


class AnalyticsCompareResponse(BaseModel):
    left: AnalyticsDataset
    right: AnalyticsDataset
    summary: AnalyticsCompareSummary


@router.post("/run", response_model=AnalyticsRunResponse)
async def run_analytics(payload: AnalyticsRunRequest, session=Depends(require_session)):
    company_id = payload.company_id or session.company_id
    if company_id is None:
        raise HTTPException(status_code=400, detail="Company context not selected. Please select a company before running analytics.")

    _ensure_company_db_context(int(company_id))

    try:
        raw = await preset_execution_service.execute_preset(
            preset_id=payload.preset_id,
            parameters=payload.parameters,
            company_id=company_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    dataset = AnalyticsDataset(**raw)

    widgets: List[Dict[str, Any]] = []
    if payload.widgetRequests:
        items = dataset.itemsRows
        for w in payload.widgetRequests:
            cfg = w.config or {}
            wtype = (w.type or "").lower()
            if wtype == "kpi":
                metric = (cfg.get("metric") or "count").lower()
                field = cfg.get("field")
                func = "count" if metric == "count" else metric
                value = analytics_service.aggregate(items, field=field, func=func)  # type: ignore[arg-type]
                widgets.append({"id": w.id, "type": "kpi", "value": value, "metric": metric, "field": field})
            elif wtype == "chart":
                group_by = cfg.get("xField")
                field = cfg.get("yField")
                metric = (cfg.get("agg") or "sum").lower()
                if not group_by:
                    continue
                func = metric if metric in {"sum", "avg", "count", "min", "max"} else "sum"
                series = analytics_service.group_and_aggregate(items, group_by=group_by, field=field, func=func)  # type: ignore[arg-type]
                widgets.append({"id": w.id, "type": "chart", "series": series, "groupBy": group_by, "metric": metric, "field": field})
            elif wtype == "table":
                filters = cfg.get("filters") or []
                filtered = analytics_service.apply_filters(items, filters=filters)
                widgets.append({"id": w.id, "type": "table", "rows": filtered})

    return AnalyticsRunResponse(dataset=dataset, widgets=widgets or None)


@router.post("/run-multi", response_model=AnalyticsRunMultiResponse)
async def run_multi_analytics(payload: AnalyticsRunMultiRequest, session=Depends(require_session)):
    company_id = payload.company_id or session.company_id
    if company_id is None:
        raise HTTPException(status_code=400, detail="Company context not selected. Please select a company before running analytics.")

    _ensure_company_db_context(int(company_id))

    if not payload.presets:
        raise HTTPException(status_code=400, detail="At least one preset must be provided")

    results: List[AnalyticsDataset] = []
    for spec in payload.presets:
        try:
            raw = await preset_execution_service.execute_preset(
                preset_id=spec.preset_id,
                parameters=spec.parameters,
                company_id=company_id,
            )
            results.append(AnalyticsDataset(**raw))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return AnalyticsRunMultiResponse(results=results)


@router.post("/compare", response_model=AnalyticsCompareResponse)
async def compare_analytics(payload: AnalyticsCompareRequest, session=Depends(require_session)):
    company_id = payload.company_id or session.company_id
    if company_id is None:
        raise HTTPException(status_code=400, detail="Company context not selected. Please select a company before running analytics.")

    _ensure_company_db_context(int(company_id))

    try:
        left_raw = await preset_execution_service.execute_preset(
            preset_id=payload.left.preset_id,
            parameters=payload.left.parameters,
            company_id=company_id,
        )
        right_raw = await preset_execution_service.execute_preset(
            preset_id=payload.right.preset_id,
            parameters=payload.right.parameters,
            company_id=company_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    left_ds = AnalyticsDataset(**left_raw)
    right_ds = AnalyticsDataset(**right_raw)

    left_count = len(left_ds.itemsRows)
    right_count = len(right_ds.itemsRows)
    variance = analytics_service.compute_variance(float(left_count), float(right_count))
    summary = AnalyticsCompareSummary(leftCount=left_count, rightCount=right_count, countVariance=variance)

    return AnalyticsCompareResponse(left=left_ds, right=right_ds, summary=summary)


