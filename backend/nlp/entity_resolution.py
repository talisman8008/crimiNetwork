"""
Phase 7 -- Entity Resolution Queue.

Finds duplicate person entities across FIRs by embedding similarity,
and provides merge/reject endpoints for human review.
NEVER auto-merges -- always requires human confirmation.
"""

from dataclasses import dataclass
from typing import List, Tuple

from sqlalchemy import select

from config import SIMILARITY_THRESHOLD
from db.database import AsyncSessionLocal
from db.models import MergeReview

from .embeddings import cosine_similarity, get_embedding

AUTO_SUGGEST_THRESHOLD = 0.90


@dataclass
class EntitySummary:
    id: str
    name: str
    entity_type: str
    sources: List[str]
    phone_numbers: List[str]
    addresses: List[str]
    appearance_count: int


@dataclass
class MergePair:
    pair_id: str
    entity_a: EntitySummary
    entity_b: EntitySummary
    similarity_score: float
    suggested_action: str  # "merge" or "review"


def _build_pair_id(entity_a_id: str, entity_b_id: str) -> str:
    return f"{entity_a_id}_{entity_b_id}"


def _to_entity_summary(person: dict) -> EntitySummary:
    return EntitySummary(
        id=person["id"],
        name=person["name"],
        entity_type="PERSON",
        sources=person.get("sources", []),
        phone_numbers=person.get("phones", []),
        addresses=person.get("addresses", []),
        appearance_count=person.get("appearance_count", 1),
    )


async def _get_pair_entities(
    pair_id: str,
    case_id: str,
) -> Tuple[dict, dict]:
    """
    Resolve the pair by comparing complete generated queue keys.

    Entity IDs contain underscores, so pair_id must never be split.
    """
    from db.neo4j import run_query

    persons = await run_query(
        "MATCH (p:Person {case_id: $case_id}) RETURN p",
        {"case_id": case_id},
    )
    person_list = [person["p"] for person in persons]

    matches = []

    for i in range(len(person_list)):
        for j in range(i + 1, len(person_list)):
            entity_a = person_list[i]
            entity_b = person_list[j]

            if _build_pair_id(entity_a["id"], entity_b["id"]) == pair_id:
                matches.append((entity_a, entity_b))

    if not matches:
        raise ValueError("Merge pair not found for this case")

    if len(matches) > 1:
        raise ValueError(
            "Merge pair is ambiguous. Submit entity_a_id and entity_b_id "
            "from the queue response."
        )

    return matches[0]


async def _get_existing_review(
    pair_id: str,
    case_id: str,
) -> MergeReview | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MergeReview).where(
                MergeReview.case_id == case_id,
                MergeReview.pair_id == pair_id,
            )
        )
        return result.scalar_one_or_none()


async def _save_review(
    pair_id: str,
    case_id: str,
    entity_a_id: str,
    entity_b_id: str,
    decision: str,
    similarity: float | None = None,
) -> MergeReview:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MergeReview).where(
                MergeReview.case_id == case_id,
                MergeReview.pair_id == pair_id,
            )
        )
        review = result.scalar_one_or_none()

        if review is None:
            review = MergeReview(
                case_id=case_id,
                pair_id=pair_id,
                entity_a_id=entity_a_id,
                entity_b_id=entity_b_id,
                decision=decision,
                similarity=similarity,
            )
            db.add(review)
        else:
            review.entity_a_id = entity_a_id
            review.entity_b_id = entity_b_id
            review.decision = decision
            review.similarity = similarity

        await db.commit()
        await db.refresh(review)

        return review


async def find_duplicate_candidates(case_id: str) -> List[MergePair]:
    """
    Fetch all PERSON entities for case, compute pairwise similarity,
    and return unreviewed pairs above the configured threshold.
    """
    from db.neo4j import run_query

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MergeReview.pair_id).where(
                MergeReview.case_id == case_id,
            )
        )
        reviewed_pair_ids = set(result.scalars().all())

    persons = await run_query(
        "MATCH (p:Person {case_id: $case_id}) RETURN p",
        {"case_id": case_id},
    )

    if len(persons) < 2:
        return []

    person_list = [person["p"] for person in persons]
    embeddings = {
        person["id"]: get_embedding(person["name"])
        for person in person_list
    }

    pairs = []

    for i in range(len(person_list)):
        for j in range(i + 1, len(person_list)):
            entity_a = person_list[i]
            entity_b = person_list[j]
            pair_id = _build_pair_id(entity_a["id"], entity_b["id"])

            if pair_id in reviewed_pair_ids:
                continue

            similarity = cosine_similarity(
                embeddings[entity_a["id"]],
                embeddings[entity_b["id"]],
            )

            if similarity < SIMILARITY_THRESHOLD:
                continue

            pairs.append(
                MergePair(
                    pair_id=pair_id,
                    entity_a=_to_entity_summary(entity_a),
                    entity_b=_to_entity_summary(entity_b),
                    similarity_score=round(similarity, 3),
                    suggested_action=(
                        "merge"
                        if similarity >= AUTO_SUGGEST_THRESHOLD
                        else "review"
                    ),
                )
            )

    return sorted(
        pairs,
        key=lambda pair: pair.similarity_score,
        reverse=True,
    )


async def approve_merge(pair_id: str, case_id: str) -> str:
    """
    Merge entity_b into entity_a while preserving relationship types.

    APOC absorbs entity_b into entity_a and keeps/deduplicates all
    relationships. No ALIAS_OF node or RELATED_TO replacement is created.
    """
    from db.neo4j import run_query

    existing_review = await _get_existing_review(pair_id, case_id)

    if existing_review is not None:
        if existing_review.decision == "merged":
            return existing_review.entity_a_id

        raise ValueError("This merge pair was already rejected")

    entity_a, entity_b = await _get_pair_entities(pair_id, case_id)

    similarity = cosine_similarity(
        get_embedding(entity_a["name"]),
        get_embedding(entity_b["name"]),
    )

    result = await run_query(
        """
        MATCH (a:Person {id: $entity_a_id, case_id: $case_id})
        MATCH (b:Person {id: $entity_b_id, case_id: $case_id})
        WITH a, b, b.name AS alias_name
        CALL apoc.refactor.mergeNodes(
            [a, b],
            {properties: "combine", mergeRels: true}
        )
        YIELD node
        SET node.aliases =
            CASE
                WHEN alias_name IS NULL
                    OR alias_name IN coalesce(node.aliases, [])
                THEN coalesce(node.aliases, [])
                ELSE coalesce(node.aliases, []) + [alias_name]
            END
        RETURN node.id AS entity_id
        """,
        {
            "entity_a_id": entity_a["id"],
            "entity_b_id": entity_b["id"],
            "case_id": case_id,
        },
    )

    surviving_entity_id = (
        result[0]["entity_id"]
        if result and result[0].get("entity_id")
        else entity_a["id"]
    )

    await _save_review(
        pair_id=pair_id,
        case_id=case_id,
        entity_a_id=entity_a["id"],
        entity_b_id=entity_b["id"],
        decision="merged",
        similarity=similarity,
    )

    return surviving_entity_id

async def reject_merge(pair_id: str, case_id: str):
    """Persist a rejected merge decision."""
    existing_review = await _get_existing_review(pair_id, case_id)

    if existing_review is not None:
        if existing_review.decision == "merged":
            raise ValueError("This merge pair was already approved")

        return

    entity_a, entity_b = await _get_pair_entities(pair_id, case_id)

    similarity = cosine_similarity(
        get_embedding(entity_a["name"]),
        get_embedding(entity_b["name"]),
    )

    await _save_review(
        pair_id=pair_id,
        case_id=case_id,
        entity_a_id=entity_a["id"],
        entity_b_id=entity_b["id"],
        decision="rejected",
        similarity=similarity,
    )