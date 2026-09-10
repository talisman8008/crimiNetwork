import pytest
from sqlalchemy import delete, select
from db.database import AsyncSessionLocal
from db.models import Case, MergeReview
from nlp import entity_resolution


@pytest.fixture
async def case_id():
    value = "case_under_score_123"

    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(MergeReview).where(MergeReview.case_id == value)
        )
        await db.execute(delete(Case).where(Case.id == value))
        db.add(
            Case(
                id=value,
                name="Entity resolution test case",
            )
        )
        await db.commit()

    yield value

    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(MergeReview).where(MergeReview.case_id == value)
        )
        await db.execute(delete(Case).where(Case.id == value))
        await db.commit()


@pytest.fixture
def people(case_id):
    return [
        {
            "id": f"{case_id}_PERSON_John_Doe",
            "name": "John Doe",
            "case_id": case_id,
            "sources": ["fir_1"],
            "phones": ["9999999999"],
            "addresses": ["Delhi"],
            "appearance_count": 1,
        },
        {
            "id": f"{case_id}_PERSON_Johnathan_Doe",
            "name": "Johnathan Doe",
            "case_id": case_id,
            "sources": ["fir_2"],
            "phones": ["9999999999"],
            "addresses": ["Delhi"],
            "appearance_count": 1,
        },
    ]


@pytest.fixture
def mock_embeddings(monkeypatch):
    monkeypatch.setattr(
        entity_resolution,
        "get_embedding",
        lambda _name: [1.0, 0.0, 0.0],
    )
    monkeypatch.setattr(
        entity_resolution,
        "cosine_similarity",
        lambda _first, _second: 0.99,
    )


@pytest.mark.asyncio
async def test_approve_resolves_underscore_heavy_entity_ids(
    monkeypatch,
    case_id,
    people,
    mock_embeddings,
):
    import db.neo4j

    entity_a = people[0]
    entity_b = people[1]
    pair_id = f"{entity_a['id']}_{entity_b['id']}"
    calls = []

    async def fake_run_query(cypher, params=None):
        calls.append((cypher, params))

        if "RETURN p" in cypher:
            return [{"p": entity_a}, {"p": entity_b}]

        if "apoc.refactor.mergeNodes" in cypher:
            assert params["entity_a_id"] == entity_a["id"]
            assert params["entity_b_id"] == entity_b["id"]
            return [{"entity_id": entity_a["id"]}]

        raise AssertionError(f"Unexpected Cypher query: {cypher}")

    monkeypatch.setattr(db.neo4j, "run_query", fake_run_query)

    surviving_id = await entity_resolution.approve_merge(pair_id, case_id)

    assert surviving_id == entity_a["id"]
    assert all("split(" not in cypher for cypher, _ in calls)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MergeReview).where(
                MergeReview.case_id == case_id,
                MergeReview.pair_id == pair_id,
            )
        )
        review = result.scalar_one()

    assert review.entity_a_id == entity_a["id"]
    assert review.entity_b_id == entity_b["id"]
    assert review.decision == "merged"


@pytest.mark.asyncio
async def test_rejected_pair_does_not_reappear_after_new_db_session(
    monkeypatch,
    case_id,
    people,
    mock_embeddings,
):
    import db.neo4j

    entity_a = people[0]
    entity_b = people[1]
    pair_id = f"{entity_a['id']}_{entity_b['id']}"

    async def fake_run_query(cypher, params=None):
        assert "RETURN p" in cypher
        return [{"p": entity_a}, {"p": entity_b}]

    monkeypatch.setattr(db.neo4j, "run_query", fake_run_query)

    await entity_resolution.reject_merge(pair_id, case_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MergeReview).where(
                MergeReview.case_id == case_id,
                MergeReview.pair_id == pair_id,
            )
        )
        assert result.scalar_one().decision == "rejected"

    candidates = await entity_resolution.find_duplicate_candidates(case_id)

    assert candidates == []


@pytest.mark.asyncio
async def test_merge_preserves_called_relationship_type(
    monkeypatch,
    case_id,
    people,
    mock_embeddings,
):
    import db.neo4j

    entity_a = people[0]
    entity_b = people[1]
    pair_id = f"{entity_a['id']}_{entity_b['id']}"
    relationships = [
        {
            "from": entity_b["id"],
            "type": "CALLED",
            "to": f"{case_id}_PERSON_Witness",
        }
    ]

    async def fake_run_query(cypher, params=None):
        if "RETURN p" in cypher:
            return [{"p": entity_a}, {"p": entity_b}]

        if "apoc.refactor.mergeNodes" in cypher:
            assert "mergeRels: true" in cypher
            assert "RELATED_TO" not in cypher

            for relationship in relationships:
                if relationship["from"] == entity_b["id"]:
                    relationship["from"] = entity_a["id"]

            return [{"entity_id": entity_a["id"]}]

        raise AssertionError(f"Unexpected Cypher query: {cypher}")

    monkeypatch.setattr(db.neo4j, "run_query", fake_run_query)

    await entity_resolution.approve_merge(pair_id, case_id)

    assert relationships == [
        {
            "from": entity_a["id"],
            "type": "CALLED",
            "to": f"{case_id}_PERSON_Witness",
        }
    ]