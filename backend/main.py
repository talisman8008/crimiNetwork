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

@app.on_event("startup")
async def startup():
    await create_schema()
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