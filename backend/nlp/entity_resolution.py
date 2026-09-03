"""
Phase 7 -- Entity Resolution Queue.

Finds duplicate person entities across FIRs by embedding similarity,
and provides merge/reject endpoints for human review.
NEVER auto-merges -- always requires human confirmation.
"""

from typing import List
from dataclasses import dataclass
import uuid

from .embeddings import cosine_similarity, get_embedding
from config import SIMILARITY_THRESHOLD

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


# In-memory store for reviewed pairs (use DB in production)
_reviewed_pairs = {}


async def find_duplicate_candidates(case_id: str) -> List[MergePair]:
    """
    Fetch all PERSON entities for case, compute pairwise similarity,
    return pairs above threshold that haven't been reviewed.
    """
    from db.neo4j import run_query

    # Fetch all persons from Neo4j
    persons = await run_query(
        "MATCH (p:Person {case_id: $case_id}) RETURN p",
        {"case_id": case_id},
    )

    if len(persons) < 2:
        return []

    # Get embeddings for all person names
    embeddings = {}
    for person in persons:
        node = person["p"]
        embeddings[node["id"]] = get_embedding(node["name"])

    # Compute pairwise similarities
    pairs = []
    person_list = [p["p"] for p in persons]

    for i in range(len(person_list)):
        for j in range(i + 1, len(person_list)):
            a = person_list[i]
            b = person_list[j]

            pair_id = f"{a['id']}_{b['id']}"

            # Skip already reviewed
            if pair_id in _reviewed_pairs:
                continue

            sim = cosine_similarity(embeddings[a["id"]], embeddings[b["id"]])

            if sim >= SIMILARITY_THRESHOLD:
                pairs.append(
                    MergePair(
                        pair_id=pair_id,
                        entity_a=EntitySummary(
                            id=a["id"],
                            name=a["name"],
                            entity_type="PERSON",
                            sources=a.get("sources", []),
                            phone_numbers=a.get("phones", []),
                            addresses=a.get("addresses", []),
                            appearance_count=a.get("appearance_count", 1),
                        ),
                        entity_b=EntitySummary(
                            id=b["id"],
                            name=b["name"],
                            entity_type="PERSON",
                            sources=b.get("sources", []),
                            phone_numbers=b.get("phones", []),
                            addresses=b.get("addresses", []),
                            appearance_count=b.get("appearance_count", 1),
                        ),
                        similarity_score=round(sim, 3),
                        suggested_action="merge"
                        if sim >= AUTO_SUGGEST_THRESHOLD
                        else "review",
                    )
                )

    return sorted(pairs, key=lambda p: p.similarity_score, reverse=True)


async def approve_merge(pair_id: str, case_id: str) -> str:
    """
    Merge entity_b into entity_a in Neo4j.
    All edges from entity_b get redirected to entity_a.
    entity_b is marked as ALIAS_OF entity_a.
    NEVER auto-called -- always requires human confirmation.
    """
    from db.neo4j import run_query

    parts = pair_id.split("_")
    entity_a_id = parts[0]
    entity_b_id = parts[1]

    # Redirect all outgoing edges from entity_b to entity_a
    await run_query(
        """
        MATCH (b:Person {id: $b_id})-[r]->(other)
        MATCH (a:Person {id: $a_id})
        WITH a, b, r, other, type(r) as rel_type, properties(r) as props
        CREATE (a)-[new_r:RELATED_TO]->(other)
        SET new_r = props
        DELETE r
    """,
        {"a_id": entity_a_id, "b_id": entity_b_id},
    )

    # Same for incoming edges
    await run_query(
        """
        MATCH (other)-[r]->(b:Person {id: $b_id})
        MATCH (a:Person {id: $a_id})
        WITH a, b, r, other, type(r) as rel_type, properties(r) as props
        CREATE (other)-[new_r:RELATED_TO]->(a)
        SET new_r = props
        DELETE r
    """,
        {"a_id": entity_a_id, "b_id": entity_b_id},
    )

    # Mark entity_b as alias
    await run_query(
        """
        MATCH (a:Person {id: $a_id})
        MATCH (b:Person {id: $b_id})
        CREATE (b)-[:ALIAS_OF {confidence: 0.95}]->(a)
        SET b.merged = true
        SET a.aliases = coalesce(a.aliases, []) + [b.name]
    """,
        {"a_id": entity_a_id, "b_id": entity_b_id},
    )

    _reviewed_pairs[pair_id] = "merged"
    return entity_a_id


async def reject_merge(pair_id: str):
    """Mark pair as reviewed-rejected. Never appears in queue again."""
    _reviewed_pairs[pair_id] = "rejected"
