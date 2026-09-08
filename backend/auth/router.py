from fastapi import APIRouter, HTTPException, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
import json

from db.database import get_db
from auth.schemas import TokenResponse, LoginRequest
from auth.service import authenticate_user, create_access_token
from dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(request: Request, db: AsyncSession = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    badge_id = ""
    password = ""
    
    if "application/json" in content_type:
        try:
            body = await request.json()
            badge_id = body.get("badge_id")
            password = body.get("password")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON")
    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        badge_id = form.get("username") # Frontend sends username
        password = form.get("password")
    else:
        raise HTTPException(status_code=400, detail="Unsupported Media Type")
    
    if not badge_id or not password:
        raise HTTPException(status_code=400, detail="Badge ID/Username and password are required")

    user = await authenticate_user(db, badge_id, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = create_access_token(user)
    return {
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "badge_id": user.badge_id
    }

@router.post("/logout")
async def logout(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    # Increment token_version to invalidate existing tokens
    current_user.token_version += 1
    db.add(current_user)
    await db.commit()
    return {"message": "Successfully logged out"}
