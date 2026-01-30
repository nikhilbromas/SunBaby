"""
Pydantic models for database schema information.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class TableInfo(BaseModel):
    """Information about a database table or view."""
    name: str = Field(..., description="Table or view name")
    type: str = Field(..., description="Type: 'table' or 'view'")
    schema: Optional[str] = Field('dbo', description="Schema name")
    rowCount: Optional[int] = Field(None, description="Estimated row count (tables only)")


class TableListResponse(BaseModel):
    """Response model for listing tables."""
    tables: List[TableInfo]
    total: int


class ColumnInfo(BaseModel):
    """Information about a table column."""
    name: str = Field(..., description="Column name")
    dataType: str = Field(..., description="SQL Server data type")
    nullable: bool = Field(..., description="Whether column allows NULL")
    isPrimaryKey: bool = Field(False, description="Whether column is part of primary key")
    isForeignKey: bool = Field(False, description="Whether column is a foreign key")
    maxLength: Optional[int] = Field(None, description="Max length for string types")
    numericPrecision: Optional[int] = Field(None, description="Precision for numeric types")
    numericScale: Optional[int] = Field(None, description="Scale for numeric types")


class ColumnListResponse(BaseModel):
    """Response model for listing columns."""
    columns: List[ColumnInfo]


class RelationshipInfo(BaseModel):
    """Information about a foreign key relationship."""
    constraintName: str = Field(..., description="Foreign key constraint name")
    parentTable: str = Field(..., description="Referenced (parent) table")
    parentColumn: str = Field(..., description="Referenced column")
    childTable: str = Field(..., description="Referencing (child) table")
    childColumn: str = Field(..., description="Referencing column")


class RelationshipListResponse(BaseModel):
    """Response model for listing relationships."""
    relationships: List[RelationshipInfo]

