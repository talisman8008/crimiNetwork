"""
Phase 8 -- Main NLP Process Function + API Router.

This is the function Backend Dev 1 calls after parsing each uploaded file.
Runs the full NLP pipeline: coref -> NER -> ChromaDB -> graph handoff.
Also exposes entity-resolution API endpoints.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional

from .ner.model import extract_entities
from .coref import resolve_coreferences
from .embeddings import store_entity_in_chromadb, store_text_chunk_in_chromadb
from .entity_resolution import (
    find_duplicate_candidates,
    approve_merge,
    reject_merge,
)
from config import CONFIDENCE_SCORES
from dependencies import get_current_user

router = APIRouter(prefix="/api/nlp", tags=["nlp"])


# ── Core NLP Pipeline (called internally by Dev 1) ─────────────


async def process(case_id: str, parsed_output: dict, source_type: str):
    """
    Entry point called by Backend Dev 1 after each file is parsed.
    Runs full NLP pipeline and hands entities to Backend Dev 3.

    Args:
        case_id: The case this data belongs to
        parsed_output: Dict from parser with keys: raw_text, records, source_file
        source_type: "fir" | "cdr" | "financial" | "surveillance" | "social_media"
    """
    confidence = CONFIDENCE_SCORES.get(source_type, 0.5)
    raw_text = parsed_output.get("raw_text", "")

    print(f"Processing {source_type} for case {case_id}")

    # Step 1: Co-reference resolution
    if raw_text:
        resolved_text = resolve_coreferences(raw_text)
    else:
        resolved_text = ""

    # Step 2: NER on resolved text
    entities = []
    if resolved_text:
        entities = extract_entities(resolved_text)
        print(f"Extracted {len(entities)} entities")

    # Step 3: Store text chunks in ChromaDB for RAG
    if resolved_text:
        paragraphs = [p.strip() for p in resolved_text.split("\n\n") if p.strip()]
        for i, para in enumerate(paragraphs):
            if len(para) > 50:  # skip very short chunks
                store_text_chunk_in_chromadb(
                    chunk_id=f"{case_id}_{source_type}_{parsed_output.get('source_file', 'unknown')}_{i}",
                    text=para,
                    metadata={
                        "source_type": source_type,
                        "source_file": parsed_output.get("source_file", "unknown"),
                        "confidence": confidence,
                        "chunk_index": i,
                    },
                    case_id=case_id,
                )

    # Step 4: Store entity embeddings in ChromaDB
    for entity in entities:
        entity_id = f"{case_id}_{entity.label}_{entity.text.replace(' ', '_')}"
        store_entity_in_chromadb(
            entity_id=entity_id,
            text=entity.text,
            metadata={
                "entity_type": entity.label,
                "source_type": source_type,
                "source_file": parsed_output.get("source_file", "unknown"),
                "confidence": confidence,
                "source_snippet": entity.source_snippet,
            },
            case_id=case_id,
        )

    # Step 5: Hand entities to Backend Dev 3's graph builder
    from graph.builder import add_entities

    await add_entities(
        case_id=case_id,
        entities=entities,
        records=parsed_output.get("records", []),
        source_type=source_type,
        source_file=parsed_output.get("source_file", "unknown"),
        confidence=confidence,
    )

    # Step 6: Find duplicate candidates and populate resolution queue
    await find_duplicate_candidates(case_id)

    print(f"NLP processing complete for {source_type} in case {case_id}")


# ── Entity Resolution API Endpoints ─────────────────────────────


class MergeRequest(BaseModel):
    pair_id: str


@router.get("/cases/{case_id}/entity-resolution")
async def get_resolution_queue(
    case_id: str,
    user=Depends(get_current_user),
):
    """Get pending duplicate entity pairs for human review."""
    pairs = await find_duplicate_candidates(case_id)
    return {
        "case_id": case_id,
        "pending_pairs": len(pairs),
        "pairs": [
            {
                "pair_id": p.pair_id,
                "entity_a": {
                    "id": p.entity_a.id,
                    "name": p.entity_a.name,
                    "type": p.entity_a.entity_type,
                    "sources": p.entity_a.sources,
                    "phones": p.entity_a.phone_numbers,
                    "addresses": p.entity_a.addresses,
                    "appearances": p.entity_a.appearance_count,
                },
                "entity_b": {
                    "id": p.entity_b.id,
                    "name": p.entity_b.name,
                    "type": p.entity_b.entity_type,
                    "sources": p.entity_b.sources,
                    "phones": p.entity_b.phone_numbers,
                    "addresses": p.entity_b.addresses,
                    "appearances": p.entity_b.appearance_count,
                },
                "similarity": p.similarity_score,
                "suggested_action": p.suggested_action,
            }
            for p in pairs
        ],
    }


@router.post("/cases/{case_id}/entity-resolution/merge")
async def merge_entities(
    case_id: str,
    request: MergeRequest,
    user=Depends(get_current_user),
):
    """Approve merge of two duplicate entities."""
    merged_id = await approve_merge(request.pair_id, case_id)
    return {"status": "merged", "surviving_entity_id": merged_id}


@router.post("/cases/{case_id}/entity-resolution/reject")
async def reject_entities(
    case_id: str,
    request: MergeRequest,
    user=Depends(get_current_user),
):
    """Reject merge of two entities -- they stay separate."""
    await reject_merge(request.pair_id,case_id)
    return {"status": "rejected", "pair_id": request.pair_id}
