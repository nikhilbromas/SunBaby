"""
Analytics service built on top of PresetExecutionService.

Responsibilities:
- Light-weight filtering utilities
- Simple aggregations (sum/avg/count/min/max)
- Group-by aggregations for charts
- Optional comparison helpers

Note: Schema/field-type inference is primarily handled by PresetExecutionService.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Literal, Optional, Sequence


AggFunc = Literal["sum", "avg", "count", "min", "max"]


@dataclass
class AggregationConfig:
    field: Optional[str]
    func: AggFunc


class AnalyticsService:
    """Utility service for computing KPI, chart, and comparison data."""

    # ------------------------------------------------------------------ #
    # Filtering
    # ------------------------------------------------------------------ #

    def apply_filters(self, rows: List[Dict[str, Any]], filters: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """
        Apply a simple declarative filter model:
        - operator: equals | in | range | contains
        """
        if not filters:
            return rows

        def row_matches(row: Dict[str, Any]) -> bool:
            for f in filters:
                field = f.get("field")
                op = (f.get("operator") or "").lower()
                value = f.get("value")
                if field is None or op == "":
                    continue
                current = row.get(field)

                if op == "equals":
                    if current != value:
                        return False
                elif op == "in":
                    if value is None:
                        return False
                    try:
                        if current not in value:
                            return False
                    except TypeError:
                        return False
                elif op == "range":
                    # Expect value = {"min": x, "max": y}
                    vmin = f.get("min")
                    vmax = f.get("max")
                    try:
                        if vmin is not None and current < vmin:
                            return False
                        if vmax is not None and current > vmax:
                            return False
                    except TypeError:
                        return False
                elif op == "contains":
                    if value is None:
                        return False
                    if current is None:
                        return False
                    if str(value) not in str(current):
                        return False
                # Unknown operators are ignored (treated as pass)
            return True

        return [row for row in rows if row_matches(row)]

    # ------------------------------------------------------------------ #
    # Aggregations
    # ------------------------------------------------------------------ #

    def aggregate(
        self,
        rows: Sequence[Dict[str, Any]],
        *,
        field: Optional[str],
        func: AggFunc,
    ) -> Optional[float]:
        """Compute a single aggregation over all rows."""
        if func == "count":
            return float(len(rows))

        if field is None:
            return None

        values: List[float] = []
        for r in rows:
            v = r.get(field)
            if v is None:
                continue
            try:
                values.append(float(v))
            except (TypeError, ValueError):
                continue

        if not values:
            return None

        if func == "sum":
            return float(sum(values))
        if func == "avg":
            return float(sum(values) / len(values))
        if func == "min":
            return float(min(values))
        if func == "max":
            return float(max(values))

        return None

    def group_and_aggregate(
        self,
        rows: Sequence[Dict[str, Any]],
        *,
        group_by: str,
        field: Optional[str],
        func: AggFunc,
    ) -> List[Dict[str, Any]]:
        """Group rows by group_by field and aggregate."""
        buckets: Dict[Any, List[Dict[str, Any]]] = {}
        for r in rows:
            key = r.get(group_by)
            buckets.setdefault(key, []).append(r)

        results: List[Dict[str, Any]] = []
        for key, bucket in buckets.items():
            value = self.aggregate(bucket, field=field, func=func)
            results.append(
                {
                    group_by: key,
                    "value": value,
                }
            )

        return results

    # ------------------------------------------------------------------ #
    # Comparison helpers
    # ------------------------------------------------------------------ #

    def compute_variance(
        self,
        left: Optional[float],
        right: Optional[float],
    ) -> Dict[str, Optional[float]]:
        """Return absolute and percent variance between two numbers."""
        if left is None or right is None:
            return {"absolute": None, "percent": None}
        absolute = right - left
        if left == 0:
            percent: Optional[float] = None
        else:
            percent = (absolute / left) * 100.0
        return {"absolute": absolute, "percent": percent}


analytics_service = AnalyticsService()


