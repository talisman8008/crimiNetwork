"""
Phase 12 -- Copilot API Router.

Exposes the Copilot chat endpoints.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from dependencies import get_current_user
from .explainer import ask_copilot

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


class ChatRequest(BaseModel):
    query: str


@router.post("/cases/{case_id}/chat")
async def chat_with_case(
    case_id: str,
    request: ChatRequest,
    user=Depends(get_current_user),
):
    """
    Ask a question about a specific case. 
    Copilot uses RAG (ChromaDB + Neo4j) to answer.
    """
    answer = await ask_copilot(request.query, case_id)
    return {
        "case_id": case_id,
        "query": request.query,
        "answer": answer
    }
