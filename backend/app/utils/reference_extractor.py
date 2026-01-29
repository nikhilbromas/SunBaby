"""
Reference extraction utility for safe column access from schema-less preset results.

This module provides a single, safe, reusable mechanism to extract column-based data
from schema-less preset execution results. All consumers MUST use this utility
instead of directly accessing row dictionaries to ensure safety and consistency.

The preset execution service returns rows as List[Dict[str, Any]], so this utility
works with that format.
"""

from __future__ import annotations

from typing import Any, Dict, List


class MissingColumnError(Exception):
    """Raised when a required column is not found in the preset result."""

    def __init__(self, column_name: str, available_columns: List[str] | None = None):
        self.column_name = column_name
        self.available_columns = available_columns or []
        message = f"Required column '{column_name}' not found in preset result"
        if self.available_columns:
            message += f". Available columns: {', '.join(self.available_columns)}"
        super().__init__(message)


def extract_column(rows: List[Dict[str, Any]], column_name: str) -> List[Any]:
    """
    Extract a single column from a list of row dictionaries by column name.

    Args:
        rows: List of row dictionaries from preset execution
        column_name: Name of the column to extract

    Returns:
        List of values from the specified column

    Raises:
        MissingColumnError: If the column is not found in any row
    """
    if not rows:
        return []

    # Check if column exists in first row
    if column_name not in rows[0]:
        available_columns = list(rows[0].keys()) if rows else []
        raise MissingColumnError(column_name, available_columns)

    return [row.get(column_name) for row in rows]


def extract_rows_as_dicts(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Return rows as-is (already dictionaries).

    This function exists for API consistency. The rows are already dictionaries
    from the preset execution service.

    Args:
        rows: List of row dictionaries

    Returns:
        Same list of dictionaries
    """
    return rows

