"""
Pydantic models for Template management.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class PageConfig(BaseModel):
    """Page configuration for templates."""
    size: str = Field("A4", description="Page size (A4, Letter, etc.)")
    orientation: str = Field("portrait", description="Page orientation (portrait, landscape)")


class TextFieldConfig(BaseModel):
    """Configuration for a text field in template."""
    type: str = Field("text", description="Field type")
    label: str = Field(..., description="Display label")
    bind: str = Field(..., description="Data binding path (e.g., 'header.BillNo')")
    x: float = Field(0, description="X position")
    y: float = Field(0, description="Y position")
    visible: bool = Field(True, description="Visibility flag")
    fontSize: Optional[float] = Field(None, description="Font size")
    fontWeight: Optional[str] = Field(None, description="Font weight")
    color: Optional[str] = Field(None, description="Text color")
    fieldType: Optional[str] = Field(None, description="Special field type: 'pageNumber', 'totalPages', 'currentDate', 'currentTime'")


class TableColumnConfig(BaseModel):
    """Configuration for a table column."""
    bind: str = Field(..., description="Data binding path (e.g., 'ItemName')")
    label: str = Field(..., description="Column header label")
    visible: bool = Field(True, description="Visibility flag")
    width: Optional[float] = Field(None, description="Column width")
    align: Optional[str] = Field(None, description="Text alignment (left, center, right)")


class ItemsTableConfig(BaseModel):
    """Configuration for items table."""
    columns: List[TableColumnConfig] = Field(default_factory=list, description="Table columns")
    x: Optional[float] = Field(None, description="X position")
    y: Optional[float] = Field(None, description="Y position")
    # Style properties
    borderColor: Optional[str] = Field(None, description="Table border color")
    borderWidth: Optional[float] = Field(None, description="Table border width in pixels")
    headerBackgroundColor: Optional[str] = Field(None, description="Table header background color")
    headerTextColor: Optional[str] = Field(None, description="Table header text color")
    cellPadding: Optional[float] = Field(None, description="Cell padding in pixels")
    fontSize: Optional[float] = Field(None, description="Table font size in pixels")
    alternateRowColor: Optional[str] = Field(None, description="Alternating row background color")
    tableWidth: Optional[float] = Field(None, description="Table width in pixels")


class PaginationConfig(BaseModel):
    """Configuration for table pagination."""
    rowsPerPage: Optional[int] = Field(None, description="Maximum rows per page (auto-calculated if not set)")
    repeatHeader: bool = Field(True, description="Repeat table header on each page")


class TemplateJsonModel(BaseModel):
    """Model for template JSON structure."""
    page: PageConfig = Field(default_factory=lambda: PageConfig())
    pageHeader: Optional[List[TextFieldConfig]] = Field(None, description="Page header fields (appear on every page)")
    pageFooter: Optional[List[TextFieldConfig]] = Field(None, description="Page footer fields (appear on every page)")
    header: List[TextFieldConfig] = Field(default_factory=list, description="Bill header text fields")
    billFooter: Optional[List[TextFieldConfig]] = Field(None, description="Bill footer fields")
    itemsTable: Optional[ItemsTableConfig] = Field(None, description="Items table configuration")
    pagination: Optional[PaginationConfig] = Field(None, description="Pagination configuration")
    
    def model_dump_json(self) -> str:
        """Convert to JSON string."""
        import json
        return json.dumps(self.model_dump(exclude_none=True), indent=2)


class TemplateCreate(BaseModel):
    """Model for creating a new template."""
    presetId: int = Field(..., alias="PresetId", description="Linked SQL preset ID")
    templateName: str = Field(..., alias="TemplateName", min_length=1, max_length=100, description="Name of the template")
    templateJson: str = Field(..., alias="TemplateJson", description="JSON string containing template configuration")
    createdBy: Optional[str] = Field(None, alias="CreatedBy", max_length=50, description="User who created the template")
    
    model_config = {"populate_by_name": True}
    
    @field_validator('templateJson')
    @classmethod
    def validate_template_json(cls, v: str) -> str:
        """Validate template JSON structure."""
        import json
        try:
            template_dict = json.loads(v)
            if not isinstance(template_dict, dict):
                raise ValueError("TemplateJson must be a valid JSON object")
            # Basic structure validation
            if 'page' not in template_dict:
                raise ValueError("TemplateJson must contain 'page' configuration")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {str(e)}")
        return v


class TemplateUpdate(BaseModel):
    """Model for updating an existing template."""
    templateName: Optional[str] = Field(None, alias="TemplateName", min_length=1, max_length=100)
    templateJson: Optional[str] = Field(None, alias="TemplateJson")
    isActive: Optional[bool] = Field(None, alias="IsActive")
    
    model_config = {"populate_by_name": True}
    
    @field_validator('templateJson')
    @classmethod
    def validate_template_json(cls, v: Optional[str]) -> Optional[str]:
        """Validate template JSON structure if provided."""
        if v is None:
            return v
        import json
        try:
            template_dict = json.loads(v)
            if not isinstance(template_dict, dict):
                raise ValueError("TemplateJson must be a valid JSON object")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {str(e)}")
        return v


class TemplateResponse(BaseModel):
    """Model for template response."""
    TemplateId: int
    PresetId: int
    TemplateName: str
    TemplateJson: str
    CreatedBy: Optional[str] = None
    CreatedOn: datetime
    UpdatedOn: Optional[datetime] = None
    IsActive: bool
    
    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    """Model for listing templates."""
    templates: List[TemplateResponse]
    total: int

