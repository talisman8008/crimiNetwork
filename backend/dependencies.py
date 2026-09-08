from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import SECRET_KEY, ALGORITHM
from db.database import get_db
from db.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        badge_id: str = payload.get("sub")
        role: str = payload.get("role")
        name: str = payload.get("name")
        token_version: int = payload.get("token_version")
        
        if badge_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Query DB to get user and check token_version
    result = await db.execute(select(User).where(User.badge_id == badge_id))
    user = result.scalars().first()

    if user is None:
        raise credentials_exception
    
    if user.token_version != token_version:
        raise credentials_exception

    return user

async def require_investigator(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("INVESTIGATOR", "SUPERVISOR"):
        raise HTTPException(status_code=403, detail="Investigator access required")
    return user

async def require_supervisor(user: User = Depends(get_current_user)) -> User:
    if user.role != "SUPERVISOR":
        raise HTTPException(status_code=403, detail="Supervisor access required")
    return user