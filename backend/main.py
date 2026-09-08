# backend/main.py
from fastapi import FastAPI
from db.neo4j import create_schema
from graph.router import router as graph_router
from alerts.router import router as alerts_router
from reports.router import router as reports_router
from auth.router import router as auth_router       # Dev 1
from cases.router import router as cases_router     # Dev 1
from ingestion.router import router as ingest_router  # Dev 1
from nlp.router import router as nlp_router         # Dev 2
from copilot.router import router as copilot_router # Dev 2

app = FastAPI(title="Criminal Network Analysis API")

from db.database import engine, Base, AsyncSessionLocal
from auth.service import seed_demo_users
from cases.service import seed_demo_cases
import os

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as db:
        await seed_demo_users(db)
        await seed_demo_cases(db)
        
    os.makedirs("uploads", exist_ok=True)
    
    # Try creating neo4j schema but don't fail if neo4j isn't up
    try:
        await create_schema()
    except Exception as e:
        print(f"Neo4j init failed (normal if mocking): {e}")
        
    print("✓ System ready")

app.include_router(auth_router)
app.include_router(cases_router)
app.include_router(ingest_router)
app.include_router(nlp_router)
app.include_router(graph_router)
app.include_router(alerts_router)
app.include_router(reports_router)
app.include_router(copilot_router)

@app.get("/health")
async def health():
    return {"status": "ok"}