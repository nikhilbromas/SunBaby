"""
Pydantic models for authentication and company selection.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class UserPermissions(BaseModel):
    AllowPreset: bool = False
    AllowTemplate: bool = False
    AllowPreview: bool = False
    AllowTemplateConfig: bool = False


class Company(BaseModel):
    CompanyId: int
    CompanyName: Optional[str] = None
    PermanentAddress: Optional[str] = None
    CompanyDescription: Optional[str] = None
    PhoneNo: Optional[str] = None
    Permissions: UserPermissions


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    token: str
    user_id: int
    email: str
    companies: List[Company]


class CompanySelectRequest(BaseModel):
    company_id: int


class CompanySelectResponse(BaseModel):
    success: bool
    company_id: int
    company_name: Optional[str] = None
    permissions: UserPermissions


class MeResponse(BaseModel):
    user_id: int
    email: str
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    permissions: Optional[UserPermissions] = None


