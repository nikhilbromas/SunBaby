"""
FastAPI application entry point.
Dynamic Bill Preview System - Backend API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.config import settings
from app.api import presets, templates, preview, auth, generate_pdf, images
import logging

# Configure logging
log_level = logging.DEBUG if settings.DEBUG else logging.INFO
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Dynamic Bill Preview & Template Designer System API",
    debug=settings.DEBUG
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZip compression for all responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include routers
app.include_router(presets.router, prefix=settings.API_PREFIX)
app.include_router(templates.router, prefix=settings.API_PREFIX)
app.include_router(preview.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(generate_pdf.router, prefix=settings.API_PREFIX)
app.include_router(images.router, prefix=settings.API_PREFIX)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Dynamic Bill Preview System API",
        "version": settings.API_VERSION,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug" if settings.DEBUG else "info")

