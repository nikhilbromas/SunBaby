"""
Data-analytics oriented wrapper around PresetExecutionService.

Goals:
- Reuse `PresetExecutionService` to execute SQL presets.
- Shape results so that:
  - single-row datasets are exposed as objects
  - 0 or multi-row datasets are exposed as arrays
- Provide lightweight `shape`, `references`, and `insights` blocks
  that are easy to consume from dashboards / analytics UI.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.services.analytics_service import analytics_service
from app.services.preset_execution_service import preset_execution_service


class DataAnalyticsPresetExecutionService:
    """High-level analytics helper for presets."""

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def execute_preset_analytics(
        self,
        *,
        preset_id: int,
        parameters: Dict[str, Any],
        company_id: Optional[int] = None,
        filters: Optional[List[Dict[str, Any]]] = None,
        widget_requests: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a preset and return an analytics-friendly dataset plus widgets.

        Returns:
            {
                "dataset": {
                    "data": {...},
                    "fieldsMetadata": {...},
                    "shape": {...},
                    "references": {...},
                    "insights": [...],
                },
                "widgets": [
                    { "id": str, "type": "kpi|chart|table", ... },
                    ...
                ],
            }
        """
        raw = await preset_execution_service.execute_preset(
            preset_id=preset_id,
            parameters=parameters,
            company_id=company_id,
        )

        header_row = raw.get("headerRow") or None
        items_rows: List[Dict[str, Any]] = raw.get("itemsRows") or []
        content_details: Dict[str, List[Dict[str, Any]]] = raw.get("contentDetails") or {}
        fields_metadata: Dict[str, Any] = raw.get("fieldsMetadata") or {}

        # Apply optional filters on items (other datasets stay untouched for now).
        filtered_items = analytics_service.apply_filters(items_rows, filters=filters)

        dataset = self._build_analytics_dataset(
            header_row=header_row,
            items_rows=filtered_items,
            content_details_rows=content_details,
            fields_metadata=fields_metadata,
        )

        widgets: List[Dict[str, Any]] = []
        if widget_requests:
            widgets = self._build_widgets_from_requests(
                widget_requests=widget_requests,
                items_rows=filtered_items,
                header_row=header_row,
            )

        return {
            "dataset": dataset,
            "widgets": widgets,
        }

    def build_dataset_from_raw(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convenience helper for callers that already executed the preset.

        Args:
            raw: Result from `PresetExecutionService.execute_preset`.
        """
        header_row = raw.get("headerRow") or None
        items_rows: List[Dict[str, Any]] = raw.get("itemsRows") or []
        content_details: Dict[str, List[Dict[str, Any]]] = raw.get("contentDetails") or {}
        fields_metadata: Dict[str, Any] = raw.get("fieldsMetadata") or {}

        return self._build_analytics_dataset(
            header_row=header_row,
            items_rows=items_rows,
            content_details_rows=content_details,
            fields_metadata=fields_metadata,
        )

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _shape_rows(self, rows: List[Dict[str, Any]]) -> Tuple[Any, str]:
        """
        Apply object/array semantics:
        - 0 rows -> [] (array), shape="array"
        - 1 row  -> row (object), shape="object"
        - N>1    -> rows (array), shape="array"
        """
        if not rows:
            return [], "array"
        if len(rows) == 1:
            return rows[0], "object"
        return rows, "array"

    def _build_references(self, header_row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Try to extract human-friendly reference fields from the header.
        This is heuristic and safe to run on any preset.
        """
        if not header_row:
            return {}

        def pick_first(keys: List[str]) -> Any:
            for k in keys:
                if k in header_row and header_row[k] not in (None, ""):
                    return header_row[k]
            return None

        bill_id = pick_first(["BillId", "BillID", "BillNo", "poshBillID", "posoBillID"])
        doc_no = pick_first(["DocumentNo", "DocNo", "VoucherNo"])
        created_at = pick_first(["CreatedAt", "CreatedOn", "CreatedDate"])
        table_name = pick_first(["TableName", "Table"])
        order_type = pick_first(["OrderType"])
        order_status = pick_first(["OrderStatus", "Status"])

        references: Dict[str, Any] = {}
        if bill_id is not None:
            references["billId"] = bill_id
        if doc_no is not None:
            references["documentNo"] = doc_no
        if created_at is not None:
            references["createdAt"] = created_at
        if table_name is not None:
            references["tableName"] = table_name
        if order_type is not None:
            references["orderType"] = order_type
        if order_status is not None:
            references["orderStatus"] = order_status

        return references

    def _basic_numeric_summary(
        self,
        header_row: Optional[Dict[str, Any]],
        items_rows: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Compute some very lightweight numeric summaries."""
        summary: Dict[str, Any] = {
            "itemsCount": len(items_rows),
        }

        # Try to derive a main amount from header first, then from items.
        header_amount_keys = [
            "Amount",
            "TotalAmount",
            "NetAmount",
            "GrandTotal",
            "Total",
        ]
        header_amount = None
        if header_row:
            for k in header_amount_keys:
                v = header_row.get(k)
                if v is None:
                    continue
                try:
                    header_amount = float(v)
                    break
                except (TypeError, ValueError):
                    continue

        if header_amount is not None:
            summary["headerAmount"] = header_amount

        # Fallback: sum NetAmount from items if available.
        try:
            net_total = analytics_service.aggregate(
                items_rows,
                field="NetAmount",
                func="sum",  # type: ignore[arg-type]
            )
        except Exception:  # noqa: BLE001
            net_total = None
        if net_total is not None:
            summary["itemsNetTotal"] = net_total

        return summary

    def _detect_basic_anomalies(
        self,
        header_row: Optional[Dict[str, Any]],
        items_rows: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Very generic anomaly checks that work for many presets:
        - Duplicate item rows (by full row content)
        - Suspicious datetime values with time-part when often only dates are expected
        """
        insights: List[Dict[str, Any]] = []

        # Duplicate row detection by full row content hash.
        seen = set()
        dup_count = 0
        for r in items_rows:
            key = tuple(sorted(r.items()))
            if key in seen:
                dup_count += 1
            else:
                seen.add(key)
        if dup_count > 0:
            insights.append(
                {
                    "id": "duplicate_items",
                    "type": "anomaly",
                    "severity": "warning",
                    "message": f"Detected {dup_count} possible duplicate item row(s).",
                    "stats": {"duplicateCount": dup_count, "totalItems": len(items_rows)},
                }
            )

        # Date/time format check on header: look for values containing 'T' or time components.
        if header_row:
            for k, v in header_row.items():
                if not isinstance(v, str):
                    continue
                if "T" in v or (" " in v and ":" in v):
                    insights.append(
                        {
                            "id": f"datetime_format_{k}",
                            "type": "anomaly",
                            "severity": "info",
                            "message": f"Field '{k}' contains a time component (value '{v}'). "
                            "If only dates are expected, consider normalising format.",
                            "field": k,
                            "value": v,
                        }
                    )
                    break

        return insights

    def _build_analytics_dataset(
        self,
        *,
        header_row: Optional[Dict[str, Any]],
        items_rows: List[Dict[str, Any]],
        content_details_rows: Dict[str, List[Dict[str, Any]]],
        fields_metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Aggregate shaped data + metadata + insights."""
        shaped_items, items_shape = self._shape_rows(items_rows)

        shaped_content: Dict[str, Any] = {}
        content_shape: Dict[str, str] = {}
        for name, rows in content_details_rows.items():
            shaped, shape_kind = self._shape_rows(rows or [])
            shaped_content[name] = shaped
            content_shape[name] = shape_kind

        # Header is already an object (or None) from PresetExecutionService.
        header_shape = "object" if header_row is not None else "none"

        shape_meta = {
            "header": header_shape,
            "items": items_shape,
            "contentDetails": content_shape,
        }

        references = self._build_references(header_row)
        basic_summary = self._basic_numeric_summary(header_row, items_rows)
        anomalies = self._detect_basic_anomalies(header_row, items_rows)

        insights: List[Dict[str, Any]] = []
        if basic_summary:
            insights.append(
                {
                    "id": "basic_summary",
                    "type": "summary",
                    "severity": "info",
                    "message": "Basic numeric summary for this preset.",
                    "stats": basic_summary,
                }
            )
        insights.extend(anomalies)

        return {
            "data": {
                "header": header_row,
                "items": shaped_items,
                "contentDetails": shaped_content,
            },
            "fieldsMetadata": fields_metadata,
            "shape": shape_meta,
            "references": references,
            "insights": insights,
        }

    def _build_widgets_from_requests(
        self,
        *,
        widget_requests: List[Dict[str, Any]],
        items_rows: List[Dict[str, Any]],
        header_row: Optional[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Build simple KPI / chart / table widgets from a common config model."""
        widgets: List[Dict[str, Any]] = []
        for w in widget_requests:
            wid = str(w.get("id") or "")
            wtype = str(w.get("type") or "").lower()
            cfg = w.get("config") or {}

            if wtype == "kpi":
                metric = str(cfg.get("metric") or "count").lower()
                field = cfg.get("field")
                func = "count" if metric == "count" else metric
                value = analytics_service.aggregate(
                    items_rows,
                    field=field,
                    func=func,  # type: ignore[arg-type]
                )
                # Fallback to header totals if items-based aggregate is empty.
                if (field is None or value is None) and header_row:
                    for k in ("Amount", "TotalAmount", "NetAmount", "GrandTotal", "Total"):
                        if header_row.get(k) is not None:
                            value = header_row.get(k)
                            metric = "value"
                            field = k
                            break
                widgets.append(
                    {
                        "id": wid,
                        "type": "kpi",
                        "value": value,
                        "metric": metric,
                        "field": field,
                    }
                )
            elif wtype == "chart":
                group_by = cfg.get("xField")
                field = cfg.get("yField")
                metric = str(cfg.get("agg") or "sum").lower()
                if not group_by:
                    continue
                func = metric if metric in {"sum", "avg", "count", "min", "max"} else "sum"
                series = analytics_service.group_and_aggregate(
                    items_rows,
                    group_by=group_by,
                    field=field,
                    func=func,  # type: ignore[arg-type]
                )
                limit = cfg.get("limit")
                if isinstance(limit, int) and limit > 0:
                    series = series[:limit]
                widgets.append(
                    {
                        "id": wid,
                        "type": "chart",
                        "series": series,
                        "groupBy": group_by,
                        "metric": metric,
                        "field": field,
                    }
                )
            else:
                # table (default)
                filters = cfg.get("filters") or []
                filtered = analytics_service.apply_filters(items_rows, filters=filters)
                columns = cfg.get("columns")
                page_size = cfg.get("pageSize")
                rows = filtered
                if isinstance(page_size, int) and page_size > 0:
                    rows = rows[:page_size]
                if columns and isinstance(columns, list) and len(columns) > 0:
                    rows = [{c: r.get(c) for c in columns} for r in rows]
                widgets.append(
                    {
                        "id": wid,
                        "type": "table",
                        "rows": rows,
                        "columns": columns,
                    }
                )

        return widgets


data_analytics_preset_execution_service = DataAnalyticsPresetExecutionService()



