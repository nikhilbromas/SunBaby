"""
Pydantic models for Template Config management.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class TemplateConfigCreate(BaseModel):
    """Model for creating a new template config."""
    templateId: int = Field(..., alias="TemplateId", description="Template ID from ReportTemplates")
    presetId: int = Field(..., alias="PresetId", description="Preset ID from ReportSqlPresets")
    interfaceId: int = Field(..., alias="InterfaceId", description="Interface ID from ainterface table")
    departmentId: Optional[int] = Field(None, alias="DepartmentId", description="Department ID from aDepartmentMaster")
    shopId: Optional[int] = Field(None, alias="ShopId", description="Shop ID from ashops")
    type: str = Field(..., alias="Type", min_length=1, max_length=100, description="Type of configuration")
    description: Optional[str] = Field(None, alias="Description", max_length=500, description="Description of the configuration")
    createdBy: Optional[str] = Field(None, alias="CreatedBy", max_length=50, description="User who created the config")
    
    model_config = {"populate_by_name": True}
    
    @field_validator('type')
    @classmethod
    def validate_type_not_empty(cls, v: str) -> str:
        """Ensure type is not empty."""
        if not v or not v.strip():
            raise ValueError("Type cannot be empty")
        return v.strip()


class TemplateConfigUpdate(BaseModel):
    """Model for updating an existing template config."""
    templateId: Optional[int] = Field(None, alias="TemplateId")
    presetId: Optional[int] = Field(None, alias="PresetId")
    interfaceId: Optional[int] = Field(None, alias="InterfaceId")
    departmentId: Optional[int] = Field(None, alias="DepartmentId")
    shopId: Optional[int] = Field(None, alias="ShopId")
    type: Optional[str] = Field(None, alias="Type", min_length=1, max_length=100)
    description: Optional[str] = Field(None, alias="Description", max_length=500)
    isActive: Optional[bool] = Field(None, alias="IsActive")
    
    model_config = {"populate_by_name": True}
    
    @field_validator('type')
    @classmethod
    def validate_type_not_empty(cls, v: Optional[str]) -> Optional[str]:
        """Ensure type is not empty if provided."""
        if v is not None and not v.strip():
            raise ValueError("Type cannot be empty")
        return v.strip() if v else v


class TemplateConfigResponse(BaseModel):
    """Model for template config response."""
    ConfigId: int
    TemplateId: int
    PresetId: int
    InterfaceId: int
    DepartmentId: Optional[int] = None
    ShopId: Optional[int] = None
    Type: str
    Description: Optional[str] = None
    CreatedBy: Optional[str] = None
    CreatedOn: datetime
    UpdatedOn: Optional[datetime] = None
    IsActive: bool
    
    model_config = {"from_attributes": True}


class TemplateConfigListResponse(BaseModel):
    """Model for listing template configs."""
    configs: list[TemplateConfigResponse]
    total: int

