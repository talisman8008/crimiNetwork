from typing import List
from db.neo4j import run_query
from nlp.embeddings import cosine_similarity, get_embedding

async def find_cross_case_matches(entity_id: str, case_id: str) -> List[dict]:
    """
    Find entities in OTHER cases that match this entity.
    Matches by phone number (exact) or name similarity.
    """
    # Get the entity we're matching against
    entity = await run_query(
        "MATCH (n {id: $entity_id}) RETURN n.name as name, n.entity_type as type",
        {"entity_id": entity_id}
    )
    
    if not entity:
        return []
    
    entity_name = entity[0]['name']
    entity_embedding = get_embedding(entity_name)
    
    # Find all entities in OTHER cases
    other_entities = await run_query("""
        MATCH (n)
        WHERE n.case_id <> $case_id
        AND n.case_id IS NOT NULL
        AND NOT n:Case
        RETURN n.id as id, n.name as name,
               n.case_id as case_id,
               n.entity_type as entity_type
    """, {"case_id": case_id})
    
    matches = []
    
    for other in other_entities:
        if not other['name']:
            continue
        
        # Exact phone match
        if entity_name.replace(" ", "") == other['name'].replace(" ", ""):
            matches.append({
                "matched_entity": other,
                "matched_case_id": other['case_id'],
                "match_type": "exact",
                "confidence": 1.0
            })
            continue
        
        # Name similarity for persons
        other_embedding = get_embedding(other['name'])
        sim = cosine_similarity(entity_embedding, other_embedding)
        
        if sim >= 0.82:
            # Get case details
            case_info = await run_query(
                "MATCH (c:Case {id: $case_id}) RETURN c.name as name",
                {"case_id": other['case_id']}
            )
            case_name = case_info[0]['name'] if case_info else other['case_id']
            
            matches.append({
                "case_id": other['case_id'],
                "case_name": case_name,
                "matched_entity": {
                    "id": other['id'],
                    "name": other['name'],
                    "entity_type": other['entity_type']
                },
                "match_type": "name_similarity",
                "confidence": round(sim, 3)
            })
    
    return sorted(matches, key=lambda m: m['confidence'], reverse=True)

async def run_cross_case_scan_all():
    """
    Background scan: find all shared entities across all cases.
    Run after every new case processes.
    """
    cases = await run_query(
        "MATCH (c:Case) RETURN c.id as case_id"
    )
    
    for case in cases:
        entities = await run_query(
            "MATCH (n:Person {case_id: $case_id}) RETURN n.id as id",
            {"case_id": case['case_id']}
        )
        for entity in entities:
            matches = await find_cross_case_matches(
                entity['id'], case['case_id']
            )
            if matches:
                from alerts.service import create_alert
                for match in matches:
                    await create_alert(case['case_id'], {
                        "severity": "HIGH",
                        "title": f"Cross-case entity match detected",
                        "description": (
                            f"Entity also appears in {match.get('case_name', match.get('matched_case_id'))} "
                            f"with {match['confidence']:.0%} confidence."
                        ),
                        "entity_ids": [entity['id']],
                        "alert_type": "cross_case"
                    })