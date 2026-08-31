from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from config import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class User:
    def __init__(self, badge_id: str, name: str, role: str):
        self.badge_id = badge_id
        self.name = name
        self.role = role

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
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
        if badge_id is None:
            raise credentials_exception
        return User(badge_id=badge_id, name=name, role=role)
    except JWTError:
        raise credentials_exception

async def require_investigator(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("INVESTIGATOR", "SUPERVISOR"):
        raise HTTPException(status_code=403, detail="Investigator access required")
    return user

async def require_supervisor(user: User = Depends(get_current_user)) -> User:
    if user.role != "SUPERVISOR":
        raise HTTPException(status_code=403, detail="Supervisor access required")
    return user