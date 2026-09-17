"""
Phase 12 -- Copilot API Router.

Exposes the Copilot chat endpoints. Access control happens here, before any
retrieval runs: a case can only be queried by the investigator it is
assigned to or by a supervisor.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from db.database import AsyncSessionLocal
from db.models import Case
from dependencies import get_current_user
from .rag import run_rag

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


class ChatRequest(BaseModel):
    query: str


class ChatResponse(BaseModel):
    """
    Structured Copilot result. sources / referenced_entities / confidence
    are grounded in retrieval metadata by copilot/rag.py.
    """
    case_id: str
    query: str
    answer: str
    sources: List[dict]
    confidence: float = Field(ge=0.0, le=1.0)
    referenced_entities: List[str]


async def verify_case_access(
    case_id: str,
    user=Depends(get_current_user),
) -> Case:
    """
    Reusable guard for case-scoped endpoints. Raises:
      - 404 if the case does not exist
      - 403 if the user is neither assigned to the case nor a supervisor
    FastAPI resolves this dependency before the endpoint body, so no
    retrieval runs for unauthorized users.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()

    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")

    if case.assigned_to != user.badge_id and user.role != "SUPERVISOR":
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this case.",
        )

    return case


@router.post("/cases/{case_id}/chat", response_model=ChatResponse)
async def chat_with_case(
    case_id: str,
    request: ChatRequest,
    case: Case = Depends(verify_case_access),
    user=Depends(get_current_user),
):
    """
    Ask a question about a specific case.
    Copilot uses RAG (ChromaDB + Neo4j) scoped to this case only and returns
    a structured, source-grounded answer.
    """
    result = await run_rag(request.query, case_id)

    return {
        "case_id": case_id,
        "query": request.query,
        "answer": result["answer"],
        "sources": result["sources"],
        "confidence": result["confidence"],
        "referenced_entities": result["referenced_entities"],
    }