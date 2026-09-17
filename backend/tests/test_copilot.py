"""
Tests for the Copilot RAG pipeline (Phases 9-13).

Covers:
- per-case isolation: a query for one case can never surface another case's
  entities, sources, or text (per-case Chroma collection + Neo4j case_id
  parameterization are both asserted)
- case access control on the endpoint: 404 for missing cases, 403 for users
  who are neither assigned to the case nor supervisors, and access for the
  assigned investigator and for supervisors
- the structured response contract (answer, sources, confidence,
  referenced_entities), with sources/entities populated from real retrieved
  metadata and confidence derived from retrieval
- phone-call (CDR) retrieval
- financial (TRANSACTED_WITH) retrieval
- source metadata is correctly structured in response
- no cross-case leakage across all data types

All external services are mocked: the LLM (copilot.rag.generate_explanation),
Neo4j (copilot.retriever.run_query), and ChromaDB
(copilot.retriever.get_chroma_client / search_similar_entities). The access
check runs against a fake AsyncSessionLocal session.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from copilot.retriever import gather_context
from copilot.router import router
from dependencies import get_current_user

pytestmark = pytest.mark.asyncio

CASE_A = "A"
CASE_B = "B"
CASE_EMPTY = "C"

INVESTIGATOR_A_BADGE = "B111"  # assigned to CASE_A
INVESTIGATOR_B_BADGE = "B222"  # assigned to CASE_B
OUTSIDER_BADGE = "B999"        # assigned to nothing
SUPERVISOR_BADGE = "B000"


# --------------------------------------------------------------------------
# Fakes: ChromaDB
# --------------------------------------------------------------------------

class _FakeCollection:
    """Just enough of the Chroma collection API the retriever uses."""

    def __init__(self, records):
        self._records = records  # [{"document": str, "metadata": dict}]

    def count(self):
        return len(self._records)

    def query(self, query_texts, n_results, where):
        matched = [
            record
            for record in self._records
            if where is None or record["metadata"].get("type") == where.get("type")
        ]
        matched = matched[:n_results]
        return {
            "documents": [[record["document"] for record in matched]],
            "metadatas": [[record["metadata"] for record in matched]],
        }


class _FakeChromaClient:
    """
    get_collection is keyed by exact collection name and records every
    request, so any code path that opens another case's collection shows up
    in `requested`.
    """

    def __init__(self, collections):
        self._collections = collections  # name -> _FakeCollection
        self.requested = []

    def get_collection(self, name):
        self.requested.append(name)
        if name not in self._collections:
            raise ValueError(f"Collection {name!r} does not exist")
        return self._collections[name]


_CHROMA_RECORDS_A = [
    {
        "document": "Alice met Bob at the warehouse on 5th Street to discuss the shipment.",
        "metadata": {
            "type": "text_chunk",
            "source_file": "report_a.pdf",
            "source_type": "fir",
            "entity_names_json": json.dumps(["Alice", "Bob"]),
        },
    },
    {
        "document": "Bob transferred $5,000 to Alice from the harbor account.",
        "metadata": {
            "type": "text_chunk",
            "source_file": "ledger_a.pdf",
            "source_type": "financial",
            "entity_names_json": json.dumps(["Bob", "Alice"]),
        },
    },
]

_CHROMA_RECORDS_B = [
    {
        "document": "Carol was seen with Dave at the harbor on the night of the incident.",
        "metadata": {
            "type": "text_chunk",
            "source_file": "report_b.pdf",
            "source_type": "fir",
            "entity_names_json": json.dumps(["Carol", "Dave"]),
        },
    },
    {
        "document": "On 2026-06-10, +919876543210 called +918765432109 for 180 seconds at Delhi.",
        "metadata": {
            "type": "text_chunk",
            "source_file": "sample_cdr.csv",
            "source_type": "cdr",
            "source_row": 2,
            "date": "2026-06-10",
            "entity_names_json": json.dumps(["Dave", "Carol"]),
        },
    },
]


# --------------------------------------------------------------------------
# Fakes: Neo4j
# --------------------------------------------------------------------------

_GRAPH_ROWS_A = [
    {"name": "Alice", "rel": "KNOWS", "target": "Bob"},
    {"name": "Bob", "rel": "TRANSFERRED_MONEY_TO", "target": "Alice"},
]

_GRAPH_ROWS_B = [
    {"name": "Carol", "rel": "SEEN_WITH", "target": "Dave"},
    {"name": "Dave", "rel": "CALLED", "target": "Carol"},
]


# --------------------------------------------------------------------------
# Canned LLM answers
# --------------------------------------------------------------------------

ANSWER_A = (
    "Alice met Bob at the warehouse, and Bob later transferred money to "
    "Alice. [report_a.pdf]"
)
ANSWER_B = (
    "Carol was with Dave at the harbor, and Dave's phone pinged the harbor "
    "tower that night. [report_b.pdf]"
)
REFUSAL_ANSWER = "I do not have enough information in the case files to answer this."


# --------------------------------------------------------------------------
# Fixtures: swap out ChromaDB, Neo4j, and entity search
# --------------------------------------------------------------------------

@pytest.fixture
def chroma():
    client = _FakeChromaClient({
        f"case_{CASE_A}": _FakeCollection(_CHROMA_RECORDS_A),
        f"case_{CASE_B}": _FakeCollection(_CHROMA_RECORDS_B),
    })
    with patch("copilot.retriever.get_chroma_client", return_value=client):
        yield client


@pytest.fixture
def graph_calls():
    calls = []

    async def fake_run_query(cypher, params=None):
        # Only returns rows for the case_id actually passed in params, so a
        # missing/incorrect case filter yields nothing rather than leakage.
        calls.append({"cypher": cypher, "params": dict(params or {})})
        case_id = (params or {}).get("case_id")
        if case_id == CASE_A:
            return [dict(row) for row in _GRAPH_ROWS_A]
        if case_id == CASE_B:
            return [dict(row) for row in _GRAPH_ROWS_B]
        return []

    with patch("copilot.retriever.run_query", new=fake_run_query):
        yield calls


@pytest.fixture
def entity_search():
    def fake_search_similar_entities(query, case_id, top_k=5):
        records = {
            CASE_A: [
                {"entity": "Alice", "text": "Alice", "type": "Person"},
                {"entity": "Bob", "text": "Bob", "type": "Person"},
            ],
            CASE_B: [
                {"entity": "Carol", "text": "Carol", "type": "Person"},
                {"entity": "Dave", "text": "Dave", "type": "Person"},
            ],
        }
        return records.get(case_id, [])

    with patch("copilot.retriever.search_similar_entities", new=fake_search_similar_entities):
        yield


# --------------------------------------------------------------------------
# Helpers: app / auth / session / HTTP
# --------------------------------------------------------------------------

def _user(badge_id, role):
    return SimpleNamespace(badge_id=badge_id, role=role)


def _case(case_id, assigned_to):
    return SimpleNamespace(id=case_id, assigned_to=assigned_to)


class _FakeSession:
    """Stands in for AsyncSessionLocal(); execute() returns the given case."""

    def __init__(self, case):
        self._case = case

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, stmt):
        return SimpleNamespace(scalar_one_or_none=lambda: self._case)


def _make_app(user):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: user
    return app


async def _post_chat(app, case_id, query):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.post(
            f"/api/copilot/cases/{case_id}/chat", json={"query": query}
        )


# --------------------------------------------------------------------------
# Per-case isolation
# --------------------------------------------------------------------------

async def test_retrieval_is_scoped_to_the_requested_case(chroma, graph_calls, entity_search):
    """Case B's retrieval only touches case_B's collection and $case_id=B,
    and never surfaces Case A's entities, sources, or text."""
    retrieval = await gather_context("Who was involved?", CASE_B)

    # The only Chroma collection opened is Case B's own.
    assert chroma.requested == [f"case_{CASE_B}"]

    # Every Cypher call was parameterized with Case B's id.
    assert graph_calls, "expected at least one Neo4j query"
    assert all(call["params"]["case_id"] == CASE_B for call in graph_calls)

    # Nothing from Case A leaked into the retrieval result.
    assert "Alice" not in retrieval["entities"]
    assert "Bob" not in retrieval["entities"]
    source_files = [s["source_file"] for s in retrieval["sources"]]
    assert "report_a.pdf" not in source_files
    assert "ledger_a.pdf" not in source_files
    assert all("warehouse" not in chunk["text"] for chunk in retrieval["chunks"])
    assert all("Alice" not in chunk["text"] for chunk in retrieval["chunks"])

    # Case B's own data came through.
    assert set(retrieval["entities"]) == {"Carol", "Dave"}
    assert set(s["source_file"] for s in retrieval["sources"]) == {"report_b.pdf", "sample_cdr.csv"}
    assert len(retrieval["graph_facts"]) == 2


async def test_retrieval_for_case_with_no_data_returns_nothing(chroma, graph_calls, entity_search):
    """A case with no data yields empty retrieval, not another case's data."""
    retrieval = await gather_context("Anything?", CASE_EMPTY)

    assert chroma.requested == [f"case_{CASE_EMPTY}"]
    assert retrieval["chunks"] == []
    assert retrieval["sources"] == []
    assert retrieval["entities"] == []
    assert retrieval["graph_facts"] == []


async def test_case_b_chat_does_not_leak_case_a_data(chroma, graph_calls, entity_search):
    """End to end: chatting with Case B never returns Case A's entities or
    source text, and the structured fields are populated from Case B only."""
    user = _user(INVESTIGATOR_B_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_B, INVESTIGATOR_B_BADGE)),
    ), patch(
        "copilot.rag.generate_explanation", new=AsyncMock(return_value=ANSWER_B)
    ):
        response = await _post_chat(app, CASE_B, "Who was at the harbor?")

    assert response.status_code == 200
    body = response.json()

    # Case A's entities, sources, and text must not appear anywhere.
    assert "Alice" not in body["referenced_entities"]
    assert "Bob" not in body["referenced_entities"]
    source_files = [s["source_file"] for s in body["sources"]]
    assert "report_a.pdf" not in source_files
    assert "ledger_a.pdf" not in source_files
    assert "Alice" not in body["answer"]
    assert "warehouse" not in body["answer"]

    # The answer is grounded only in Case B's retrieved metadata.
    assert body["referenced_entities"] == ["Carol", "Dave"]
    assert "report_b.pdf" in [s["source_file"] for s in body["sources"]]

    # Retrieval never left Case B's scope.
    assert chroma.requested == [f"case_{CASE_B}"]
    assert all(call["params"]["case_id"] == CASE_B for call in graph_calls)


# --------------------------------------------------------------------------
# Case access control
# --------------------------------------------------------------------------

async def test_unassigned_investigator_gets_403_and_no_retrieval():
    """An investigator who is not assigned to the case (and is not a
    supervisor) is rejected before any retrieval or LLM work runs."""
    user = _user(OUTSIDER_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    gather = AsyncMock()
    llm = AsyncMock()
    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_A, INVESTIGATOR_A_BADGE)),
    ), patch("copilot.rag.gather_context", new=gather), patch(
        "copilot.rag.generate_explanation", new=llm
    ):
        response = await _post_chat(app, CASE_A, "Who is Alice?")

    assert response.status_code == 403
    gather.assert_not_awaited()
    llm.assert_not_awaited()


async def test_missing_case_returns_404():
    user = _user(INVESTIGATOR_A_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    gather = AsyncMock()
    with patch(
        "copilot.router.AsyncSessionLocal", return_value=_FakeSession(None)
    ), patch("copilot.rag.gather_context", new=gather):
        response = await _post_chat(app, "MISSING", "Who is Alice?")

    assert response.status_code == 404
    gather.assert_not_awaited()


async def test_assigned_investigator_gets_through(chroma, graph_calls, entity_search):
    user = _user(INVESTIGATOR_A_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_A, INVESTIGATOR_A_BADGE)),
    ), patch(
        "copilot.rag.generate_explanation", new=AsyncMock(return_value=ANSWER_A)
    ):
        response = await _post_chat(app, CASE_A, "Who is Alice?")

    assert response.status_code == 200
    assert response.json()["answer"] == ANSWER_A


async def test_supervisor_gets_through_even_when_unassigned(chroma, graph_calls, entity_search):
    user = _user(SUPERVISOR_BADGE, "SUPERVISOR")
    app = _make_app(user)

    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_A, INVESTIGATOR_A_BADGE)),
    ), patch(
        "copilot.rag.generate_explanation", new=AsyncMock(return_value=ANSWER_A)
    ):
        response = await _post_chat(app, CASE_A, "Summarize the connections.")

    assert response.status_code == 200
    assert response.json()["answer"] == ANSWER_A


# --------------------------------------------------------------------------
# Structured response contract
# --------------------------------------------------------------------------

async def test_structured_response_is_grounded_in_retrieved_metadata(chroma, graph_calls, entity_search):
    """All four structured keys are present, and sources/entities come from
    the retrieved metadata rather than from the model."""
    user = _user(INVESTIGATOR_A_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_A, INVESTIGATOR_A_BADGE)),
    ), patch(
        "copilot.rag.generate_explanation", new=AsyncMock(return_value=ANSWER_A)
    ):
        response = await _post_chat(app, CASE_A, "Who is Alice?")

    assert response.status_code == 200
    body = response.json()

    assert {"answer", "sources", "confidence", "referenced_entities"} <= set(body)
    assert isinstance(body["answer"], str)
    assert isinstance(body["confidence"], float)
    assert isinstance(body["sources"], list)
    assert isinstance(body["referenced_entities"], list)

    # Sources are now structured objects with source_file key.
    source_files = set(s["source_file"] for s in body["sources"])
    assert source_files == {"report_a.pdf", "ledger_a.pdf"}

    # Entities populated from the real retrieved metadata.
    assert set(body["referenced_entities"]) == {"Alice", "Bob"}

    # Confidence is derived from retrieval and is in valid range.
    assert 0.0 <= body["confidence"] <= 1.0


async def test_refusal_yields_zero_confidence_and_no_sources(chroma, graph_calls, entity_search):
    """When the model refuses (case files lack the answer), nothing is
    reported as grounding the answer."""
    user = _user(INVESTIGATOR_A_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_A, INVESTIGATOR_A_BADGE)),
    ), patch(
        "copilot.rag.generate_explanation", new=AsyncMock(return_value=REFUSAL_ANSWER)
    ):
        response = await _post_chat(app, CASE_A, "What is the suspect's favorite color?")

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == REFUSAL_ANSWER
    assert body["sources"] == []
    assert body["referenced_entities"] == []
    assert body["confidence"] == 0.0


# --------------------------------------------------------------------------
# Phone-call (CDR) retrieval
# --------------------------------------------------------------------------

async def test_phone_call_retrieval(chroma, graph_calls, entity_search):
    """CDR evidence is retrievable and produces structured source metadata
    with source_type, source_row, and date."""
    user = _user(INVESTIGATOR_B_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    answer_cdr = "Dave called Carol on 2026-06-10. [sample_cdr.csv]"
    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_B, INVESTIGATOR_B_BADGE)),
    ), patch(
        "copilot.rag.generate_explanation", new=AsyncMock(return_value=answer_cdr)
    ):
        response = await _post_chat(app, CASE_B, "Who did Dave call?")

    assert response.status_code == 200
    body = response.json()

    assert "Dave" in body["referenced_entities"]
    assert "Carol" in body["referenced_entities"]

    cdr_sources = [s for s in body["sources"] if s["source_file"] == "sample_cdr.csv"]
    assert len(cdr_sources) >= 1
    cdr_src = cdr_sources[0]
    assert cdr_src["source_type"] == "cdr"
    assert cdr_src["source_row"] == 2
    assert cdr_src["date"] == "2026-06-10"


# --------------------------------------------------------------------------
# Financial retrieval
# --------------------------------------------------------------------------

async def test_financial_retrieval(chroma, graph_calls, entity_search):
    """Financial evidence (TRANSFERRED_MONEY_TO) is retrievable via both
    graph facts and Chroma text chunks."""
    user = _user(INVESTIGATOR_A_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    answer_fin = "Bob transferred $5,000 to Alice. [ledger_a.pdf]"
    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_A, INVESTIGATOR_A_BADGE)),
    ), patch(
        "copilot.rag.generate_explanation", new=AsyncMock(return_value=answer_fin)
    ):
        response = await _post_chat(app, CASE_A, "Who transferred money?")

    assert response.status_code == 200
    body = response.json()

    assert "Bob" in body["referenced_entities"]
    assert "Alice" in body["referenced_entities"]

    fin_sources = [s for s in body["sources"] if s["source_file"] == "ledger_a.pdf"]
    assert len(fin_sources) >= 1
    assert fin_sources[0]["source_type"] == "financial"


# --------------------------------------------------------------------------
# Source metadata structure
# --------------------------------------------------------------------------

async def test_source_metadata_is_structured(chroma, graph_calls, entity_search):
    """Each source object in the response contains the required metadata
    keys: source_file, source_type, excerpt."""
    user = _user(INVESTIGATOR_B_BADGE, "INVESTIGATOR")
    app = _make_app(user)

    answer = "Carol was with Dave at the harbor. [report_b.pdf]"
    with patch(
        "copilot.router.AsyncSessionLocal",
        return_value=_FakeSession(_case(CASE_B, INVESTIGATOR_B_BADGE)),
    ), patch(
        "copilot.rag.generate_explanation", new=AsyncMock(return_value=answer)
    ):
        response = await _post_chat(app, CASE_B, "Where was Carol?")

    assert response.status_code == 200
    body = response.json()

    for src in body["sources"]:
        assert "source_file" in src, "source object missing source_file"
        assert "source_type" in src, "source object missing source_type"
        assert "excerpt" in src, "source object missing excerpt"


# --------------------------------------------------------------------------
# Cross-case leakage (comprehensive)
# --------------------------------------------------------------------------

async def test_no_cross_case_leakage_in_entities_or_sources(chroma, graph_calls, entity_search):
    """Querying Case A must never surface Case B's entities or source files,
    and vice versa."""
    # Query Case A
    retrieval_a = await gather_context("Tell me everything", CASE_A)
    # Query Case B
    retrieval_b = await gather_context("Tell me everything", CASE_B)

    # Case A must not contain Case B data
    assert "Carol" not in retrieval_a["entities"]
    assert "Dave" not in retrieval_a["entities"]
    a_source_files = [s["source_file"] for s in retrieval_a["sources"]]
    assert "report_b.pdf" not in a_source_files
    assert "sample_cdr.csv" not in a_source_files

    # Case B must not contain Case A data
    assert "Alice" not in retrieval_b["entities"]
    assert "Bob" not in retrieval_b["entities"]
    b_source_files = [s["source_file"] for s in retrieval_b["sources"]]
    assert "report_a.pdf" not in b_source_files
    assert "ledger_a.pdf" not in b_source_files
