"""
FastAPI endpoints for bill preview generation.
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, Response, JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from app.services.preview_service import preview_service
from app.services.export_service import export_service
from app.utils.template_engine import template_engine
from app.utils.html_organizer import html_organizer
from app.utils.pdf_engine import pdf_engine
import base64
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/preview", tags=["Preview"])


class PreviewRequest(BaseModel):
    """Request model for preview generation."""
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
        preview_data = preview_service.generate_preview_data(
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
        logger.error(f"Error generating preview: {str(e)}")
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
        # Generate preview data
        preview_data = preview_service.generate_preview_data(
            request.templateId,
            request.parameters
        )
        
        # Prepare data for template
        data = preview_service.prepare_data_for_template(preview_data)
        
        # Get template JSON
        template_json = preview_data['template'].TemplateJson
        
        # Generate PDF using pdf_engine
        pdf_bytes = pdf_engine.generate_pdf(template_json, data)
        
        # Encode to base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return JSONResponse(content={"pdf": pdf_base64})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}", exc_info=True)
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
        preview_data = preview_service.generate_preview_data(
            request.templateId,
            request.parameters
        )
        
        # Prepare data for template
        data = preview_service.prepare_data_for_template(preview_data)
        
        # Get template JSON
        template_json = preview_data['template'].TemplateJson
        
        # Generate PDF using pdf_engine
        pdf_bytes = pdf_engine.generate_pdf(template_json, data)
        
        # Encode to base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return JSONResponse(content={"pdf": pdf_base64})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}", exc_info=True)
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
        preview_data = preview_service.generate_preview_data(
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
        logger.error(f"Error getting preview data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

