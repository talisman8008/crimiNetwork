import uuid
from typing import List
from dataclasses import dataclass
from db.neo4j import run_query
from .confidence import score_edge

@dataclass
class Entity:
    text: str
    label: str
    start: int
    end: int
    confidence: float
    source_snippet: str

async def add_entities(
    case_id: str,
    entities: List[Entity],
    records: List[dict],
    source_type: str,
    source_file: str,
    confidence: float
):
    """
    Called by Backend Dev 2's process() after NER.
    Writes entities as nodes and relationships to Neo4j.
    """
    print(f"Building graph for {source_type} in case {case_id}")
    
    # Step 1: Ensure Case node exists
    await run_query("""
        MERGE (c:Case {id: $case_id})
        SET c.name = $case_id, c.updated_at = timestamp()
    """, {"case_id": case_id})
    
    # Step 2: Create entity nodes from NER output
    for entity in entities:
        node_id = _generate_node_id(entity.text, entity.label, case_id)
        await _create_or_merge_node(node_id, entity, case_id, source_type,
                                     source_file, confidence)
    
    # Step 3: Create relationships from structured records
    if source_type == "cdr":
        await _process_cdr_records(records, case_id, source_file, confidence)
    elif source_type == "financial":
        await _process_financial_records(records, case_id, source_file, confidence)
    elif source_type == "fir":
        await _process_fir_entities(entities, case_id, source_file, confidence)
    elif source_type == "social_media":
        await _process_social_records(records, case_id, source_file, confidence)
        await _process_fir_entities(entities, case_id, source_file, confidence) # also link NER entities
    
    print(f"✓ Graph built for {source_type}")
    
    # Step 4: Trigger intelligence pipeline
    from graph.algorithms.centrality import compute_centrality
    from graph.algorithms.community import detect_communities
    from graph.algorithms.anomaly import score_anomalies
    
    await compute_centrality(case_id)
    await detect_communities(case_id)
    await score_anomalies(case_id)

def _generate_node_id(text: str, label: str, case_id: str) -> str:
    """Generate consistent node ID for same entity text."""
    normalized = text.lower().strip().replace(" ", "_")
    return f"{case_id}_{label}_{normalized}"

async def _create_or_merge_node(
    node_id: str,
    entity: Entity,
    case_id: str,
    source_type: str,
    source_file: str,
    confidence: float
):
    """MERGE so re-uploading same data never creates duplicate nodes."""
    label = entity.label
    
    # Map entity label to Neo4j node label
    node_label_map = {
        "PERSON": "Person",
        "LOCATION": "Location",
        "PHONE": "Phone",
        "VEHICLE": "Vehicle",
        "ALIAS": "Person",      # aliases become Person nodes with alias flag
        "IPC_SECTION": "IpcSection",
        "WEAPON": "Weapon",
    }
    
    node_label = node_label_map.get(label, "Entity")
    
    cypher = f"""
        MERGE (n:{node_label} {{id: $id}})
        SET n.name = $name,
            n.case_id = $case_id,
            n.entity_type = $entity_type,
            n.confidence = CASE WHEN n.confidence IS NULL 
                          THEN $confidence 
                          ELSE (n.confidence + $confidence) / 2 END,
            n.sources = CASE WHEN $source_file IN coalesce(n.sources, [])
                        THEN n.sources
                        ELSE coalesce(n.sources, []) + [$source_file] END,
            n.appearance_count = coalesce(n.appearance_count, 0) + 1,
            n.updated_at = timestamp()
        WITH n
        MATCH (c:Case {{id: $case_id}})
        MERGE (n)-[:PART_OF]->(c)
    """
    
    await run_query(cypher, {
        "id": node_id,
        "name": entity.text,
        "case_id": case_id,
        "entity_type": label,
        "confidence": confidence,
        "source_file": source_file,
    })

async def _process_cdr_records(
    records: List[dict],
    case_id: str,
    source_file: str,
    confidence: float
):
    """Create CALLED relationships from CDR records."""
    for record in records:
        caller = record.get("caller")
        callee = record.get("callee")
        
        if not caller or not callee:
            continue
        
        caller_id = _generate_node_id(caller, "PHONE", case_id)
        callee_id = _generate_node_id(callee, "PHONE", case_id)
        
        await run_query("""
            MERGE (a:Phone {id: $caller_id})
            SET a.name = $caller, a.case_id = $case_id
            MERGE (b:Phone {id: $callee_id})
            SET b.name = $callee, b.case_id = $case_id
            MERGE (a)-[r:CALLED]->(b)
            SET r.confidence = $confidence,
                r.source_file = $source_file,
                r.source_row = $row,
                r.date = $date,
                r.duration_seconds = $duration,
                r.tower_area = $tower,
                r.frequency = coalesce(r.frequency, 0) + 1
        """, {
            "caller_id": caller_id,
            "callee_id": callee_id,
            "caller": caller,
            "callee": callee,
            "case_id": case_id,
            "confidence": confidence,
            "source_file": source_file,
            "row": record.get("row_number", "unknown"),
            "date": record.get("datetime", ""),
            "duration": record.get("duration_seconds", 0),
            "tower": record.get("tower_location", ""),
        })

async def _process_financial_records(
    records: List[dict],
    case_id: str,
    source_file: str,
    confidence: float
):
    """Create TRANSACTED_WITH relationships from financial records."""
    for record in records:
        sender = record.get("sender")
        receiver = record.get("receiver")
        
        if not sender or not receiver:
            continue
        
        sender_id = _generate_node_id(sender, "PERSON", case_id)
        receiver_id = _generate_node_id(receiver, "PERSON", case_id)
        
        await run_query("""
            MERGE (a:Person {id: $sender_id})
            SET a.name = $sender, a.case_id = $case_id
            MERGE (b:Person {id: $receiver_id})
            SET b.name = $receiver, b.case_id = $case_id
            MERGE (a)-[r:TRANSACTED_WITH]->(b)
            SET r.confidence = $confidence,
                r.source_file = $source_file,
                r.source_row = $row,
                r.date = $date,
                r.amount = $amount,
                r.transaction_type = $tx_type,
                r.frequency = coalesce(r.frequency, 0) + 1
        """, {
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "sender": sender,
            "receiver": receiver,
            "case_id": case_id,
            "confidence": confidence,
            "source_file": source_file,
            "row": record.get("row_number", "unknown"),
            "date": record.get("date", ""),
            "amount": record.get("amount", 0),
            "tx_type": record.get("transaction_type", "unknown"),
        })

async def _process_fir_entities(
    entities: List[Entity],
    case_id: str,
    source_file: str,
    confidence: float
):
    """Create MENTIONED_WITH relationships between persons in same FIR."""
    persons = [e for e in entities if e.label in ("PERSON", "ALIAS")]
    
    for i in range(len(persons)):
        for j in range(i + 1, len(persons)):
            a_id = _generate_node_id(persons[i].text, "PERSON", case_id)
            b_id = _generate_node_id(persons[j].text, "PERSON", case_id)
            
            await run_query("""
                MERGE (a:Person {id: $a_id})
                MERGE (b:Person {id: $b_id})
                MERGE (a)-[r:MENTIONED_WITH]->(b)
                SET r.confidence = $confidence,
                    r.source_file = $source_file,
                    r.frequency = coalesce(r.frequency, 0) + 1
            """, {
                "a_id": a_id,
                "b_id": b_id,
                "confidence": confidence,
                "source_file": source_file,
            })

async def _process_social_records(
    records: List[dict],
    case_id: str,
    source_file: str,
    confidence: float
):
    """Create POSTED_ON relationships from social media records."""
    for i, record in enumerate(records):
        username = record.get('username')
        platform = record.get('platform')
        
        if not username:
            continue
            
        user_id = _generate_node_id(username, 'PERSON', case_id)
        
        await run_query("""
            MERGE (a:Person {id: $user_id})
            SET a.name = $username, a.case_id = $case_id, a.social_platform = $platform
            WITH a
            MERGE (p:Platform {name: $platform})
            MERGE (a)-[r:POSTED_ON]->(p)
            SET r.confidence = $confidence,
                r.source_file = $source_file,
                r.date = $date,
                r.content = $content,
                r.source_row = $row,
                r.frequency = coalesce(r.frequency, 0) + 1
        """, {
            "user_id": user_id,
            "username": username,
            "platform": platform,
            "case_id": case_id,
            "confidence": confidence,
            "source_file": source_file,
            "row": str(i+1),
            "date": record.get("date", ""),
            "content": record.get("content", "")
        })