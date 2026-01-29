"""
Pydantic models for analytics dashboards & widgets.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DashboardWidgetConfig(BaseModel):
    """
    Generic widget configuration.

    Kept flexible: frontend owns exact shape.
    """

    chartType: Optional[str] = None
    datasetRef: Optional[str] = None
    xField: Optional[str] = None
    yField: Optional[str] = None
    seriesField: Optional[str] = None
    agg: Optional[str] = None
    sort: Optional[str] = None
    limit: Optional[int] = None
    filters: Optional[List[Dict[str, Any]]] = None
    metric: Optional[str] = None
    field: Optional[str] = None
    columns: Optional[List[str]] = None
    pageSize: Optional[int] = None


class DashboardPresetBinding(BaseModel):
    presetId: int = Field(..., description="ReportSqlPresets.PresetId")
    parameters: Dict[str, Any] = Field(default_factory=dict)


class DashboardWidgetBase(BaseModel):
    Title: str
    Type: str = Field(..., description="kpi | chart | table")
    Config: DashboardWidgetConfig
    PresetBinding: DashboardPresetBinding
    OrderIndex: int = 0


class DashboardWidgetCreate(DashboardWidgetBase):
    pass


class DashboardWidgetResponse(DashboardWidgetBase):
    WidgetId: int
    DashboardId: int
    CreatedOn: datetime
    UpdatedOn: Optional[datetime] = None
    IsActive: bool = True

    model_config = {"from_attributes": True}


class DashboardCreate(BaseModel):
    Name: str
    Description: Optional[str] = None
    CreatedBy: Optional[str] = None
    Widgets: List[DashboardWidgetCreate] = Field(default_factory=list)


class DashboardUpdate(BaseModel):
    Name: Optional[str] = None
    Description: Optional[str] = None
    Widgets: Optional[List[DashboardWidgetCreate]] = None


class DashboardResponse(BaseModel):
    DashboardId: int
    Name: str
    Description: Optional[str] = None
    CreatedBy: Optional[str] = None
    CreatedOn: datetime
    UpdatedOn: Optional[datetime] = None
    IsActive: bool
    Widgets: List[DashboardWidgetResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class DashboardListItem(BaseModel):
    DashboardId: int
    Name: str
    Description: Optional[str] = None
    CreatedBy: Optional[str] = None
    CreatedOn: datetime
    UpdatedOn: Optional[datetime] = None
    IsActive: bool

    model_config = {"from_attributes": True}


class DashboardListResponse(BaseModel):
    dashboards: List[DashboardListItem]
    total: int


