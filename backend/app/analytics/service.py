"""
Analytics service for metric execution, aggregation, and normalization.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.analytics.metrics import Metric, get_metric
from app.analytics.schemas import MetricDataPoint, MetricResponse
from app.config import settings
from app.services.preset_execution_service import preset_execution_service
from app.utils.cache import make_cache_key, query_cache
from app.utils.reference_extractor import MissingColumnError, extract_column

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for executing and aggregating analytics metrics."""

    async def execute_metric(
        self,
        metric_name: str,
        parameters: Optional[Dict[str, Any]] = None,
        company_id: Optional[int] = None,
    ) -> MetricResponse:
        """
        Execute a metric and return normalized response.

        Args:
            metric_name: Name of the metric to execute
            parameters: Optional parameters for the preset
            company_id: Optional company ID for cache scoping

        Returns:
            Normalized metric response

        Raises:
            ValueError: If metric not found or execution fails
        """
        parameters = parameters or {}

        # Check cache first
        cache_key = make_cache_key(
            "analytics_metric",
            metric_name,
            company_id=company_id,
            **parameters,
        )
        cached = query_cache.get(cache_key)
        if cached is not None:
            return MetricResponse(**cached)

        # Lookup metric
        metric = get_metric(metric_name)
        if not metric:
            raise ValueError(f"Metric '{metric_name}' not found in registry")

        # Execute preset
        try:
            result = await preset_execution_service.execute_preset(
                preset_id=metric.preset_id,
                parameters=parameters,
                company_id=company_id,
            )
        except Exception as e:
            logger.error(f"Failed to execute preset {metric.preset_id} for metric {metric_name}: {e}")
            raise ValueError(f"Failed to execute metric preset: {e}") from e

        # Extract items rows
        items_rows = result.get("itemsRows", [])
        if not items_rows:
            # Return empty response
            response = MetricResponse(
                metric=metric_name,
                unit=metric.unit,
                bucket=metric.time_bucket,
                data=[],
            )
            # Cache empty result for shorter TTL
            query_cache.set(cache_key, response.model_dump(), ttl=60)
            return response

        # Aggregate data
        aggregated_data = self._aggregate_data(items_rows, metric)

        # Apply time bucketing if specified
        if metric.time_bucket and metric.group_by:
            aggregated_data = self._group_by_time_bucket(aggregated_data, metric.time_bucket)

        # Normalize response
        response = self._normalize_response(metric, aggregated_data)

        # Cache result
        cache_ttl = getattr(settings, "ANALYTICS_CACHE_TTL", 120)
        query_cache.set(cache_key, response.model_dump(), ttl=cache_ttl)

        return response

    def _aggregate_data(self, rows: List[Dict[str, Any]], metric: Metric) -> List[Dict[str, Any]]:
        """
        Apply aggregation logic to rows based on metric definition.

        Args:
            rows: List of row dictionaries from preset execution
            metric: Metric definition

        Returns:
            List of aggregated data points
        """
        try:
            # Extract value column
            values = extract_column(rows, metric.value_field)
        except MissingColumnError as e:
            raise ValueError(f"Metric '{metric.name}' requires column '{metric.value_field}': {e}") from e

        # If no group_by, aggregate all rows into single value
        if not metric.group_by:
            aggregated_value = self._apply_aggregation(values, metric.aggregation)
            return [{"label": "total", "value": aggregated_value}]

        # Group by specified field
        try:
            group_values = extract_column(rows, metric.group_by)
        except MissingColumnError as e:
            raise ValueError(f"Metric '{metric.name}' requires group_by column '{metric.group_by}': {e}") from e

        # Group rows by group_by value
        groups: Dict[Any, List[float]] = {}
        for idx, group_key in enumerate(group_values):
            if group_key not in groups:
                groups[group_key] = []
            if values[idx] is not None:
                try:
                    groups[group_key].append(float(values[idx]))
                except (TypeError, ValueError):
                    pass  # Skip non-numeric values

        # Aggregate each group
        result = []
        for group_key, group_values_list in groups.items():
            aggregated_value = self._apply_aggregation(group_values_list, metric.aggregation)
            result.append({"label": str(group_key), "value": aggregated_value})

        # Sort by label for consistency
        result.sort(key=lambda x: x["label"])

        return result

    def _apply_aggregation(self, values: List[Any], aggregation: str) -> float:
        """
        Apply aggregation function to a list of values.

        Args:
            values: List of numeric values
            aggregation: Aggregation type (SUM, COUNT, AVG, MIN, MAX)

        Returns:
            Aggregated value
        """
        # Filter out None values and convert to float
        numeric_values = []
        for v in values:
            if v is None:
                continue
            try:
                numeric_values.append(float(v))
            except (TypeError, ValueError):
                continue

        if not numeric_values:
            return 0.0

        if aggregation == "SUM":
            return sum(numeric_values)
        elif aggregation == "COUNT":
            return float(len(numeric_values))
        elif aggregation == "AVG":
            return sum(numeric_values) / len(numeric_values)
        elif aggregation == "MIN":
            return min(numeric_values)
        elif aggregation == "MAX":
            return max(numeric_values)
        else:
            return 0.0

    def _group_by_time_bucket(
        self, data: List[Dict[str, Any]], bucket: str
    ) -> List[Dict[str, Any]]:
        """
        Group data points by time bucket (day/week/month).

        Args:
            data: List of data points with label (date string)
            bucket: Time bucket type (day, week, month)

        Returns:
            Grouped data points
        """
        # For now, return data as-is
        # Time bucketing logic can be enhanced later to parse dates and group them
        # This is a placeholder for future enhancement
        return data

    def _normalize_response(
        self, metric: Metric, data: List[Dict[str, Any]]
    ) -> MetricResponse:
        """
        Format aggregated data into normalized MetricResponse.

        Args:
            metric: Metric definition
            data: Aggregated data points

        Returns:
            Normalized metric response
        """
        data_points = [
            MetricDataPoint(label=item["label"], value=item["value"]) for item in data
        ]

        return MetricResponse(
            metric=metric.name,
            unit=metric.unit,
            bucket=metric.time_bucket,
            data=data_points,
        )


# Global analytics service instance
analytics_service = AnalyticsService()

