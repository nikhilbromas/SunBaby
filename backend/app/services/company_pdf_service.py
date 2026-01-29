"""
Company PDF generation service.

Public flow:
- Validate company exists in auth DB (dbo.CompanyProfile)
- Switch DB context to that company DB (connection test included)
- Generate PDF via preview_service + pdf_engine
- Return base64
"""

from __future__ import annotations

import base64
import asyncio
from typing import Any, Dict
from concurrent.futures import ThreadPoolExecutor

from app.database import db
from app.services.auth_service import auth_service
from app.services.preview_service import preview_service
from app.utils.company_schema import ensure_company_schema
from app.utils.pdf_engine import pdf_engine

# Thread pool executor for PDF generation
_pdf_executor: ThreadPoolExecutor = None

def get_pdf_executor() -> ThreadPoolExecutor:
    """Get or create the PDF generation thread pool executor."""
    global _pdf_executor
    if _pdf_executor is None:
        _pdf_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="pdf_worker")
    return _pdf_executor


async def generate_company_pdf_base64(company_id: int, template_id: int, parameters: Dict[str, Any]) -> str:
    """
    Generate a base64 PDF for the given company + template + SQL parameters (async).

    Raises:
        ValueError: for validation issues (company missing, template missing, missing params, etc.)
        Exception: for unexpected errors, including DB connection failures
    """
    details = auth_service.get_company_details(company_id)
    if not details:
        raise ValueError("Company not found")

    try:
        db.switch_to_company_db(details)
        # Ensure required preset/template tables exist in this company DB
        ensure_company_schema()

        preview_data = await preview_service.generate_preview_data(template_id, parameters)
        data = preview_service.prepare_data_for_template(preview_data)
        template_json = preview_data["template"].TemplateJson

        # Generate PDF in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        executor = get_pdf_executor()
        pdf_bytes = await loop.run_in_executor(
            executor,
            pdf_engine.generate_pdf,
            template_json,
            data,
            company_id
        )
        return base64.b64encode(pdf_bytes).decode("utf-8")
    finally:
        # Reduce cross-request DB context bleed (db is a global instance)
        try:
            db.switch_to_auth_db()
        except Exception:
            pass


