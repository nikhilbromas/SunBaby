"""
Pydantic models for Image management.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ImageResponse(BaseModel):
    """Model for image response."""
    ImageId: int
    ImageName: str
    FilePath: str
    Base64Data: str
    FileSize: int
    Width: int
    Height: int
    MimeType: str
    CreatedBy: Optional[str] = None
    CreatedOn: datetime
    IsActive: bool
    
    model_config = {"from_attributes": True}


class ImageListResponse(BaseModel):
    """Model for listing images."""
    images: List[ImageResponse]
    total: int


class ImageCreate(BaseModel):
    """Model for creating an image (used internally)."""
    imageName: str = Field(..., alias="ImageName", min_length=1, max_length=255)
    filePath: str = Field(..., alias="FilePath", max_length=500)
    base64Data: str = Field(..., alias="Base64Data")
    fileSize: int = Field(..., alias="FileSize", ge=0)
    width: int = Field(..., alias="Width", ge=1)
    height: int = Field(..., alias="Height", ge=1)
    mimeType: str = Field(..., alias="MimeType", max_length=50)
    createdBy: Optional[str] = Field(None, alias="CreatedBy", max_length=50)
    
    model_config = {"populate_by_name": True}

