import sys
import os

# Ensure backend dir is on sys.path for module resolution
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set test database URL before importing anything
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///test_criminetwork.db"

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from fastapi import APIRouter

# Create real APIRouter instances for the modules that main.py includes
_nlp_router = APIRouter(prefix="/api/nlp", tags=["nlp"])
_graph_router = APIRouter(prefix="/api/graph", tags=["graph"])
_alerts_router = APIRouter(prefix="/api/alerts", tags=["alerts"])
_reports_router = APIRouter(prefix="/api/reports", tags=["reports"])
_copilot_router = APIRouter(prefix="/api/copilot", tags=["copilot"])

# Mock NLP module
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

# Mock graph module
mock_graph = MagicMock()
mock_graph.router = _graph_router
sys.modules['graph'] = MagicMock()
sys.modules['graph.router'] = mock_graph
sys.modules['graph.builder'] = MagicMock()
sys.modules['graph.algorithms'] = MagicMock()
sys.modules['graph.algorithms.graphsage'] = MagicMock()
sys.modules['graph.algorithms.louvain_communities'] = MagicMock()

# Mock alerts module
mock_alerts = MagicMock()
mock_alerts.router = _alerts_router
sys.modules['alerts'] = MagicMock()
sys.modules['alerts.router'] = mock_alerts

# Mock reports module
mock_reports = MagicMock()
mock_reports.router = _reports_router
sys.modules['reports'] = MagicMock()
sys.modules['reports.router'] = mock_reports

# Mock copilot module
mock_copilot = MagicMock()
mock_copilot.router = _copilot_router
sys.modules['copilot'] = MagicMock()
sys.modules['copilot.router'] = mock_copilot

# Mock db.neo4j
mock_neo4j = MagicMock()
mock_neo4j.create_schema = AsyncMock()
sys.modules['db.neo4j'] = mock_neo4j

# Mock db.chromadb
sys.modules['db.chromadb'] = MagicMock()

# Mock training
sys.modules['training'] = MagicMock()

from httpx import AsyncClient, ASGITransport
import shutil

from main import app
from db.database import engine, Base, AsyncSessionLocal
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


# ──────────────── Auth Tests ────────────────

@pytest.mark.asyncio
async def test_login_json_success(client):
    resp = await client.post("/api/auth/login", json={
        "badge_id": "BADGE001",
        "password": "password123"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert "access_token" in data
    assert data["role"] == "INVESTIGATOR"
    assert data["badge_id"] == "BADGE001"
    assert data["name"] == "Inspector Dev"


@pytest.mark.asyncio
async def test_login_form_success(client):
    """Frontend sends OAuth2 form data with username/password."""
    resp = await client.post("/api/auth/login",
        data={"username": "BADGE001", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "INVESTIGATOR"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    resp = await client.post("/api/auth/login", json={
        "badge_id": "BADGE001",
        "password": "wrong"
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    resp = await client.post("/api/auth/login", json={
        "badge_id": "NONEXISTENT",
        "password": "password123"
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_no_token(client):
    resp = await client.get("/api/cases")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_supervisor_login(client):
    resp = await client.post("/api/auth/login", json={
        "badge_id": "BADGE000",
        "password": "admin123"
    })
    assert resp.status_code == 200
    assert resp.json()["role"] == "SUPERVISOR"


# ──────────────── Cases Tests ────────────────

@pytest.mark.asyncio
async def test_investigator_sees_own_cases(client):
    token = await get_token(client, "BADGE001", "password123")
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/cases", headers=headers)
    assert resp.status_code == 200
    cases = resp.json()
    for case in cases:
        assert case["assigned_to"] == "BADGE001"


@pytest.mark.asyncio
async def test_supervisor_sees_all_cases(client):
    token = await get_token(client, "BADGE000", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/cases", headers=headers)
    assert resp.status_code == 200
    cases = resp.json()
    assert len(cases) >= 2  # At least the two demo cases


@pytest.mark.asyncio
async def test_create_case(client):
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post("/api/cases", json={
        "name": "Test Case Alpha",
        "fir_number": "FIR-TEST-001",
        "case_type": "organized_crime",
        "description": "A test case"
    }, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Case Alpha"
    assert data["title"] == "Test Case Alpha"  # Frontend compat
    assert data["status"] == "pending_data"


@pytest.mark.asyncio
async def test_update_case(client):
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.patch("/api/cases/c-1", json={
        "status": "active"
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"


@pytest.mark.asyncio
async def test_get_case_404(client):
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/cases/nonexistent", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_case_investigator_forbidden(client):
    token = await get_token(client, "BADGE001", "password123")
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.delete("/api/cases/c-2", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_case_supervisor(client):
    # First create a throwaway case
    token_inv = await get_token(client, "BADGE001", "password123")
    resp = await client.post("/api/cases", json={
        "name": "Delete Me",
        "fir_number": "FIR-DEL",
    }, headers={"Authorization": f"Bearer {token_inv}"})
    case_id = resp.json()["id"]

    token_sup = await get_token(client, "BADGE000", "admin123")
    headers = {"Authorization": f"Bearer {token_sup}"}
    resp = await client.delete(f"/api/cases/{case_id}", headers=headers)
    assert resp.status_code == 204


# ──────────────── Cleaner Tests ────────────────

@pytest.mark.asyncio
async def test_normalize_phone():
    from ingestion.cleaner import normalize_phone
    assert normalize_phone("9876543210") == "+919876543210"
    assert normalize_phone("919876543210") == "+919876543210"
    assert normalize_phone("+919876543210") == "+919876543210"
    assert normalize_phone("09876543210") == "+919876543210"
    assert normalize_phone("") == ""


@pytest.mark.asyncio
async def test_normalize_date():
    from ingestion.cleaner import normalize_date
    assert normalize_date("25/12/2025") == "2025-12-25"
    assert normalize_date("25-12-2025") == "2025-12-25"
    assert normalize_date("2025-12-25") == "2025-12-25"
    assert normalize_date("garbage") == ""
    assert normalize_date("") == ""


# ──────────────── Parser Tests ────────────────

@pytest.mark.asyncio
async def test_cdr_parser_handles_missing_columns(tmp_path):
    csv_file = tmp_path / "bad_cdr.csv"
    csv_file.write_text("col_a,col_b\n1,2\n")
    from ingestion.parsers.cdr_parser import parse_cdr
    result = parse_cdr(str(csv_file))
    assert "records" in result
    # Should not crash, records may have empty fields


@pytest.mark.asyncio
async def test_cdr_parser_normalizes_phones(tmp_path):
    csv_file = tmp_path / "cdr.csv"
    csv_file.write_text("caller_number,callee_number,call_date,duration_seconds\n9876543210,8765432109,25/12/2025,120\n")
    from ingestion.parsers.cdr_parser import parse_cdr
    result = parse_cdr(str(csv_file))
    assert len(result["records"]) == 1
    assert result["records"][0]["caller"] == "+919876543210"
    assert result["records"][0]["callee"] == "+918765432109"


@pytest.mark.asyncio
async def test_financial_parser_handles_malformed(tmp_path):
    csv_file = tmp_path / "bad_fin.csv"
    csv_file.write_text("random_col\nfoo\n")
    from ingestion.parsers.financial_parser import parse_financial
    result = parse_financial(str(csv_file))
    assert "records" in result


@pytest.mark.asyncio
async def test_social_parser_confidence(tmp_path):
    csv_file = tmp_path / "social.csv"
    csv_file.write_text("platform,username,content,date\ntwitter,user1,hello world,2025-01-01\n")
    from ingestion.parsers.social_parser import parse_social
    result = parse_social(str(csv_file))
    assert len(result["records"]) == 1
    assert result["records"][0]["confidence"] == 0.45


# ──────────────── Upload / Job Tests ────────────────

@pytest.mark.asyncio
async def test_upload_invalid_source_type(client):
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("test.csv", b"a,b\n1,2", "text/csv")}
    data = {"source_type": "invalid_type"}
    resp = await client.post("/api/cases/c-1/upload", files=files, data=data, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_upload_invalid_extension(client):
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("test.exe", b"MZ", "application/octet-stream")}
    data = {"source_type": "cdr"}
    resp = await client.post("/api/cases/c-1/upload", files=files, data=data, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_upload_nonexistent_case(client):
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("test.csv", b"a,b\n1,2", "text/csv")}
    data = {"source_type": "cdr"}
    resp = await client.post("/api/cases/nonexistent/upload", files=files, data=data, headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_upload_and_job_lifecycle(client):
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Upload a CDR file
    csv_content = b"caller_number,callee_number,call_date,duration_seconds\n9876543210,8765432109,25/12/2025,120\n"
    files = {"file": ("test_cdr.csv", csv_content, "text/csv")}
    data = {"source_type": "cdr"}
    resp = await client.post("/api/cases/c-1/upload", files=files, data=data, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "queued"
    job_id = body["job_id"]

    # Check status
    resp = await client.get(f"/api/cases/c-1/upload/status/{job_id}", headers=headers)
    assert resp.status_code == 200
    assert "status" in resp.json()


@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
