from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from db.neo4j import run_query
from .hidden_links import find_hidden_paths
from .cross_case import find_cross_case_matches
from .algorithms.temporal import get_timeline_snapshots, detect_activity_spikes
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from dependencies import get_current_user, verify_case_access

router = APIRouter(prefix="/api", tags=["graph"])

@router.get("/cases/{case_id}/graph")
async def get_graph(
    case_id: str,
    min_confidence: float = Query(0.0),
    entity_types: Optional[str] = Query(None),
    community_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    type_filter = [t.upper() for t in entity_types.split(",")] if entity_types else None
    
    node_conditions = ["NOT n:Case"]
    edge_conditions = ["NOT a:Case", "NOT b:Case", "type(r) <> 'PART_OF'", "coalesce(r.confidence, 1.0) >= $min_conf"]
    
    params = {"min_conf": min_confidence}

    if case_id != "all":
        node_conditions.append("n.case_id = $case_id")
        edge_conditions.append("a.case_id = $case_id")
        edge_conditions.append("b.case_id = $case_id")
        params["case_id"] = case_id

    if type_filter:
        node_conditions.append("(toupper(labels(n)[0]) IN $types OR toupper(n.entity_type) IN $types)")
        edge_conditions.append("(toupper(labels(a)[0]) IN $types OR toupper(a.entity_type) IN $types)")
        edge_conditions.append("(toupper(labels(b)[0]) IN $types OR toupper(b.entity_type) IN $types)")
        params["types"] = type_filter
        
    if community_id is not None:
        node_conditions.append("coalesce(n.community_id, 0) = $community_id")
        edge_conditions.append("coalesce(a.community_id, 0) = $community_id")
        edge_conditions.append("coalesce(b.community_id, 0) = $community_id")
        params["community_id"] = community_id
        
    if date_from:
        edge_conditions.append("(r.date IS NULL OR r.date >= $date_from)")
        params["date_from"] = date_from
        
    if date_to:
        edge_conditions.append("(r.date IS NULL OR r.date <= $date_to)")
        params["date_to"] = date_to

    node_where = " AND ".join(node_conditions)
    edge_where = " AND ".join(edge_conditions)
    
    cypher = f"""
        MATCH (n)
        WHERE {node_where}
        RETURN DISTINCT n.id as id, n.name as label,
               labels(n)[0] as type,
               coalesce(n.pagerank, 0) as centrality,
               coalesce(n.community_id, 0) as community_id,
               coalesce(n.anomaly_score, 0) as anomaly_score,
               coalesce(n.confidence, 0.5) as confidence,
               coalesce(n.degree, 0) as connection_count
    """
    
    edge_cypher = f"""
        MATCH (a)-[r]->(b)
        WHERE {edge_where}
        RETURN a.id + '_' + type(r) + '_' + b.id as id,
               a.id as source, b.id as target,
               type(r) as type,
               coalesce(r.confidence, 0.5) as confidence,
               coalesce(r.frequency, 1) as frequency,
               r.source_file as source_file,
               r.source_row as source_row,
               r.date as date
    """

    nodes = await run_query(cypher, params)
    
    # Format node types to match frontend lowercased variants
    for n in nodes:
        if n.get('type'):
            n['type'] = n['type'].lower()

    edges = await run_query(edge_cypher, params)
    
    # Format edges with evidence records
    formatted_edges = []
    for e in edges:
        formatted_edges.append({
            "id": e['id'],
            "source": e['source'],
            "target": e['target'],
            "type": e['type'],
            "confidence": e['confidence'],
            "frequency": e['frequency'],
            "records": [{
                "source_file": e.get('source_file') or 'unknown',
                "row": e.get('source_row') or 'N/A',
                "date": e.get('date') or 'unknown',
                "detail": f"{e['type']} relationship"
            }]
        })
    
    return {"nodes": nodes, "edges": formatted_edges}

@router.get("/cases/{case_id}/graph/hidden-links")
async def get_hidden_links(
    case_id: str,
    node_a: str = Query(...),
    node_b: str = Query(...),
    max_hops: int = Query(3, ge=1, le=4),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    return await find_hidden_paths(case_id, node_a, node_b, max_hops)

@router.get("/cases/{case_id}/graph/timeline")
async def get_timeline(
    case_id: str,
    date_from: str = Query(...),
    date_to: str = Query(...),
    interval: str = Query("week"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    snapshots = await get_timeline_snapshots(case_id, date_from, date_to, interval)
    spikes = await detect_activity_spikes(case_id)
    
    return {
        "snapshots": [
            {
                "date": s.date,
                "nodes": s.nodes,
                "edges": s.edges,
                "new_node_ids": s.new_node_ids,
                "new_edge_ids": s.new_edge_ids,
            }
            for s in snapshots
        ],
        "spikes": [
            {
                "date": s.date,
                "node_id": s.node_id,
                "node_name": s.node_name,
                "spike_ratio": s.spike_ratio
            }
            for s in spikes
        ]
    }

@router.get("/cases/{case_id}/graph/cross-case/{entity_id}")
async def get_cross_case(
    case_id: str,
    entity_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    matches = await find_cross_case_matches(entity_id, case_id)
    return {"matched_cases": matches}

@router.get("/cases/{case_id}/entities/{entity_id}")
async def get_entity(
    case_id: str,
    entity_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    result = await run_query("""
        MATCH (n {id: $entity_id, case_id: $case_id})
        OPTIONAL MATCH (n)-[r]-(connected {case_id: $case_id})
        WHERE type(r) <> 'PART_OF'
        RETURN n,
               collect({
                   entity: connected.name,
                   entity_id: connected.id,
                   relationship: type(r),
                   confidence: r.confidence,
                   frequency: r.frequency,
                   source: r.source_file
               }) as connections
    """, {"entity_id": entity_id, "case_id": case_id})
    
    if not result:
        return {"error": "Entity not found"}
    
    node = result[0]['n']
    connections = result[0]['connections']
    
    return {
        "identity": {
            "name": node.get('name'),
            "aliases": node.get('aliases', []),
            "entity_type": node.get('entity_type'),
            "sources": node.get('sources', []),
        },
        "connections": connections,
        "risk": {
            "anomaly_score": node.get('anomaly_score', 0),
            "factors": node.get('anomaly_factors', []),
            "community_id": node.get('community_id'),
            "centrality_rank": node.get('pagerank_percentile', 0),
        }
    }

@router.get("/cases/{case_id}/cross-case")
async def get_case_cross_links(
    case_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    rows = await run_query("""
        MATCH (a {case_id: $case_id})-[r:SAME_AS]-(b)
        WHERE b.case_id <> $case_id
        OPTIONAL MATCH (c:Case {id: b.case_id})
        RETURN a.id AS entity_id, a.name AS entity_name,
               b.id AS matched_id, b.name AS matched_name,
               b.case_id AS other_case_id,
               coalesce(c.name, b.case_id) AS other_case_name,
               r.confidence AS confidence, r.match_type AS match_type
        ORDER BY r.confidence DESC
    """, {"case_id": case_id})
    return {"links": rows}
@router.get("/cases/{case_id}/linked")
async def get_linked_cases(
    case_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    rows = await run_query("""
        MATCH (a {case_id: $case_id})-[r:SAME_AS]-(b)
        WHERE b.case_id <> $case_id
        RETURN b.case_id AS other_case_id,
               collect(DISTINCT {
                   entity_id: a.id,
                   entity_name: a.name,
                   matched_id: b.id,
                   matched_name: b.name,
                   confidence: r.confidence
               }) AS shared_entities,
               count(DISTINCT a.id) AS shared_count
        ORDER BY shared_count DESC
    """, {"case_id": case_id})
    return {"linked_cases": rows}    