"""
Static metric registry for analytics.

Metrics are defined statically in code (not in database) for safety and performance.
Each metric maps to a SQL preset and defines how to aggregate and group the results.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Literal, Optional


@dataclass
class Metric:
    """Definition of an analytics metric."""

    name: str
    preset_id: int
    aggregation: Literal["SUM", "COUNT", "AVG", "MIN", "MAX"]
    value_field: str
    group_by: Optional[str] = None
    time_bucket: Optional[Literal["day", "week", "month"]] = None
    unit: str = "count"


# Static metric registry
# Initially empty - metrics will be added manually during implementation
METRICS: Dict[str, Metric] = {}


# ============================================================================
# Metric Definitions
# ============================================================================
# 
# IMPORTANT: Update preset_id values to match actual presets in your database.
# You can find preset IDs by querying: SELECT PresetId, PresetName FROM ReportSqlPresets WHERE IsActive = 1
#
# Metric naming convention:
# - Use snake_case for metric names
# - Be descriptive: daily_sales, monthly_revenue, item_count_by_category
#
# Field requirements:
# - value_field: Column name from the preset's itemQuery that contains the numeric value to aggregate
# - group_by: Optional column name to group results (e.g., date, category, status)
# - time_bucket: Optional time grouping (day/week/month) - requires group_by to be a date field
# ============================================================================


def register_default_metrics() -> None:
    """
    Register default metrics.
    
    NOTE: Update preset_id values to match your actual presets before using.
    This function should be called during application startup.
    """
    # Example: Daily Sales Metric
    # Assumes a preset that returns sales data with columns: sale_date, total_amount
    # Uncomment and update preset_id when you have a matching preset:
    #
    # register_metric(Metric(
    #     name="daily_sales",
    #     preset_id=1,  # UPDATE: Replace with actual preset ID
    #     aggregation="SUM",
    #     value_field="total_amount",
    #     group_by="sale_date",
    #     time_bucket="day",
    #     unit="currency"
    # ))
    
    # Example: Item Count Metric
    # Assumes a preset that returns items with a count or quantity field
    #
    # register_metric(Metric(
    #     name="item_count",
    #     preset_id=2,  # UPDATE: Replace with actual preset ID
    #     aggregation="COUNT",
    #     value_field="ItemId",  # Any column works for COUNT
    #     group_by=None,
    #     time_bucket=None,
    #     unit="count"
    # ))
    
    # Example: Average Order Value
    # Assumes a preset that returns orders with amount field
    #
    # register_metric(Metric(
    #     name="avg_order_value",
    #     preset_id=3,  # UPDATE: Replace with actual preset ID
    #     aggregation="AVG",
    #     value_field="Amount",
    #     group_by=None,
    #     time_bucket=None,
    #     unit="currency"
    # ))
    
    # Example: Sales by Category
    # Assumes a preset that returns sales with category and amount
    #
    # register_metric(Metric(
    #     name="sales_by_category",
    #     preset_id=4,  # UPDATE: Replace with actual preset ID
    #     aggregation="SUM",
    #     value_field="Amount",
    #     group_by="Category",
    #     time_bucket=None,
    #     unit="currency"
    # ))
    
    # Example: Monthly Revenue
    # Assumes a preset that returns revenue data with date and amount
    #
    # register_metric(Metric(
    #     name="monthly_revenue",
    #     preset_id=5,  # UPDATE: Replace with actual preset ID
    #     aggregation="SUM",
    #     value_field="Revenue",
    #     group_by="RevenueDate",
    #     time_bucket="month",
    #     unit="currency"
    # ))
    
    # Example: Bill Items Count
    # Assumes a preset that returns bill items (common in this system)
    #
    # register_metric(Metric(
    #     name="bill_items_count",
    #     preset_id=6,  # UPDATE: Replace with actual preset ID
    #     aggregation="COUNT",
    #     value_field="ItemId",
    #     group_by="BillId",
    #     time_bucket=None,
    #     unit="count"
    # ))
    
    # ============================================================================
    # ADD YOUR METRICS HERE
    # ============================================================================
    # 
    # To add a new metric:
    # 1. Identify the preset ID from your database (use list_available_presets() helper)
    # 2. Understand the preset's itemQuery output columns
    # 3. Register the metric using register_metric()
    #
    # Example:
    # register_metric(Metric(
    #     name="my_custom_metric",
    #     preset_id=1,  # Your actual preset ID
    #     aggregation="SUM",  # SUM, COUNT, AVG, MIN, or MAX
    #     value_field="Amount",  # Column name from preset results
    #     group_by="Category",  # Optional: column to group by
    #     time_bucket=None,  # Optional: "day", "week", or "month" (requires date group_by)
    #     unit="currency"  # Display unit: "currency", "count", "percentage", etc.
    # ))
    
    pass  # Remove this when you add actual metrics


# Auto-register default metrics on module import
# Uncomment the line below after updating preset IDs:
# register_default_metrics()


# ============================================================================
# Quick Start: Add Your First Metric
# ============================================================================
# 
# To add a metric right now:
# 1. Find your preset ID (run this in Python console or add to a startup script):
#    from app.analytics.metrics import list_available_presets
#    presets = list_available_presets()
#    print(presets)  # Shows all available presets with their IDs
#
# 2. Uncomment and customize one of the examples below, or add your own:
#
# Example - Simple item count (works with any preset that returns rows):
# register_metric(Metric(
#     name="total_items",
#     preset_id=1,  # <-- UPDATE THIS with your actual preset ID
#     aggregation="COUNT",
#     value_field="ItemId",  # <-- UPDATE THIS to match a column from your preset
#     group_by=None,
#     time_bucket=None,
#     unit="count"
# ))
#
# 3. Test your metric:
#    GET /api/v1/analytics/metrics/total_items
# ============================================================================


def get_metric(name: str) -> Optional[Metric]:
    """
    Lookup a metric by name.

    Args:
        name: Metric name

    Returns:
        Metric definition or None if not found
    """
    return METRICS.get(name)


def register_metric(metric: Metric) -> None:
    """
    Register a metric in the registry.

    Args:
        metric: Metric definition to register
    """
    METRICS[metric.name] = metric


def list_available_presets() -> list[dict]:
    """
    Helper function to list available presets for metric configuration.
    
    Returns:
        List of dicts with PresetId and PresetName
    """
    try:
        from app.database import db
        query = "SELECT PresetId, PresetName FROM dbo.ReportSqlPresets WHERE IsActive = 1 ORDER BY PresetName"
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(query)
                rows = cursor.fetchall()
                return [{"PresetId": row[0], "PresetName": row[1]} for row in rows]
            finally:
                cursor.close()
    except Exception:
        return []

