"""
Auth router — minimal stub for Dev 1.
Provides JWT login so other endpoints can work behind auth.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from jose import jwt
import hashlib

from config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_HOURS

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash_pw(password: str) -> str:
    """Simple SHA-256 hash for demo purposes."""
    return hashlib.sha256(password.encode()).hexdigest()


def _verify_pw(password: str, hashed: str) -> bool:
    return _hash_pw(password) == hashed


# In-memory user store (replace with DB in production)
_users = {
    "BADGE001": {
        "badge_id": "BADGE001",
        "name": "Inspector Dev",
        "role": "INVESTIGATOR",
        "hashed_password": _hash_pw("password123"),
    },
    "BADGE000": {
        "badge_id": "BADGE000",
        "name": "Supervisor Admin",
        "role": "SUPERVISOR",
        "hashed_password": _hash_pw("admin123"),
    },
}


class RegisterRequest(BaseModel):
    badge_id: str
    name: str
    role: str = "INVESTIGATOR"
    password: str


@router.post("/register")
async def register(req: RegisterRequest):
    if req.badge_id in _users:
        raise HTTPException(status_code=400, detail="Badge ID already exists")
    _users[req.badge_id] = {
        "badge_id": req.badge_id,
        "name": req.name,
        "role": req.role,
        "hashed_password": _hash_pw(req.password),
    }
    return {"status": "registered", "badge_id": req.badge_id}


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = _users.get(form.username)
    if not user or not _verify_pw(form.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {
        "sub": user["badge_id"],
        "name": user["name"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}
