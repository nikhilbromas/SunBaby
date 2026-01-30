"""
FastAPI endpoints for authentication and company selection.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.models.auth import (
    LoginRequest,
    LoginResponse,
    Company,
    UserPermissions,
    CompanySelectRequest,
    CompanySelectResponse,
    MeResponse,
)
from app.services.auth_service import auth_service
from app.utils.session import session_store, require_session
from app.utils.company_schema import ensure_company_schema
from app.database import db


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    user = auth_service.authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session = session_store.create(user_id=user["user_id"], email=user["email"])

    companies_raw = auth_service.get_user_companies(user["user_id"])
    companies = []
    for r in companies_raw:
        perms = UserPermissions(
            AllowPreset=bool(r.get("AllowPreset", False)),
            AllowTemplate=bool(r.get("AllowTemplate", False)),
            AllowPreview=bool(r.get("AllowPreview", False)),
            AllowTemplateConfig=bool(r.get("AllowTemplateConfig", False)),
        )
        companies.append(
            Company(
                CompanyId=int(r["CompanyId"]),
                CompanyName=r.get("CompanyName"),
                PermanentAddress=r.get("PermanentAddress"),
                CompanyDescription=r.get("CompanyDescription"),
                PhoneNo=r.get("PhoneNo"),
                Permissions=perms,
            )
        )

    return LoginResponse(token=session.token, user_id=session.user_id, email=session.email, companies=companies)


@router.post("/select-company", response_model=CompanySelectResponse)
async def select_company(payload: CompanySelectRequest, session=Depends(require_session)):
    # Validate company is mapped to this user and active
    companies = auth_service.get_user_companies(session.user_id)
    match = next((c for c in companies if int(c["CompanyId"]) == int(payload.company_id)), None)
    if not match:
        raise HTTPException(status_code=403, detail="Company not allowed for this user")

    details = auth_service.get_company_details(payload.company_id)
    if not details:
        raise HTTPException(status_code=404, detail="Company not found")

    perms = {
        "AllowPreset": bool(match.get("AllowPreset", False)),
        "AllowTemplate": bool(match.get("AllowTemplate", False)),
        "AllowPreview": bool(match.get("AllowPreview", False)),
        "AllowTemplateConfig": bool(match.get("AllowTemplateConfig", False)),
    }

    # Switch global db connection to company DB (per your selected approach)
    try:
        db.switch_to_company_db(details)
        # Ensure required preset/template tables exist in this company DB
        ensure_company_schema()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to company DB: {str(e)}")

    session_store.update_company(
        session.token,
        company_id=int(payload.company_id),
        company_name=details.get("CompanyName"),
        permissions=perms,
        company_db_details=details,
    )

    return CompanySelectResponse(
        success=True,
        company_id=int(payload.company_id),
        company_name=details.get("CompanyName"),
        permissions=UserPermissions(**perms),
    )


@router.get("/me", response_model=MeResponse)
async def me(session=Depends(require_session)):
    return MeResponse(
        user_id=session.user_id,
        email=session.email,
        company_id=session.company_id,
        company_name=session.company_name,
        permissions=UserPermissions(**(session.permissions or {"AllowPreset": False, "AllowTemplate": False, "AllowPreview": False, "AllowTemplateConfig": False}))
        if session.company_id
        else None,
    )


@router.post("/logout")
async def logout(session=Depends(require_session)):
    """
    Logout endpoint that resets database context and cleans up session.
    Ensures all database connections are properly closed.
    """
    try:
        # Reset DB back to auth DB before deleting session
        db.switch_to_auth_db()
    except Exception:
        # Continue with logout even if DB switch fails
        pass
    
    # Delete session (this cleans up the in-memory session data)
    session_store.delete(session.token)
    
    return {"success": True, "message": "Logged out successfully"}


