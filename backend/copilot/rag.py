"""
Phase 13 -- RAG Orchestrator.

The single entrypoint for the Copilot pipeline:

    retrieve (copilot.retriever) -> build context -> call LLM (copilot.explainer)
    -> assemble the structured response.

run_rag() replaces explainer.ask_copilot(); the router calls it directly.

Everything in the structured response is grounded in what retrieval actually
returned -- the LLM is only asked for the answer text, never for sources,
entities, or confidence (a model asked for those would fabricate them):

- answer: plain-text LLM reply.
- sources: source files of the retrieved chunks the answer actually uses.
    A chunk counts as "used" when its source file is cited by name in the
    answer (the prompt asks the model to cite as [file.pdf]) or when one of
    the entities attached to the chunk (Chroma metadata) appears in the
    answer. Both signals are matched against the real retrieved metadata.
- referenced_entities: entity names/ids from the Neo4j rows and Chroma
    metadata (chunk metadata + search_similar_entities) that appear in the
    answer text.
- confidence: derived from retrieval, not estimated by the model:
      * refusals and LLM failures score 0.0 (nothing grounded the answer);
      * otherwise 0.5 * retrieval_strength + 0.5 * grounding_strength, where
        retrieval_strength = min(1, (text chunks + graph facts) / 5) -- how
        much evidence exists for this case -- and grounding_strength =
        min(1, (referenced entities + used sources) / 2) -- how much of that
        evidence the answer actually reflects.
"""

from typing import Any, Dict, List

from .explainer import generate_explanation
from .retriever import gather_context

# Matches the refusal sentence the prompt instructs the model to use (and
# close paraphrases of it).
_REFUSAL_MARKER = "i do not have enough information"

# Error prefixes explainer.py returns when the LLM call itself failed.
_LLM_ERROR_PREFIXES = (
    "Error calling OpenAI API",
    "Error calling Gemini API",
    "Error: No LLM API key",
)

# Confidence formula: component weights and saturation points.
_CONFIDENCE_RETRIEVAL_WEIGHT = 0.5
_CONFIDENCE_GROUNDING_WEIGHT = 0.5
_FULL_RETRIEVAL_EVIDENCE = 5  # chunks + graph facts at/above this -> 1.0
_FULL_GROUNDING_SIGNALS = 2   # referenced entities + used sources at/above this -> 1.0


def _is_refusal(answer: str) -> bool:
    return _REFUSAL_MARKER in answer.lower()


def _is_llm_failure(answer: str) -> bool:
    return any(answer.startswith(prefix) for prefix in _LLM_ERROR_PREFIXES)


def _used_chunks(chunks: List[Dict[str, Any]], answer: str) -> List[Dict[str, Any]]:
    """
    The retrieved chunks that ground the answer: the chunk's source file is
    cited by name in the answer, or one of the chunk's entities (from Chroma
    metadata) is mentioned in the answer.
    """
    answer_lower = answer.lower()
    used = []
    for chunk in chunks:
        source = chunk.get("source")
        cited = bool(source) and source.lower() in answer_lower
        entity_hit = any(
            entity.lower() in answer_lower
            for entity in chunk.get("entities", [])
            if entity
        )
        if cited or entity_hit:
            used.append(chunk)
    return used


def _referenced_entities(candidates: List[str], answer: str) -> List[str]:
    """Entity names/ids from retrieval that appear in the answer text."""
    answer_lower = answer.lower()
    referenced = []
    seen = set()
    for entity in candidates:
        if not entity:
            continue
        key = entity.lower()
        if key in answer_lower and key not in seen:
            seen.add(key)
            referenced.append(entity)
    return referenced


def _compute_confidence(
    retrieval: Dict[str, Any],
    sources: List[str],
    referenced_entities: List[str],
) -> float:
    """
    Confidence in [0.0, 1.0], derived from retrieval. Only called for
    grounded answers (refusals and LLM failures are short-circuited to 0.0
    in run_rag). See the module docstring for the formula.
    """
    evidence = len(retrieval.get("chunks", [])) + len(retrieval.get("graph_facts", []))
    retrieval_strength = min(1.0, evidence / _FULL_RETRIEVAL_EVIDENCE)

    signals = len(sources) + len(referenced_entities)
    grounding_strength = min(1.0, signals / _FULL_GROUNDING_SIGNALS)

    confidence = (
        _CONFIDENCE_RETRIEVAL_WEIGHT * retrieval_strength
        + _CONFIDENCE_GROUNDING_WEIGHT * grounding_strength
    )
    return round(min(1.0, max(0.0, confidence)), 2)


async def run_rag(query: str, case_id: str) -> Dict[str, Any]:
    """
    Main entrypoint for Copilot QA. Retrieval is scoped to case_id by
    copilot.retriever (per-case Chroma collection + Neo4j case_id filters);
    this function only orchestrates and grounds the structured result.
    """
    # 1. Retrieve
    retrieval = await gather_context(query, case_id)

    # 2. Generate
    answer = await generate_explanation(query, retrieval["context"])
    if not answer:
        answer = ""

    # 3. Assemble the structured response from real retrieval metadata.
    grounded = bool(answer) and not _is_refusal(answer) and not _is_llm_failure(answer)

    if grounded:
        used = _used_chunks(retrieval.get("chunks", []), answer)
        sources = list(dict.fromkeys(chunk["source"] for chunk in used if chunk.get("source")))
        referenced_entities = _referenced_entities(retrieval.get("entities", []), answer)
        confidence = _compute_confidence(retrieval, sources, referenced_entities)
    else:
        # Refusals and LLM failures are not grounded in the case files.
        sources = []
        referenced_entities = []
        confidence = 0.0

    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
        "referenced_entities": referenced_entities,
    }