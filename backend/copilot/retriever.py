"""
Phase 9 -- RAG Retriever.

Fetches relevant data from both ChromaDB (unstructured text + entity records)
and Neo4j (structured relationships) to build context for the LLM.

Per-case isolation (audited and enforced):
- Chroma: every query goes to this case's own collection, f"case_{case_id}".
  The `where` clause only filters record type; the collection itself is the
  case boundary, so no query can reach another case's records.
- Neo4j: every MATCH carries {case_id: $case_id} on BOTH endpoints of every
  relationship (p, other, other2). The previous Cypher left `other` and
  `other2` unfiltered, which meant centrality ranking and returned neighbor
  names/ids could come from other cases. The case id is always passed as a
  query parameter, never interpolated into the Cypher string.

Every retrieval function returns the formatted LLM context string plus the
raw metadata (chunks, source files, entities, graph facts) so copilot/rag.py
can ground the structured Copilot response in what was actually retrieved.
"""

from typing import Any, Dict, List, Optional

from db.neo4j import run_query
from nlp.embeddings import search_similar_entities, get_chroma_client


# ---------------------------------------------------------------------------
# Metadata helpers -- turn Chroma metadata / entity records into plain names
# ---------------------------------------------------------------------------

_ENTITY_LIST_KEYS = ("entities",)
_ENTITY_STRING_KEYS = ("entity", "entity_name")
_ENTITY_NAME_KEYS = ("entity", "name", "text", "id")


def _requested_source_type(query: str) -> Optional[str]:
    """Return an explicit document-type filter requested by the investigator.

    This is intentionally limited to document categories already stored in
    metadata. It does not depend on any case-specific filename, person, or
    sample data. Queries without an explicit document type keep the normal
    cross-source semantic search behavior.
    """
    normalized = query.lower()

    if "fir" in normalized or "first information report" in normalized:
        return "fir"
    if "cdr" in normalized or "call detail record" in normalized:
        return "cdr"
    if (
        "financial" in normalized
        or "transaction" in normalized
        or "transfer" in normalized
    ):
        return "financial"

    return None


def _entities_from_metadata(meta: Dict[str, Any]) -> List[str]:
    """Entity names attached to a Chroma record, if its metadata carries any."""
    import json
    found: List[str] = []
    if "entity_names_json" in meta:
        try:
            parsed = json.loads(meta["entity_names_json"])
            if isinstance(parsed, list):
                found.extend(str(item) for item in parsed if item)
        except Exception:
            pass

    for key in _ENTITY_LIST_KEYS:
        value = meta.get(key)
        if isinstance(value, list):
            found.extend(str(item) for item in value if item)
    for key in _ENTITY_STRING_KEYS:
        value = meta.get(key)
        if isinstance(value, str) and value:
            found.append(value)
    return found


def _entity_name_from_record(record: Any) -> str:
    """Best-effort name for one record returned by search_similar_entities."""
    if isinstance(record, str):
        return record
    if isinstance(record, dict):
        for key in _ENTITY_NAME_KEYS:
            value = record.get(key)
            if value:
                return str(value)
    return ""


def _search_chroma_entities(query: str, case_id: str, top_k: int) -> List[str]:
    """
    Entity records live in the same per-case collection; nlp.embeddings
    exposes search_similar_entities(query, case_id, top_k) to search them.
    Always called with the case id so the search stays inside this case's
    collection. A failure degrades gracefully -- entities still come from
    graph rows and chunk metadata.
    """
    try:
        records = search_similar_entities(query, case_id, top_k)
    except Exception:
        return []
    return [
        name
        for name in (_entity_name_from_record(record) for record in records or [])
        if name
    ]


def _empty_graph_result() -> Dict[str, Any]:
    return {"context": "No structured graph data found.", "facts": [], "entities": []}


def _empty_text_result(message: str = "No unstructured text data found.") -> Dict[str, Any]:
    return {"context": message, "chunks": [], "sources": [], "entities": []}


async def retrieve_from_neo4j(query: str, case_id: str, chroma_entities: List[str] = None) -> Dict[str, Any]:
    chroma_entities = chroma_entities or []
    keywords = [w.lower() for w in query.split() if len(w) > 3]
    
    cypher = """\
        MATCH (p {case_id: $case_id})-[r]-(other {case_id: $case_id})
        WITH p, count(r) as connections
        ORDER BY
            CASE WHEN p.name IN $chroma_entities THEN 2
                 WHEN any(k IN $keywords WHERE toLower(p.name) CONTAINS k OR coalesce(toLower(p.id), '') CONTAINS k) THEN 1
                 ELSE 0 END DESC,
            connections DESC
        LIMIT 5
        OPTIONAL MATCH (p)-[r2]-(other2 {case_id: $case_id})
        RETURN coalesce(p.name, p.id) as name, type(r2) as rel, coalesce(other2.name, other2.id) as target
    """
    results = await run_query(cypher, {
        "case_id": case_id,
        "chroma_entities": chroma_entities,
        "keywords": keywords
    })

    if not results:
        return _empty_graph_result()

    # Format into readable string and keep the structured facts/entities.
    context = "Structured Graph Data:\n"
    facts: List[Dict[str, Any]] = []
    entities: List[str] = []

    for r in results:
        name = r.get("name")
        rel = r.get("rel")
        target = r.get("target")

        if name:
            entities.append(name)

        # OPTIONAL MATCH rows without an in-case neighbor carry null
        # rel/target; there is nothing to report for those rows.
        if not rel or not target:
            continue

        facts.append({"name": name, "rel": rel, "target": target})
        entities.append(target)
        context += f"- {name} is {rel} to {target}\n"

    if not facts:
        return _empty_graph_result()

    entities = list(dict.fromkeys(entity for entity in entities if entity))
    return {"context": context, "facts": facts, "entities": entities}


async def retrieve_from_chroma(query: str, case_id: str, top_k: int = 3) -> Dict[str, Any]:
    """
    Fetch raw text chunks from ChromaDB that match the query semantically.

    Returns:
        {
            "context": str,        # formatted block for the prompt
            "chunks": List[dict],  # {"text", "source", "entities"} per chunk
            "sources": List[str],  # unique source_file values
            "entities": List[str], # entity names from chunk metadata
        }
    """
    # Per-case isolation: the collection name IS the case boundary. Only this
    # case's collection is ever opened, so the `where` clause below only
    # needs to pick the record type.
    client = get_chroma_client()
    try:
        collection = client.get_collection(name=f"case_{case_id}")
    except Exception:
        return _empty_text_result()

    count = collection.count()
    if count == 0:
        return _empty_text_result()

    # Search text chunks. When the investigator explicitly asks for a document
    # category (for example, an FIR), constrain retrieval to that existing
    # metadata category so unrelated high-similarity rows do not crowd it out.
    requested_type = _requested_source_type(query)
    where: Dict[str, Any] = {"type": "text_chunk"}
    if requested_type:
        where = {
            "$and": [
                {"type": "text_chunk"},
                {"source_type": requested_type},
            ]
        }

    results = collection.query(
        query_texts=[query],
        n_results=min(top_k, count),
        where=where,
    )

    if not results or not results["documents"] or not results["documents"][0]:
        return _empty_text_result("No relevant text passages found.")

    chunks: List[Dict[str, Any]] = []
    sources_dict: Dict[str, Dict[str, Any]] = {}
    metadatas = results.get("metadatas") or []
    for i, doc in enumerate(results["documents"][0]):
        meta = (metadatas[0][i] or {}) if metadatas else {}
        source_file = meta.get("source_file") or "unknown"
        source_type = meta.get("source_type") or "unknown"
        source_row = meta.get("source_row")
        date = meta.get("date")

        chunk_info: Dict[str, Any] = {
            "text": doc,
            "source": source_file,
            "source_type": source_type,
            "source_row": source_row,
            "date": date,
            "entities": _entities_from_metadata(meta),
        }
        chunks.append(chunk_info)

        # Build a unique source object per (file, row, date) triple.
        source_key = f"{source_file}_{source_row}_{date}" if source_row is not None else source_file
        if source_key not in sources_dict:
            sources_dict[source_key] = {
                "source_file": source_file,
                "source_type": source_type,
                "source_row": source_row,
                "date": date,
                "excerpt": doc[:200] + "..." if len(doc) > 200 else doc,
            }

    context = "Unstructured Source Text:\n"
    for chunk in chunks:
        context += f"[Source: {chunk['source']}] {chunk['text']}\n"

    sources: List[Dict[str, Any]] = list(sources_dict.values())
    entities = list(dict.fromkeys(
        entity for chunk in chunks for entity in chunk["entities"] if entity
    ))

    # Entity records in the same per-case collection, matched to the query.
    entities.extend(_search_chroma_entities(query, case_id, top_k))
    entities = list(dict.fromkeys(entities))

    return {"context": context, "chunks": chunks, "sources": sources, "entities": entities}


async def gather_context(query: str, case_id: str) -> Dict[str, Any]:
    text = await retrieve_from_chroma(query, case_id)
    graph = await retrieve_from_neo4j(query, case_id, text["entities"])

    entities = list(dict.fromkeys(
        entity for entity in graph["entities"] + text["entities"] if entity
    ))

    return {
        "context": f"{graph['context']}\n\n{text['context']}",
        "chunks": text["chunks"],
        "sources": text["sources"],
        "entities": entities,
        "graph_facts": graph["facts"],
    }
