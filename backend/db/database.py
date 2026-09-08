import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from config import DATABASE_URL

# For SQLite, the URL might look like sqlite+aiosqlite:///data/criminetwork.db or sqlite+aiosqlite:////app/data/criminetwork.db
if DATABASE_URL.startswith("sqlite+aiosqlite:///"):
    # If it has 4 slashes it's an absolute path, 3 slashes it's relative
    if DATABASE_URL.startswith("sqlite+aiosqlite:////"):
        db_path = DATABASE_URL.replace("sqlite+aiosqlite:////", "/")
    else:
        db_path = DATABASE_URL.replace("sqlite+aiosqlite:///", "")
    
    parent_dir = os.path.dirname(os.path.abspath(db_path))
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)

engine = create_async_engine(
    DATABASE_URL, 
    echo=False, 
    future=True, 
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
