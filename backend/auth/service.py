from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from db.models import User
from config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_HOURS

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password[:72], hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password[:72])

def create_access_token(user: User):
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    to_encode = {
        "sub": user.badge_id,
        "name": user.name,
        "role": user.role,
        "token_version": user.token_version,
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def authenticate_user(db: AsyncSession, badge_id: str, password: str):
    result = await db.execute(select(User).where(User.badge_id == badge_id))
    user = result.scalars().first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

async def seed_demo_users(db: AsyncSession):
    result = await db.execute(select(User).limit(1))
    if result.scalars().first() is None:
        demo_users = [
            User(badge_id="BADGE001", name="Inspector Dev", role="INVESTIGATOR", password_hash=get_password_hash("password123")),
            User(badge_id="BADGE000", name="Supervisor Admin", role="SUPERVISOR", password_hash=get_password_hash("admin123"))
        ]
        db.add_all(demo_users)
        await db.commit()
