"""
Very simple in-memory session store for auth + company selection.

NOTE:
- This is process-local memory (not shared across multiple workers/instances).
- It's intentionally minimal to match current app simplicity.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import uuid

from fastapi import Header, HTTPException


@dataclass
class SessionData:
    token: str
    user_id: int
    email: str
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    permissions: Optional[dict] = None
    company_db_details: Optional[dict] = None
    created_at: datetime = datetime.now(timezone.utc)
    expires_at: datetime = datetime.now(timezone.utc) + timedelta(hours=8)


class SessionStore:
    def __init__(self, ttl_minutes: int = 480):
        self._ttl = timedelta(minutes=ttl_minutes)
        self._sessions: Dict[str, SessionData] = {}

    def create(self, *, user_id: int, email: str) -> SessionData:
        token = uuid.uuid4().hex
        now = datetime.now(timezone.utc)
        session = SessionData(
            token=token,
            user_id=user_id,
            email=email,
            created_at=now,
            expires_at=now + self._ttl,
        )
        self._sessions[token] = session
        return session

    def get(self, token: str) -> Optional[SessionData]:
        s = self._sessions.get(token)
        if not s:
            return None
        if datetime.now(timezone.utc) >= s.expires_at:
            self._sessions.pop(token, None)
            return None
        return s

    def delete(self, token: str) -> None:
        self._sessions.pop(token, None)

    def update_company(
        self,
        token: str,
        *,
        company_id: int,
        company_name: Optional[str],
        permissions: dict,
        company_db_details: dict,
    ) -> SessionData:
        s = self.get(token)
        if not s:
            raise KeyError("Session not found")
        s.company_id = company_id
        s.company_name = company_name
        s.permissions = permissions
        s.company_db_details = company_db_details
        return s


session_store = SessionStore()


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2:
        return None
    scheme, token = parts[0], parts[1]
    if scheme.lower() != "bearer":
        return None
    return token.strip() or None


def require_session(authorization: Optional[str] = Header(default=None)) -> SessionData:
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization Bearer token")
    s = session_store.get(token)
    if not s:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return s


