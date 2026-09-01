"""
Phase 9 -- RAG Retriever.

Fetches relevant data from both ChromaDB (unstructured text) 
and Neo4j (structured relationships) to build context for the LLM.
"""

from typing import List, Dict, Any
from db.neo4j import run_query
from nlp.embeddings import search_similar_entities, get_chroma_client


async def retrieve_from_neo4j(query: str, case_id: str) -> str:
    """
    Very basic keyword heuristic to grab relevant nodes from graph.
    In production, this would use an LLM to generate Cypher or vector search on graph.
    """
    # Simple heuristic: if query contains "who", "connect", "link"
    # fetch the most central figures.
    cypher = """
        MATCH (p:Person {case_id: $case_id})-[r]->(other)
        WITH p, count(r) as connections
        ORDER BY connections DESC LIMIT 5
        OPTIONAL MATCH (p)-[r2]-(other2)
        RETURN p.name as name, type(r2) as rel, coalesce(other2.name, other2.id) as target
    """
    results = await run_query(cypher, {"case_id": case_id})
    
    if not results:
        return "No structured graph data found."

    # Format into readable string
    context = "Structured Graph Data:\n"
    for r in results:
        context += f"- {r['name']} is {r['rel']} to {r['target']}\n"
        
    return context


async def retrieve_from_chroma(query: str, case_id: str, top_k: int = 3) -> str:
    """
    Fetch raw text chunks from ChromaDB that match the query semantically.
    """
    client = get_chroma_client()
    try:
        collection = client.get_collection(name=f"case_{case_id}")
    except Exception:
        return "No unstructured text data found."

    count = collection.count()
    if count == 0:
        return "No unstructured text data found."

    # Search for text_chunk
    results = collection.query(
        query_texts=[query],
        n_results=min(top_k, count),
        where={"type": "text_chunk"}
    )
    
    if not results or not results["documents"] or not results["documents"][0]:
        return "No relevant text passages found."

    context = "Unstructured Source Text:\n"
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        context += f"[Source: {meta.get('source_file', 'unknown')}] {doc}\n"
        
    return context


async def gather_context(query: str, case_id: str) -> str:
    """Combine both Neo4j and ChromaDB retrievals."""
    graph_context = await retrieve_from_neo4j(query, case_id)
    text_context = await retrieve_from_chroma(query, case_id)
    
    return f"{graph_context}\n\n{text_context}"
