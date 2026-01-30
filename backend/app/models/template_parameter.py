"""
Pydantic models for Template Parameter management.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Annotated
from datetime import datetime


class TemplateParameterCreate(BaseModel):
    """Model for creating a new template parameter."""
    templateId: Annotated[int, Field(..., alias="TemplateId", description="Template ID")]
    parameterName: Annotated[str, Field(..., alias="ParameterName", min_length=1, max_length=100, description="Parameter name")]
    parameterValue: Annotated[Optional[str], Field(None, alias="ParameterValue", description="Parameter value (stored as JSON string)")]
    createdBy: Annotated[Optional[str], Field(None, alias="CreatedBy", max_length=50, description="User who created the parameter")]
    
    model_config = {"populate_by_name": True}


class TemplateParameterUpdate(BaseModel):
    """Model for updating an existing template parameter."""
    parameterValue: Annotated[Optional[str], Field(None, alias="ParameterValue", description="Parameter value (stored as JSON string)")]
    isActive: Annotated[Optional[bool], Field(None, alias="IsActive", description="Active status")]
    
    model_config = {"populate_by_name": True}


class TemplateParameterResponse(BaseModel):
    """Model for template parameter response."""
    ParameterId: int
    TemplateId: int
    ParameterName: str
    ParameterValue: Optional[str] = None
    CreatedBy: Optional[str] = None
    CreatedOn: datetime
    UpdatedOn: Optional[datetime] = None
    IsActive: bool
    
    model_config = {"from_attributes": True}


class TemplateParameterListResponse(BaseModel):
    """Model for listing template parameters."""
    parameters: List[TemplateParameterResponse]
    total: int


class BulkTemplateParameterUpdate(BaseModel):
    """Model for bulk updating template parameters."""
    templateId: Annotated[int, Field(..., alias="TemplateId", description="Template ID")]
    parameters: dict = Field(..., description="Dictionary of parameter name-value pairs")
    createdBy: Annotated[Optional[str], Field(None, alias="CreatedBy", max_length=50, description="User who created/updated the parameters")]
    
    model_config = {"populate_by_name": True}

