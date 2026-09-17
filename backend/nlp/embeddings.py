"""
Phase 6 -- Sentence-BERT Embeddings + ChromaDB.

Embeds entity text and FIR paragraphs into vectors,
stores them in ChromaDB for semantic search (RAG retrieval).
"""

from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
import numpy as np
from typing import List, Optional

from config import CHROMA_DB_PATH

MODEL_NAME = "all-MiniLM-L6-v2"
_model = None
_chroma_client = None


def get_model():
    global _model
    if _model is None:
        print(f"Loading Sentence-BERT model: {MODEL_NAME}")
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_DB_PATH,
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_embedding(text: str) -> List[float]:
    model = get_model()
    return model.encode(text).tolist()


def get_embeddings_batch(texts: List[str]) -> List[List[float]]:
    model = get_model()
    return model.encode(texts).tolist()


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    a = np.array(vec_a)
    b = np.array(vec_b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def store_entity_in_chromadb(
    entity_id: str,
    text: str,
    metadata: dict,
    case_id: str,
):
    """Store an extracted entity embedding for later similarity search."""
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=f"case_{case_id}",
        metadata={"hnsw:space": "cosine"},
    )
    embedding = get_embedding(text)
    collection.upsert(
        ids=[entity_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[{**metadata, "case_id": case_id, "type": "entity"}],
    )


def store_text_chunk_in_chromadb(
    chunk_id: str,
    text: str,
    metadata: dict,
    case_id: str,
):
    """Store raw text chunks (FIR paragraphs, CDR summaries) for RAG retrieval."""
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=f"case_{case_id}",
        metadata={"hnsw:space": "cosine"},
    )
    embedding = get_embedding(text)
    collection.upsert(
        ids=[chunk_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[{**metadata, "case_id": case_id, "type": "text_chunk"}],
    )


def search_similar_entities(
    query: str,
    case_id: str,
    top_k: int = 5,
    entity_type: Optional[str] = None,
) -> List[dict]:
    """Semantic search within a case's ChromaDB collection."""
    client = get_chroma_client()
    try:
        collection = client.get_collection(name=f"case_{case_id}")
    except Exception:
        return []

    where = {"case_id": case_id, "type": "entity"}
    if entity_type:
        where["entity_type"] = entity_type

    count = collection.count()
    if count == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(top_k, count),
        where=where,
    )

    output = []
    for i, doc_id in enumerate(results["ids"][0]):
        output.append(
            {
                "id": doc_id,
                "text": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "similarity": 1 - results["distances"][0][i],
            }
        )
    return output
