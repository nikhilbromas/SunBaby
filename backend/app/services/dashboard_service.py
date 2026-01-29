"""
Service for managing analytics dashboards.
"""

from __future__ import annotations

from typing import List, Optional

from app.database import db
from app.models.dashboard import (
    DashboardCreate,
    DashboardUpdate,
    DashboardResponse,
    DashboardListItem,
    DashboardListResponse,
    DashboardWidgetCreate,
    DashboardWidgetResponse,
)
from app.services.preset_execution_service import preset_execution_service
from app.services.analytics_service import analytics_service
from app.services.data_analytics_preset_execution_service import (
    data_analytics_preset_execution_service,
)
import json


class DashboardService:
    """Service for dashboard CRUD and execution."""

    # ------------------------------------------------------------------ #
    # CRUD
    # ------------------------------------------------------------------ #

    def list_dashboards(self, skip: int = 0, limit: int = 100) -> DashboardListResponse:
        count_q = "SELECT COUNT(*) AS Total FROM dbo.ReportDashboards WHERE IsActive = 1"
        list_q = """
            SELECT DashboardId, Name, Description, CreatedBy, CreatedOn, UpdatedOn, IsActive
            FROM dbo.ReportDashboards
            WHERE IsActive = 1
            ORDER BY CreatedOn DESC
            OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
        """

        with db.get_connection() as conn:
            cur = conn.cursor()
            try:
                cur.execute(count_q)
                total_row = cur.fetchone()
                total = int(total_row[0]) if total_row else 0

                cur.execute(
                    list_q.replace("@skip", "?").replace("@limit", "?"),
                    (skip, limit),
                )
                rows = cur.fetchall()
            finally:
                cur.close()

        dashboards = [
            DashboardListItem(
                DashboardId=row[0],
                Name=row[1],
                Description=row[2],
                CreatedBy=row[3],
                CreatedOn=row[4],
                UpdatedOn=row[5],
                IsActive=bool(row[6]),
            )
            for row in rows
        ]

        return DashboardListResponse(dashboards=dashboards, total=total)

    def _insert_widget(self, conn, dashboard_id: int, w: DashboardWidgetCreate) -> DashboardWidgetResponse:
        insert_q = """
            INSERT INTO dbo.ReportDashboardWidgets
                (DashboardId, Title, Type, ConfigJson, PresetBindingsJson, OrderIndex)
            OUTPUT INSERTED.WidgetId, INSERTED.DashboardId, INSERTED.Title, INSERTED.Type,
                   INSERTED.ConfigJson, INSERTED.PresetBindingsJson,
                   INSERTED.OrderIndex, INSERTED.CreatedOn, INSERTED.UpdatedOn, INSERTED.IsActive
            VALUES (?, ?, ?, ?, ?, ?)
        """
        cfg_json = json.dumps(w.Config.model_dump(exclude_none=True))
        binding_json = json.dumps(w.PresetBinding.model_dump(exclude_none=True))

        cur = conn.cursor()
        try:
            cur.execute(
                insert_q,
                (
                    dashboard_id,
                    w.Title,
                    w.Type,
                    cfg_json,
                    binding_json,
                    w.OrderIndex,
                ),
            )
            row = cur.fetchone()
        finally:
            cur.close()

        return DashboardWidgetResponse(
            WidgetId=row[0],
            DashboardId=row[1],
            Title=row[2],
            Type=row[3],
            Config=json.loads(row[4] or "{}"),
            PresetBinding=json.loads(row[5] or "{}"),
            OrderIndex=row[6],
            CreatedOn=row[7],
            UpdatedOn=row[8],
            IsActive=bool(row[9]),
        )

    def create_dashboard(self, payload: DashboardCreate) -> DashboardResponse:
        insert_q = """
            INSERT INTO dbo.ReportDashboards (Name, Description, CreatedBy)
            OUTPUT INSERTED.DashboardId, INSERTED.Name, INSERTED.Description,
                   INSERTED.CreatedBy, INSERTED.CreatedOn, INSERTED.UpdatedOn, INSERTED.IsActive
            VALUES (?, ?, ?)
        """

        with db.get_connection() as conn:
            cur = conn.cursor()
            try:
                cur.execute(
                    insert_q,
                    (
                        payload.Name,
                        payload.Description,
                        payload.CreatedBy,
                    ),
                )
                row = cur.fetchone()
                dashboard_id = int(row[0])

                widgets: List[DashboardWidgetResponse] = []
                for w in payload.Widgets or []:
                    widgets.append(self._insert_widget(conn, dashboard_id, w))

                conn.commit()
            finally:
                cur.close()

        return DashboardResponse(
            DashboardId=dashboard_id,
            Name=row[1],
            Description=row[2],
            CreatedBy=row[3],
            CreatedOn=row[4],
            UpdatedOn=row[5],
            IsActive=bool(row[6]),
            Widgets=widgets,
        )

    def _load_dashboard_core(self, dashboard_id: int) -> Optional[DashboardResponse]:
        dash_q = """
            SELECT DashboardId, Name, Description, CreatedBy, CreatedOn, UpdatedOn, IsActive
            FROM dbo.ReportDashboards
            WHERE DashboardId = @id AND IsActive = 1
        """
        widgets_q = """
            SELECT WidgetId, DashboardId, Title, Type, ConfigJson, PresetBindingsJson,
                   OrderIndex, CreatedOn, UpdatedOn, IsActive
            FROM dbo.ReportDashboardWidgets
            WHERE DashboardId = @id AND IsActive = 1
            ORDER BY OrderIndex ASC, WidgetId ASC
        """

        with db.get_connection() as conn:
            cur = conn.cursor()
            try:
                cur.execute(dash_q.replace("@id", "?"), (dashboard_id,))
                header = cur.fetchone()
                if not header:
                    return None

                cur.execute(widgets_q.replace("@id", "?"), (dashboard_id,))
                widget_rows = cur.fetchall()
            finally:
                cur.close()

        widgets = [
            DashboardWidgetResponse(
                WidgetId=w[0],
                DashboardId=w[1],
                Title=w[2],
                Type=w[3],
                Config=json.loads(w[4] or "{}"),
                PresetBinding=json.loads(w[5] or "{}"),
                OrderIndex=w[6],
                CreatedOn=w[7],
                UpdatedOn=w[8],
                IsActive=bool(w[9]),
            )
            for w in widget_rows
        ]

        return DashboardResponse(
            DashboardId=header[0],
            Name=header[1],
            Description=header[2],
            CreatedBy=header[3],
            CreatedOn=header[4],
            UpdatedOn=header[5],
            IsActive=bool(header[6]),
            Widgets=widgets,
        )

    def get_dashboard(self, dashboard_id: int) -> Optional[DashboardResponse]:
        return self._load_dashboard_core(dashboard_id)

    def update_dashboard(self, dashboard_id: int, payload: DashboardUpdate) -> Optional[DashboardResponse]:
        # First update dashboard header
        updates = []
        params = []
        if payload.Name is not None:
            updates.append("Name = ?")
            params.append(payload.Name)
        if payload.Description is not None:
            updates.append("Description = ?")
            params.append(payload.Description)
        if updates:
            updates.append("UpdatedOn = GETDATE()")
            params.append(dashboard_id)
            update_q = f"""
                UPDATE dbo.ReportDashboards
                SET {', '.join(updates)}
                WHERE DashboardId = ?
                  AND IsActive = 1
            """
            with db.get_connection() as conn:
                cur = conn.cursor()
                try:
                    cur.execute(update_q, params)
                    conn.commit()
                finally:
                    cur.close()

        # Replace widgets if provided
        if payload.Widgets is not None:
            with db.get_connection() as conn:
                cur = conn.cursor()
                try:
                    # Soft-delete existing widgets
                    cur.execute(
                        """
                        UPDATE dbo.ReportDashboardWidgets
                        SET IsActive = 0, UpdatedOn = GETDATE()
                        WHERE DashboardId = ?
                          AND IsActive = 1
                        """,
                        (dashboard_id,),
                    )
                    # Insert new set
                    for w in payload.Widgets:
                        self._insert_widget(conn, dashboard_id, w)
                    conn.commit()
                finally:
                    cur.close()

        return self._load_dashboard_core(dashboard_id)

    def delete_dashboard(self, dashboard_id: int) -> bool:
        delete_q = """
            UPDATE dbo.ReportDashboards
            SET IsActive = 0, UpdatedOn = GETDATE()
            WHERE DashboardId = ?
              AND IsActive = 1
        """
        with db.get_connection() as conn:
            cur = conn.cursor()
            try:
                cur.execute(delete_q, (dashboard_id,))
                conn.commit()
                return cur.rowcount > 0
            finally:
                cur.close()

    # ------------------------------------------------------------------ #
    # Runner
    # ------------------------------------------------------------------ #

    async def run_dashboard(self, dashboard_id: int):
        """
        Execute all widgets for a dashboard by calling PresetExecutionService.

        v1 behavior:
        - looks for PresetBinding = { "presetId": int, "parameters": {..} }
        - ignores more advanced/multi/compare binding shapes for now
        """
        dashboard = self._load_dashboard_core(dashboard_id)
        if not dashboard:
            return None

        widget_results = {}
        for w in dashboard.Widgets:
            try:
                binding = w.PresetBinding
                preset_id = getattr(binding, "presetId", None)
                if not preset_id:
                    continue
                params = getattr(binding, "parameters", {}) or {}
                result = await preset_execution_service.execute_preset(
                    preset_id=preset_id,
                    parameters=params,
                    company_id=None,
                )

                # Build analytics-friendly dataset (object/array shaping, insights, references)
                analytics_dataset = data_analytics_preset_execution_service.build_dataset_from_raw(result)

                # Compute widget output based on type + config
                wtype = (w.Type or "").lower()
                cfg = w.Config
                header_row = result.get("headerRow") or None
                items_rows = result.get("itemsRows", []) or []

                # Optional filtering
                filters = getattr(cfg, "filters", None)
                filtered_items = analytics_service.apply_filters(items_rows, filters=filters)

                output = None
                if wtype == "kpi":
                    metric = (getattr(cfg, "metric", None) or "count").lower()
                    field = getattr(cfg, "field", None)
                    func = "count" if metric == "count" else metric
                    value = analytics_service.aggregate(filtered_items, field=field, func=func)  # type: ignore[arg-type]

                    # If KPI isn't configured and items-based aggregate is empty, fall back to header totals.
                    if (field is None or value is None) and header_row:
                        for k in ("Amount", "TotalAmount", "NetAmount", "GrandTotal", "Total"):
                            if header_row.get(k) is not None:
                                value = header_row.get(k)
                                metric = "value"
                                field = k
                                break
                    output = {"value": value, "metric": metric, "field": field}
                elif wtype == "chart":
                    group_by = getattr(cfg, "xField", None)
                    y_field = getattr(cfg, "yField", None)
                    agg = (getattr(cfg, "agg", None) or "sum").lower()
                    limit = getattr(cfg, "limit", None)
                    if group_by:
                        func = agg if agg in {"sum", "avg", "count", "min", "max"} else "sum"
                        series = analytics_service.group_and_aggregate(
                            filtered_items,
                            group_by=group_by,
                            field=y_field,
                            func=func,  # type: ignore[arg-type]
                        )
                        if isinstance(limit, int) and limit > 0:
                            series = series[:limit]
                        output = {
                            "series": series,
                            "groupBy": group_by,
                            "metric": agg,
                            "field": y_field,
                        }
                else:
                    # table (default)
                    columns = getattr(cfg, "columns", None)
                    page_size = getattr(cfg, "pageSize", None)
                    rows = filtered_items
                    if isinstance(page_size, int) and page_size > 0:
                        rows = rows[:page_size]
                    if columns and isinstance(columns, list) and len(columns) > 0:
                        rows = [{c: r.get(c) for c in columns} for r in rows]
                    output = {"rows": rows, "columns": columns}

                widget_results[str(w.WidgetId)] = {
                    "widgetId": w.WidgetId,
                    "dashboardId": w.DashboardId,
                    "title": w.Title,
                    "type": w.Type,
                    "config": w.Config.model_dump(exclude_none=True),
                    "presetBinding": binding.model_dump(exclude_none=True),
                    "dataset": result,
                    "analyticsDataset": analytics_dataset,
                    "output": output,
                }
            except Exception as exc:  # noqa: BLE001
                pass

        return {
            "dashboard": dashboard,
            "widgets": widget_results,
        }


dashboard_service = DashboardService()


