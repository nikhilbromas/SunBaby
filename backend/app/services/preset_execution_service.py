"""
Shared preset execution service.

This service is the canonical way to execute a SQL preset and obtain:
- header row
- item rows
- optional contentDetails datasets
- basic inferred field metadata for analytics/visualisation

It reuses the same patterns as PreviewService:
- async DB execution via db.execute_query_async
- MAX_QUERY_ROWS enforcement
- in‑memory caching keyed by (company_id, preset_id, parameters)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.database import db
from app.services.preset_service import preset_service
from app.utils.cache import make_cache_key, query_cache

logger = logging.getLogger(__name__)


FieldType = str  # 'number' | 'string' | 'date' | 'boolean' | 'unknown'


class PresetExecutionService:
    """Execute SQL presets in a reusable, analytics‑friendly way."""

    async def execute_preset(
        self,
        *,
        preset_id: int,
        parameters: Dict[str, Any],
        company_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Execute the given preset and return rows + inferred field metadata.

        Args:
            preset_id: ReportSqlPresets.PresetId
            parameters: Parameter values for the preset SQL
            company_id: Optional company id (used only for cache key scoping)

        Returns:
            {
                "headerRow": dict | None,
                "itemsRows": list[dict],
                "contentDetails": dict[str, list[dict]],
                "fieldsMetadata": {
                    "header": {column: FieldType, ...},
                    "items": {column: FieldType, ...},
                    "contentDetails": {
                        name: {column: FieldType, ...}
                    }
                }
            }
        """
        # Cache first
        cache_key = make_cache_key(
            "preset_exec",
            preset_id,
            company_id=company_id,
            **parameters,
        )
        cached = query_cache.get(cache_key)
        if cached is not None:
            return cached

        # Load preset definition
        preset = await preset_service.get_preset(preset_id)
        if not preset:
            raise ValueError(f"Preset with ID {preset_id} not found")

        try:
            sql_json = json.loads(preset.SqlJson or "{}")
        except Exception as e:
            raise ValueError("Invalid SqlJson on preset") from e

        # Prepare async queries (header, items, contentDetails[])
        tasks: List[asyncio.Future] = []
        query_types: List[str] = []

        if sql_json.get("headerQuery"):
            tasks.append(db.execute_query_async(sql_json["headerQuery"], parameters))
            query_types.append("header")

        if sql_json.get("itemQuery"):
            tasks.append(db.execute_query_async(sql_json["itemQuery"], parameters))
            query_types.append("items")

        content_detail_queries: Dict[str, str] = {}
        content_details_config = sql_json.get("contentDetails") or []
        if isinstance(content_details_config, list):
            for cd in content_details_config:
                if not isinstance(cd, dict):
                    continue
                name = cd.get("name")
                query = cd.get("query")
                if not name or not query:
                    continue
                content_detail_queries[name] = query
                tasks.append(db.execute_query_async(query, parameters))
                query_types.append(f"contentDetail:{name}")

        results: List[Any] = []
        if tasks:
            try:
                # Apply execution timeout
                execution_timeout = getattr(settings, "ANALYTICS_EXECUTION_TIMEOUT", 5)
                start_time = time.time()
                
                try:
                    results = await asyncio.wait_for(
                        asyncio.gather(*tasks, return_exceptions=True),
                        timeout=execution_timeout,
                    )
                except asyncio.TimeoutError:
                    elapsed = time.time() - start_time
                    logger.warning(
                        f"Preset {preset_id} execution timed out after {elapsed:.2f}s "
                        f"(limit: {execution_timeout}s)"
                    )
                    raise ValueError(
                        f"Query execution timed out after {execution_timeout} seconds"
                    ) from None
                
                elapsed = time.time() - start_time
                logger.info(
                    f"Preset {preset_id} executed in {elapsed:.2f}s "
                    f"({len(tasks)} query/queries)"
                )
            except Exception as e:
                logger.error(f"Error executing preset {preset_id}: {e}")
                raise ValueError(f"Error executing preset queries: {e}") from e

        header_rows: Optional[List[Dict[str, Any]]] = None
        item_rows: Optional[List[Dict[str, Any]]] = None
        content_details_rows: Dict[str, List[Dict[str, Any]]] = {}

        for idx, result in enumerate(results):
            q_type = query_types[idx]

            if isinstance(result, Exception):
                raise ValueError(f"Error executing {q_type} query: {result}")

            rows: List[Dict[str, Any]] = list(result) if result else []
            original_row_count = len(rows)

            # Enforce row limit
            if len(rows) > settings.MAX_QUERY_ROWS:
                rows = rows[: settings.MAX_QUERY_ROWS]
                logger.warning(
                    f"Preset {preset_id} {q_type} query returned {original_row_count} rows, "
                    f"truncated to {settings.MAX_QUERY_ROWS} (MAX_QUERY_ROWS limit)"
                )
            else:
                logger.debug(
                    f"Preset {preset_id} {q_type} query returned {original_row_count} rows"
                )

            if q_type == "header":
                header_rows = rows
            elif q_type == "items":
                item_rows = rows
            elif q_type.startswith("contentDetail:"):
                name = q_type.split(":", 1)[1]
                content_details_rows[name] = rows

        header_row = header_rows[0] if header_rows and len(header_rows) > 0 else None
        items_rows = item_rows or []

        fields_metadata = self._build_fields_metadata(
            header_row,
            items_rows,
            content_details_rows,
        )

        payload = {
            "headerRow": header_row,
            "itemsRows": items_rows,
            "contentDetails": content_details_rows,
            "fieldsMetadata": fields_metadata,
        }

        query_cache.set(cache_key, payload)
        return payload

    # --------------------------------------------------------------------- #
    # Helpers
    # --------------------------------------------------------------------- #

    def _infer_field_type(self, value: Any) -> FieldType:
        """Best‑effort classification for a single value."""
        if value is None:
            return "unknown"
        if isinstance(value, bool):
            return "boolean"
        if isinstance(value, (int, float)):
            return "number"

        # Try to parse dates from common SQL formats (YYYY‑MM‑DD, etc.)
        if isinstance(value, str):
            text = value.strip()
            if not text:
                return "string"
            # Very lightweight date detection – avoid heavy dependencies
            # Common formats: 2024‑01‑31, 2024‑01‑31T12:34:56
            try:
                from datetime import datetime

                for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
                    try:
                        datetime.strptime(text, fmt)
                        return "date"
                    except ValueError:
                        continue
            except Exception:
                pass
            return "string"

        return "unknown"

    def _infer_schema_from_rows(self, rows: List[Dict[str, Any]]) -> Dict[str, FieldType]:
        """
        Infer a per‑column field type from a list of row dicts.

        Strategy:
        - Look at up to the first N non‑null values per column
        - Prefer the most "specific" type across samples
        """
        if not rows:
            return {}

        max_samples = 20
        samples_per_column: Dict[str, List[FieldType]] = {}

        for row in rows[:max_samples]:
            for col, val in row.items():
                f_type = self._infer_field_type(val)
                if f_type == "unknown":
                    continue
                samples_per_column.setdefault(col, []).append(f_type)

        schema: Dict[str, FieldType] = {}
        for col, types in samples_per_column.items():
            if not types:
                schema[col] = "unknown"
                continue
            # Order of preference
            if any(t == "number" for t in types):
                schema[col] = "number"
            elif any(t == "date" for t in types):
                schema[col] = "date"
            elif any(t == "boolean" for t in types):
                schema[col] = "boolean"
            elif any(t == "string" for t in types):
                schema[col] = "string"
            else:
                schema[col] = types[0]

        return schema

    def _build_fields_metadata(
        self,
        header_row: Optional[Dict[str, Any]],
        items_rows: List[Dict[str, Any]],
        content_details_rows: Dict[str, List[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        """Aggregate inferred schemas for header/items/contentDetails."""
        header_rows_list: List[Dict[str, Any]] = []
        if header_row:
            header_rows_list = [header_row]

        header_schema = self._infer_schema_from_rows(header_rows_list)
        items_schema = self._infer_schema_from_rows(items_rows)

        cd_schemas: Dict[str, Dict[str, FieldType]] = {}
        for name, rows in content_details_rows.items():
            cd_schemas[name] = self._infer_schema_from_rows(rows)

        return {
            "header": header_schema,
            "items": items_schema,
            "contentDetails": cd_schemas,
        }


preset_execution_service = PresetExecutionService()


