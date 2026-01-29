"""
FastAPI endpoints for bill preview generation.
"""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import HTMLResponse, Response, JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
import asyncio
from app.services.preview_service import preview_service
from app.services.export_service import export_service
from app.utils.template_engine import template_engine
from app.utils.html_organizer import html_organizer
from app.utils.pdf_engine import pdf_engine
from app.services.company_pdf_service import generate_company_pdf_base64
import base64

# Thread pool executor for CPU-intensive PDF generation
_pdf_executor: Optional[ThreadPoolExecutor] = None

def get_pdf_executor() -> ThreadPoolExecutor:
    """Get or create the PDF generation thread pool executor."""
    global _pdf_executor
    if _pdf_executor is None:
        # Use a smaller pool for PDF generation (CPU-intensive)
        _pdf_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="pdf_worker")
    return _pdf_executor

router = APIRouter(prefix="/preview", tags=["Preview"])


class PreviewRequest(BaseModel):
    """Request model for preview generation."""
    companyId: Optional[int] = Field(default=None, alias="company_id")
    templateId: int = Field(alias="template_id")
    parameters: Dict[str, Any]
    
    model_config = {"populate_by_name": True}


@router.post("/", response_class=HTMLResponse)
async def generate_preview_html(request: PreviewRequest):
    """
    Generate HTML preview of a bill.
    
    - **template_id**: Template ID to use
    - **parameters**: Dictionary of parameter values for SQL queries
    """
    try:
        # Generate preview data
        preview_data = await preview_service.generate_preview_data(
            request.templateId,
            request.parameters
        )
        
        # Prepare data for template
        data = preview_service.prepare_data_for_template(preview_data)
        
        # Render template to HTML
        html = template_engine.render_template(
            preview_data['template'].TemplateJson,
            data
        )
        
        # Organize HTML bill-content and bill-footer, fix pagination
        # html = html_organizer.organize_html(
        #     html,
        #     preview_data['template'].TemplateJson
        # )
        
        return HTMLResponse(content=html)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/pdf")
async def generate_pdf(request: PreviewRequest):
    """
    Generate PDF from template and return as base64.
    
    - **template_id**: Template ID to use
    - **parameters**: Dictionary of parameter values for SQL queries
    
    Returns:
        JSON response with base64 encoded PDF: {"pdf": "base64_string"}
    """
    try:
        # If companyId is provided, switch to the selected company DB and generate PDF there.
        if request.companyId is not None:
            pdf_base64 = await generate_company_pdf_base64(
                company_id=int(request.companyId),
                template_id=int(request.templateId),
                parameters=request.parameters,
            )
            return JSONResponse(content={"pdf": pdf_base64})

        # Backwards-compatible behavior: generate using current DB context.
        preview_data = await preview_service.generate_preview_data(request.templateId, request.parameters)
        data = preview_service.prepare_data_for_template(preview_data)
        template_json = preview_data["template"].TemplateJson
        # Try to get company_id from request if available
        company_id = request.companyId if hasattr(request, 'companyId') and request.companyId else None
        
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
        pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
        return JSONResponse(content={"pdf": pdf_base64})
    except ValueError as e:
        # If companyId path returned a company-not-found error, map it to 404.
        if str(e).strip().lower() == "company not found":
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/get-data")
async def generate_preview_pdf(request: PreviewRequest):
    """
    Generate PDF preview of a bill and return as base64.
    (Deprecated: Use /pdf endpoint instead)
    
    - **template_id**: Template ID to use
    - **parameters**: Dictionary of parameter values for SQL queries
    
    Returns:
        JSON response with base64 encoded PDF: {"pdf": "base64_string"}
    """
    try:
        # Generate preview data
        preview_data = await preview_service.generate_preview_data(
            request.templateId,
            request.parameters
        )
        
        # Prepare data for template
        data = preview_service.prepare_data_for_template(preview_data)
        
        # Get template JSON
        template_json = preview_data['template'].TemplateJson
        
        # Generate PDF in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        executor = get_pdf_executor()
        pdf_bytes = await loop.run_in_executor(
            executor,
            pdf_engine.generate_pdf,
            template_json,
            data,
            None
        )
        
        # Encode to base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return JSONResponse(content={"pdf": pdf_base64})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/data/{template_id}")
async def get_preview_data(
    template_id: int,
    parameters: Dict[str, Any]
):
    """
    Get preview data (header and items , contentDetails) without rendering.
    Useful for frontend to render custom previews.
    
    - **template_id**: Template ID to use
    - **parameters**: Dictionary of parameter values for SQL queries
    """
    try:
        # Generate preview data
        preview_data = await preview_service.generate_preview_data(
            template_id,
            parameters
        )
        
        # Return data without template
        return {
            "header": preview_data.get("header"),
            "items": preview_data.get("items"),
            "contentDetails": preview_data.get("contentDetails", {}),
            "template_id": template_id
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

