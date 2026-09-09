"""Backend Dev 3 tests.

Covers:
  1. CDR ingestion triggers the full analytics pipeline.
  2. Hawala financial ingestion produces a specific retrievable alert.
  3. Alert persistence in SQLite (survives reload).
  4. Alert de-duplication via fingerprint.
  5. Graph endpoint case ownership (403 for wrong investigator).
  6. Alert endpoint case ownership (403 for wrong investigator).
  7. case_id=all restricted to supervisors.
"""

import sys
import os

# Ensure backend dir is on sys.path for module resolution
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set test database URL before importing anything
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///test_criminetwork.db"

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import APIRouter
import graph.analytics

# ─── Mock heavy modules that aren't needed for these tests ───

_nlp_router = APIRouter(prefix="/api/nlp", tags=["nlp"])
_reports_router = APIRouter(prefix="/api/reports", tags=["reports"])
_copilot_router = APIRouter(prefix="/api/copilot", tags=["copilot"])

mock_nlp = MagicMock()
mock_nlp.router = _nlp_router
mock_nlp.process = AsyncMock()
sys.modules['nlp'] = MagicMock()
sys.modules['nlp.router'] = mock_nlp
sys.modules['nlp.ner'] = MagicMock()
sys.modules['nlp.ner.model'] = MagicMock()
sys.modules['nlp.coref'] = MagicMock()
sys.modules['nlp.embeddings'] = MagicMock()
sys.modules['nlp.entity_resolution'] = MagicMock()

mock_reports = MagicMock()
mock_reports.router = _reports_router
sys.modules['reports'] = MagicMock()
sys.modules['reports.router'] = mock_reports

mock_copilot = MagicMock()
mock_copilot.router = _copilot_router
sys.modules['copilot'] = MagicMock()
sys.modules['copilot.router'] = mock_copilot

# Mock db.neo4j
mock_neo4j = MagicMock()
mock_neo4j.run_query = AsyncMock(return_value=[])
mock_neo4j.create_schema = AsyncMock()
sys.modules['db.neo4j'] = mock_neo4j

# Mock db.chromadb
sys.modules['db.chromadb'] = MagicMock()

# Mock training
sys.modules['training'] = MagicMock()

# Mock heavy graph algorithm dependencies so imports succeed
mock_community_louvain = MagicMock()
sys.modules['community'] = mock_community_louvain

from httpx import AsyncClient, ASGITransport

from main import app
from db.database import engine, Base, AsyncSessionLocal
from db.models import Alert, Case, User
from auth.service import seed_demo_users
from cases.service import seed_demo_cases

_db_initialized = False


@pytest.fixture(autouse=True)
async def setup_db():
    global _db_initialized
    if not _db_initialized:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as db:
            await seed_demo_users(db)
            await seed_demo_cases(db)
            # Create a case owned by BADGE002 for ownership tests
            from sqlalchemy.future import select
            result = await db.execute(select(Case).where(Case.id == "c-other"))
            if not result.scalars().first():
                other_case = Case(
                    id="c-other",
                    name="Other Officer Case",
                    fir_number="FIR-OTHER",
                    status="active",
                    assigned_to="BADGE002",
                )
                db.add(other_case)
                await db.commit()

            # Clear alerts from previous test runs to avoid fingerprint collisions
            from sqlalchemy import delete
            await db.execute(delete(Alert))
            await db.commit()

        os.makedirs("uploads", exist_ok=True)
        _db_initialized = True
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def get_token(client, badge_id="BADGE001", password="password123"):
    resp = await client.post("/api/auth/login", json={
        "badge_id": badge_id,
        "password": password
    })
    return resp.json()["token"]


# ──────────────── 1. CDR ingestion triggers analytics pipeline ────────────────

@pytest.mark.asyncio
async def test_cdr_ingestion_triggers_analytics(client):
    """Upload a CDR file; verify the analytics orchestrator functions are called."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    csv_content = (
        b"caller_number,callee_number,call_date,duration_seconds\n"
        b"9876543210,8765432109,2025-12-25,120\n"
        b"9876543210,7654321098,2025-12-25,60\n"
    )
    files = {"file": ("cdr_test.csv", csv_content, "text/csv")}
    data = {"source_type": "cdr"}

    with patch("graph.analytics.compute_centrality", new_callable=AsyncMock) as mock_cent, \
         patch("graph.analytics.detect_communities", new_callable=AsyncMock) as mock_comm, \
         patch("graph.analytics.score_anomalies", new_callable=AsyncMock) as mock_anom, \
         patch("graph.analytics.run_cross_case_scan_all", new_callable=AsyncMock) as mock_xcase, \
         patch("graph.analytics.run_all_rules", new_callable=AsyncMock) as mock_rules:

        resp = await client.post("/api/cases/c-1/upload", files=files, data=data, headers=headers)
        assert resp.status_code == 200
        job_id = resp.json()["job_id"]

        # Wait for background task
        await asyncio.sleep(1.0)

        # All analytics functions should have been called with case_id
        mock_cent.assert_called_once_with("c-1")
        mock_comm.assert_called_once_with("c-1")
        mock_anom.assert_called_once_with("c-1")
        mock_xcase.assert_called_once()
        mock_rules.assert_called_once_with("c-1")


# ──────────────── 2. Hawala fixture produces specific alert ────────────────

@pytest.mark.asyncio
async def test_hawala_ingestion_produces_alert(client):
    """Upload a financial CSV with Hawala transactions, run alert rules
    with a mock that returns Hawala data, and verify the alert is persisted."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Hawala fixture CSV
    csv_content = (
        b"sender_name,receiver_name,transaction_date,amount,transaction_type\n"
        b"Ravi Kumar,Ahmed Sheikh,2025-06-15,500000,Hawala\n"
    )
    files = {"file": ("hawala_fin.csv", csv_content, "text/csv")}
    data = {"source_type": "financial"}

    # Mock Neo4j responses for alert rules.
    # We must patch alerts.rules.run_query (the local reference) rather than
    # mock_neo4j.run_query, because `from db.neo4j import run_query` binds at
    # import time.
    hawala_row = {
        "sender_id": "c-1_PERSON_ravi_kumar",
        "sender": "Ravi Kumar",
        "receiver_id": "c-1_PERSON_ahmed_sheikh",
        "receiver": "Ahmed Sheikh",
        "amount": 500000,
        "date": "2025-06-15",
    }

    async def selective_run_query(cypher, params=None):
        if params is None:
            params = {}
        if "transaction_type = 'Hawala'" in cypher:
            return [hawala_row]
        return []

    with patch("alerts.rules.run_query", new_callable=AsyncMock, side_effect=selective_run_query), \
         patch("graph.analytics.compute_centrality", new_callable=AsyncMock), \
         patch("graph.analytics.detect_communities", new_callable=AsyncMock), \
         patch("graph.analytics.score_anomalies", new_callable=AsyncMock), \
         patch("graph.analytics.run_cross_case_scan_all", new_callable=AsyncMock):
        resp = await client.post("/api/cases/c-1/upload", files=files, data=data, headers=headers)
        assert resp.status_code == 200

        # Wait for background task
        await asyncio.sleep(1.5)

    # Fetch alerts (outside the patch context so the GET endpoint works normally)
    resp = await client.get("/api/cases/c-1/alerts", headers=headers)
    assert resp.status_code == 200
    alerts = resp.json()

    hawala_alerts = [a for a in alerts if a["alert_type"] == "hawala"]
    assert len(hawala_alerts) >= 1, f"Expected hawala alert, got: {alerts}"
    alert = hawala_alerts[0]
    assert "Ravi Kumar" in alert["title"]
    assert alert["severity"] == "HIGH"


# ──────────────── 3. Alert persistence survives "reload" ────────────────

@pytest.mark.asyncio
async def test_alert_persisted_in_sqlite():
    """Create an alert via the service, then directly query SQLite to verify."""
    from alerts.service import create_alert

    alert = await create_alert("c-1", {
        "severity": "MEDIUM",
        "title": "Test persistence alert",
        "description": "This should survive a restart",
        "entity_ids": ["node_1"],
        "alert_type": "test_persist",
    })
    assert alert is not None

    # Directly query the database
    from sqlalchemy.future import select
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Alert).where(Alert.alert_type == "test_persist")
        )
        row = result.scalars().first()
        assert row is not None
        assert row.title == "Test persistence alert"
        assert row.viewed is False
        assert json.loads(row.entity_ids_json) == ["node_1"]


# ──────────────── 4. Alert de-duplication ────────────────

@pytest.mark.asyncio
async def test_alert_deduplication():
    """Creating the same alert twice should only produce one row."""
    from alerts.service import create_alert

    data = {
        "severity": "HIGH",
        "title": "Duplicate test",
        "description": "Should not duplicate",
        "entity_ids": ["dup_node_a", "dup_node_b"],
        "alert_type": "dedup_test",
    }

    first = await create_alert("c-1", data)
    assert first is not None

    second = await create_alert("c-1", data)
    assert second is None  # duplicate skipped

    # Verify only one exists
    from sqlalchemy.future import select
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Alert).where(Alert.alert_type == "dedup_test", Alert.case_id == "c-1")
        )
        rows = result.scalars().all()
        assert len(rows) == 1


# ──────────────── 5. Graph endpoint case ownership ────────────────

@pytest.mark.asyncio
async def test_graph_endpoint_ownership_403(client):
    """BADGE001 investigator cannot access c-other (owned by BADGE002)."""
    token = await get_token(client, "BADGE001", "password123")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/cases/c-other/graph", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_graph_endpoint_supervisor_access(client):
    """Supervisor BADGE000 can access any case."""
    token = await get_token(client, "BADGE000", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/cases/c-other/graph", headers=headers)
    assert resp.status_code == 200


# ──────────────── 6. Alert endpoint case ownership ────────────────

@pytest.mark.asyncio
async def test_alert_endpoint_ownership_403(client):
    """BADGE001 investigator cannot access alerts for c-other."""
    token = await get_token(client, "BADGE001", "password123")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/cases/c-other/alerts", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_alert_endpoint_supervisor_access(client):
    """Supervisor can access any case's alerts."""
    token = await get_token(client, "BADGE000", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/cases/c-other/alerts", headers=headers)
    assert resp.status_code == 200


# ──────────────── 7. case_id=all restricted to supervisors ────────────────

@pytest.mark.asyncio
async def test_graph_all_cases_investigator_403(client):
    """Investigators must not use case_id=all."""
    token = await get_token(client, "BADGE001", "password123")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/cases/all/graph", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_graph_all_cases_supervisor_ok(client):
    """Supervisors can use case_id=all."""
    token = await get_token(client, "BADGE000", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/cases/all/graph", headers=headers)
    assert resp.status_code == 200


# ──────────────── 8. Graph Filters & Validation ────────────────

@pytest.mark.asyncio
async def test_graph_filters_params(client):
    """Test that graph filters are correctly passed to Neo4j query parameters."""
    token = await get_token(client, "BADGE001", "password123")
    headers = {"Authorization": f"Bearer {token}"}

    with patch("graph.router.run_query", new_callable=AsyncMock, return_value=[]) as mock_rq:
        # Test entity_types
        resp = await client.get("/api/cases/c-1/graph?entity_types=Person,Phone", headers=headers)
        assert resp.status_code == 200
        # run_query is called twice (nodes, edges)
        assert mock_rq.call_args_list[0][0][1]["types"] == ["PERSON", "PHONE"]
        assert mock_rq.call_args_list[1][0][1]["types"] == ["PERSON", "PHONE"]
        
        mock_rq.reset_mock()

        # Test community_id
        resp = await client.get("/api/cases/c-1/graph?community_id=42", headers=headers)
        assert resp.status_code == 200
        assert mock_rq.call_args_list[0][0][1]["community_id"] == 42
        assert mock_rq.call_args_list[1][0][1]["community_id"] == 42
        
        mock_rq.reset_mock()

        # Test dates
        resp = await client.get("/api/cases/c-1/graph?date_from=2025-01-01&date_to=2025-12-31", headers=headers)
        assert resp.status_code == 200
        assert mock_rq.call_args_list[0][0][1]["date_from"] == "2025-01-01"
        assert mock_rq.call_args_list[0][0][1]["date_to"] == "2025-12-31"

@pytest.mark.asyncio
async def test_alert_viewed_wrong_case_404(client):
    """Marking an alert viewed for the wrong case should return 404."""
    from alerts.service import create_alert
    
    alert = await create_alert("c-other", {
        "severity": "LOW",
        "title": "Wrong case alert",
        "description": "desc",
        "entity_ids": [],
        "alert_type": "wrong_case",
    })
    
    token = await get_token(client, "BADGE001", "password123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # BADGE001 tries to mark it viewed on c-1 (which they own) but the alert is in c-other
    resp = await client.patch(f"/api/cases/c-1/alerts/{alert.id}/viewed", headers=headers)
    assert resp.status_code == 404
