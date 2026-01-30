"""
Pydantic schemas for analytics metric responses.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class MetricDataPoint(BaseModel):
    """Single data point in a metric response."""

    label: str = Field(description="Label for this data point (e.g., date, category)")
    value: float = Field(description="Numeric value for this data point")


class MetricResponse(BaseModel):
    """Normalized metric response matching SPEC-001 contract."""

    metric: str = Field(description="Name of the metric")
    unit: str = Field(description="Unit of measurement (e.g., 'currency', 'count')")
    bucket: Optional[str] = Field(
        None, description="Time bucket if applicable (e.g., 'day', 'week', 'month')"
    )
    data: List[MetricDataPoint] = Field(
        default_factory=list, description="Array of metric data points"
    )


class MetricErrorContext(BaseModel):
    """Context information for metric errors."""

    preset: Optional[str] = None
    column: Optional[str] = None
    metric: Optional[str] = None


class MetricErrorResponse(BaseModel):
    """Standardized error response for metric execution failures."""

    error_code: str = Field(description="Error code (e.g., MISSING_COLUMN, PRESET_NOT_FOUND)")
    message: str = Field(description="Human-readable error message")
    context: MetricErrorContext = Field(
        default_factory=MetricErrorContext, description="Additional error context"
    )

