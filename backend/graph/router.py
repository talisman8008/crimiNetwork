from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from db.neo4j import run_query
from .hidden_links import find_hidden_paths
from .cross_case import find_cross_case_matches
from .algorithms.temporal import get_timeline_snapshots, detect_activity_spikes
from dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["graph"])

@router.get("/cases/{case_id}/graph")
async def get_graph(
    case_id: str,
    min_confidence: float = Query(0.0),
    entity_types: Optional[str] = Query(None),
    community_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user=Depends(get_current_user)
):
    type_filter = entity_types.split(",") if entity_types else None
    
    cypher = """
        MATCH (n {case_id: $case_id})
        WHERE NOT n:Case
        OPTIONAL MATCH (n)-[r]-(m {case_id: $case_id})
        WHERE type(r) <> 'PART_OF'
        AND ($min_conf = 0 OR coalesce(r.confidence, 1.0) >= $min_conf)
        RETURN DISTINCT n.id as id, n.name as label,
               labels(n)[0] as type,
               coalesce(n.pagerank, 0) as centrality,
               coalesce(n.community_id, 0) as community_id,
               coalesce(n.anomaly_score, 0) as anomaly_score,
               coalesce(n.confidence, 0.5) as confidence,
               coalesce(n.degree, 0) as connection_count
    """
    
    nodes = await run_query(cypher, {
        "case_id": case_id,
        "min_conf": min_confidence
    })
    
    edge_cypher = """
        MATCH (a {case_id: $case_id})-[r]->(b {case_id: $case_id})
        WHERE type(r) <> 'PART_OF'
        AND coalesce(r.confidence, 1.0) >= $min_conf
        RETURN a.id + '_' + type(r) + '_' + b.id as id,
               a.id as source, b.id as target,
               type(r) as type,
               coalesce(r.confidence, 0.5) as confidence,
               coalesce(r.frequency, 1) as frequency,
               r.source_file as source_file,
               r.source_row as source_row,
               r.date as date
    """
    
    edges = await run_query(edge_cypher, {
        "case_id": case_id,
        "min_conf": min_confidence
    })
    
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
    user=Depends(get_current_user)
):
    return await find_hidden_paths(case_id, node_a, node_b, max_hops)

@router.get("/cases/{case_id}/graph/timeline")
async def get_timeline(
    case_id: str,
    date_from: str = Query(...),
    date_to: str = Query(...),
    interval: str = Query("week"),
    user=Depends(get_current_user)
):
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
    user=Depends(get_current_user)
):
    matches = await find_cross_case_matches(entity_id, case_id)
    return {"matched_cases": matches}

@router.get("/cases/{case_id}/entities/{entity_id}")
async def get_entity(
    case_id: str,
    entity_id: str,
    user=Depends(get_current_user)
):
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