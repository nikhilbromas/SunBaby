"""
Public PDF generation endpoint.

POST /api/v1/generate-pdf
Body: { companyId, templateId, parameters }
Returns: { pdf: <base64> }
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services.company_pdf_service import generate_company_pdf_base64

logger = logging.getLogger(__name__)

router = APIRouter(tags=["GeneratePDF"])


class GeneratePdfRequest(BaseModel):
    companyId: int = Field(alias="company_id")
    templateId: int = Field(alias="template_id")
    parameters: Dict[str, Any]

    model_config = {"populate_by_name": True}


@router.post("/generate-pdf")
async def generate_pdf_public(request: GeneratePdfRequest):
    """
    Generate a PDF from template and return as base64 (public endpoint).

    - **company_id**: Company ID to select company DB (validated against auth DB CompanyProfile)
    - **template_id**: Template ID to use
    - **parameters**: Dictionary of parameter values for SQL queries
    """
    try:
        pdf_base64 = await generate_company_pdf_base64(
            company_id=int(request.companyId),
            template_id=int(request.templateId),
            parameters=request.parameters,
        )
        return JSONResponse(content={"pdf": pdf_base64})
    except ValueError as e:
        if str(e).strip().lower() == "company not found":
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating public PDF: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


