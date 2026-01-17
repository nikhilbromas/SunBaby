"""
Pydantic models for SQL Preset management.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, List
from datetime import datetime


class ContentDetail(BaseModel):
    """Model for a content detail with name and query."""
    name: str = Field(..., min_length=1, max_length=100, description="Name of the content detail")
    query: str = Field(..., min_length=1, description="SQL query for the content detail")
    dataType: str = Field('array', description="Data type: 'array' for multiple rows (like items), 'object' for single row (like header)")
    
    @field_validator('name')
    @classmethod
    def validate_name_not_empty(cls, v: str) -> str:
        """Ensure name is not empty."""
        if not v or not v.strip():
            raise ValueError("Content detail name cannot be empty")
        return v.strip()
    
    @field_validator('query')
    @classmethod
    def validate_query_not_empty(cls, v: str) -> str:
        """Ensure query is not empty."""
        if not v or not v.strip():
            raise ValueError("Content detail query cannot be empty")
        return v.strip()
    
    @field_validator('dataType')
    @classmethod
    def validate_data_type(cls, v: str) -> str:
        """Ensure dataType is either 'array' or 'object'."""
        if v not in ['array', 'object']:
            raise ValueError("dataType must be either 'array' or 'object'")
        return v


class SqlJsonModel(BaseModel):
    """Model for SQL JSON structure."""
    headerQuery: Optional[str] = Field(None, description="SQL query for header data")
    itemQuery: Optional[str] = Field(None, description="SQL query for item data")
    contentDetails: Optional[List[ContentDetail]] = Field(None, description="Array of content details with name and query")
    
    @field_validator('headerQuery', 'itemQuery')
    @classmethod
    def validate_query_not_empty(cls, v: Optional[str]) -> Optional[str]:
        """Ensure query is not empty if provided."""
        if v is not None and not v.strip():
            raise ValueError("Query cannot be empty")
        return v
    
    @field_validator('contentDetails')
    @classmethod
    def validate_content_details(cls, v: Optional[List[ContentDetail]]) -> Optional[List[ContentDetail]]:
        """Validate content details array."""
        if v is None:
            return v
        if not isinstance(v, list):
            raise ValueError("contentDetails must be an array")
        if len(v) == 0:
            return v
        # Check for duplicate names
        names = [cd.name for cd in v]
        if len(names) != len(set(names)):
            raise ValueError("Content detail names must be unique")
        return v
    
    def model_dump_json(self) -> str:
        """Convert to JSON string."""
        import json
        return json.dumps(self.model_dump(exclude_none=True))


class PresetCreate(BaseModel):
    """Model for creating a new SQL preset."""
    presetName: str = Field(..., alias="PresetName", min_length=1, max_length=100, description="Name of the preset")
    sqlJson: str = Field(..., alias="SqlJson", description="JSON string containing headerQuery and/or itemQuery")
    expectedParams: Optional[str] = Field(None, alias="ExpectedParams", max_length=500, description="Comma-separated list of expected parameters")
    createdBy: Optional[str] = Field(None, alias="CreatedBy", max_length=50, description="User who created the preset")
    
    model_config = {"populate_by_name": True}
    
    @field_validator('sqlJson')
    @classmethod
    def validate_sql_json(cls, v: str) -> str:
        """Validate SQL JSON structure."""
        import json
        try:
            sql_dict = json.loads(v)
            if not isinstance(sql_dict, dict):
                raise ValueError("SqlJson must be a valid JSON object")
            # Check if at least one query exists
            has_header = 'headerQuery' in sql_dict and sql_dict['headerQuery']
            has_item = 'itemQuery' in sql_dict and sql_dict['itemQuery']
            has_content_details = 'contentDetails' in sql_dict and isinstance(sql_dict['contentDetails'], list) and len(sql_dict['contentDetails']) > 0
            if not (has_header or has_item or has_content_details):
                raise ValueError("SqlJson must contain at least 'headerQuery', 'itemQuery', or 'contentDetails'")
            # Validate contentDetails structure if present
            if 'contentDetails' in sql_dict:
                if not isinstance(sql_dict['contentDetails'], list):
                    raise ValueError("contentDetails must be an array")
                for idx, cd in enumerate(sql_dict['contentDetails']):
                    if not isinstance(cd, dict):
                        raise ValueError(f"contentDetails[{idx}] must be an object")
                    if 'name' not in cd or not cd['name']:
                        raise ValueError(f"contentDetails[{idx}] must have a non-empty 'name' field")
                    if 'query' not in cd or not cd['query']:
                        raise ValueError(f"contentDetails[{idx}] must have a non-empty 'query' field")
                    # Validate dataType if provided, default to 'array' for backward compatibility
                    if 'dataType' in cd and cd['dataType'] not in ['array', 'object']:
                        raise ValueError(f"contentDetails[{idx}].dataType must be either 'array' or 'object'")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {str(e)}")
        return v


class PresetUpdate(BaseModel):
    """Model for updating an existing SQL preset."""
    presetName: Optional[str] = Field(None, alias="PresetName", min_length=1, max_length=100)
    sqlJson: Optional[str] = Field(None, alias="SqlJson")
    expectedParams: Optional[str] = Field(None, alias="ExpectedParams", max_length=500)
    isActive: Optional[bool] = Field(None, alias="IsActive")
    
    model_config = {"populate_by_name": True}
    
    @field_validator('sqlJson')
    @classmethod
    def validate_sql_json(cls, v: Optional[str]) -> Optional[str]:
        """Validate SQL JSON structure if provided."""
        if v is None:
            return v
        import json
        try:
            sql_dict = json.loads(v)
            if not isinstance(sql_dict, dict):
                raise ValueError("SqlJson must be a valid JSON object")
            # Check if at least one query exists
            has_header = 'headerQuery' in sql_dict and sql_dict['headerQuery']
            has_item = 'itemQuery' in sql_dict and sql_dict['itemQuery']
            has_content_details = 'contentDetails' in sql_dict and isinstance(sql_dict['contentDetails'], list) and len(sql_dict['contentDetails']) > 0
            if not (has_header or has_item or has_content_details):
                raise ValueError("SqlJson must contain at least 'headerQuery', 'itemQuery', or 'contentDetails'")
            # Validate contentDetails structure if present
            if 'contentDetails' in sql_dict:
                if not isinstance(sql_dict['contentDetails'], list):
                    raise ValueError("contentDetails must be an array")
                for idx, cd in enumerate(sql_dict['contentDetails']):
                    if not isinstance(cd, dict):
                        raise ValueError(f"contentDetails[{idx}] must be an object")
                    if 'name' not in cd or not cd['name']:
                        raise ValueError(f"contentDetails[{idx}] must have a non-empty 'name' field")
                    if 'query' not in cd or not cd['query']:
                        raise ValueError(f"contentDetails[{idx}] must have a non-empty 'query' field")
                    # Validate dataType if provided, default to 'array' for backward compatibility
                    if 'dataType' in cd and cd['dataType'] not in ['array', 'object']:
                        raise ValueError(f"contentDetails[{idx}].dataType must be either 'array' or 'object'")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {str(e)}")
        return v


class PresetResponse(BaseModel):
    """Model for SQL preset response."""
    PresetId: int
    PresetName: str
    SqlJson: str
    ExpectedParams: Optional[str] = None
    CreatedBy: Optional[str] = None
    CreatedOn: datetime
    UpdatedOn: Optional[datetime] = None
    IsActive: bool
    
    model_config = {"from_attributes": True}


class PresetListResponse(BaseModel):
    """Model for listing presets."""
    presets: List[PresetResponse]
    total: int

