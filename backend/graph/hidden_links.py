from dataclasses import dataclass
from typing import List
from db.neo4j import run_query
from .algorithms.gnn import predict_hidden_links

@dataclass
class EvidenceRecord:
    source_file: str
    row_number: str
    date: str
    detail: str

@dataclass
class Hop:
    from_entity_id: str
    from_entity_name: str
    to_entity_id: str
    to_entity_name: str
    relationship_type: str
    confidence: float
    evidence: List[EvidenceRecord]

@dataclass
class EvidencePath:
    total_hops: int
    path_confidence: float
    hops: List[Hop]

async def find_hidden_paths(
    case_id: str,
    node_a_id: str,
    node_b_id: str,
    max_hops: int = 3
) -> dict:
    """
    USP 1 — Hidden Link Discovery with Evidence Chains.
    Finds all connecting paths up to max_hops between two nodes.
    Returns paths with source records proving each edge.
    """
    
    # Find all paths up to max_hops
    paths_result = await run_query(f"""
        MATCH path = (a {{id: $node_a, case_id: $case_id}})
                     -[*1..{max_hops}]-
                     (b {{id: $node_b, case_id: $case_id}})
        WHERE ALL(n IN nodes(path) WHERE n.case_id = $case_id)
        RETURN [node IN nodes(path) | {{id: node.id, name: node.name}}] as nodes,
               [rel IN relationships(path) | {{
                   type: type(rel),
                   confidence: rel.confidence,
                   source_file: rel.source_file,
                   source_row: rel.source_row,
                   date: rel.date,
                   detail: rel.detail
               }}] as rels
        LIMIT 10
    """, {
        "node_a": node_a_id,
        "node_b": node_b_id,
        "case_id": case_id
    })
    
    evidence_paths = []
    
    for path_data in paths_result:
        path_nodes = path_data['nodes']
        path_rels = path_data['rels']
        
        hops = []
        path_confidence = 1.0
        
        for i, rel in enumerate(path_rels):
            edge_confidence = rel.get('confidence') or 0.5
            path_confidence *= edge_confidence
            
            # Build evidence record for this hop
            evidence = [EvidenceRecord(
                source_file=rel.get('source_file') or 'unknown',
                row_number=str(rel.get('source_row') or 'N/A'),
                date=rel.get('date') or 'unknown',
                detail=_build_edge_detail(rel)
            )]
            
            hops.append(Hop(
                from_entity_id=path_nodes[i]['id'],
                from_entity_name=path_nodes[i]['name'],
                to_entity_id=path_nodes[i + 1]['id'],
                to_entity_name=path_nodes[i + 1]['name'],
                relationship_type=rel['type'],
                confidence=edge_confidence,
                evidence=evidence
            ))
        
        evidence_paths.append(EvidencePath(
            total_hops=len(hops),
            path_confidence=round(path_confidence, 3),
            hops=hops
        ))
    
    # Sort by path confidence descending
    evidence_paths.sort(key=lambda p: p.path_confidence, reverse=True)
    
    # If no direct paths found, fall back to GNN predictions
    predicted_links = []
    if not evidence_paths:
        all_predictions = await predict_hidden_links(case_id)
        predicted_links = [
            p for p in all_predictions
            if (p.node_a_id == node_a_id and p.node_b_id == node_b_id) or
               (p.node_a_id == node_b_id and p.node_b_id == node_a_id)
        ]
    
    return {
        "paths": [_serialize_path(p) for p in evidence_paths],
        "predicted_links": [
            {
                "node_a_id": p.node_a_id,
                "node_a_name": p.node_a_name,
                "node_b_id": p.node_b_id,
                "node_b_name": p.node_b_name,
                "confidence": p.confidence,
                "basis": p.basis
            }
            for p in predicted_links
        ]
    }

def _build_edge_detail(rel: dict) -> str:
    rel_type = rel.get('type', 'UNKNOWN')
    if rel_type == 'CALLED':
        return f"Phone call on {rel.get('date', 'unknown date')}"
    elif rel_type == 'TRANSACTED_WITH':
        return f"Financial transaction on {rel.get('date', 'unknown date')}"
    elif rel_type == 'MENTIONED_WITH':
        return f"Co-mentioned in {rel.get('source_file', 'FIR')}"
    return f"{rel_type} relationship"

def _serialize_path(path: EvidencePath) -> dict:
    return {
        "total_hops": path.total_hops,
        "path_confidence": path.path_confidence,
        "hops": [
            {
                "from_entity_id": h.from_entity_id,
                "from_entity_name": h.from_entity_name,
                "to_entity_id": h.to_entity_id,
                "to_entity_name": h.to_entity_name,
                "relationship_type": h.relationship_type,
                "confidence": h.confidence,
                "evidence": [
                    {
                        "source_file": e.source_file,
                        "row_number": e.row_number,
                        "date": e.date,
                        "detail": e.detail
                    }
                    for e in h.evidence
                ]
            }
            for h in path.hops
        ]
    }