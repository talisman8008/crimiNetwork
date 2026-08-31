import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from db.neo4j import run_query

async def score_anomalies(case_id: str):
    """
    Score each Person node for anomalous behavior using Isolation Forest.
    Features derived from CDR and financial patterns.
    Writes anomaly_score (0-100) to each node.
    Flags nodes > 70 for alert generation.
    """
    print(f"Scoring anomalies for case {case_id}")
    
    # Fetch CDR features per person/phone
    cdr_stats = await run_query("""
        MATCH (p)-[r:CALLED]->(q)
        WHERE p.case_id = $case_id
        WITH p.id as node_id,
             count(r) as call_count,
             count(DISTINCT q.id) as unique_contacts,
             sum(CASE WHEN r.tower_area CONTAINS 'night' THEN 1 ELSE 0 END) as night_calls
        RETURN node_id, call_count, unique_contacts, night_calls
    """, {"case_id": case_id})
    
    # Fetch financial features per person
    fin_stats = await run_query("""
        MATCH (p)-[r:TRANSACTED_WITH]->(q)
        WHERE p.case_id = $case_id
        WITH p.id as node_id,
             count(r) as tx_count,
             sum(r.amount) as total_amount,
             avg(r.amount) as avg_amount
        RETURN node_id, tx_count, total_amount, avg_amount
    """, {"case_id": case_id})
    
    if not cdr_stats and not fin_stats:
        print("No CDR/financial data — skipping anomaly scoring")
        return
    
    # Build feature dataframe
    features = {}
    
    for row in cdr_stats:
        nid = row['node_id']
        if nid not in features:
            features[nid] = _empty_features()
        features[nid]['call_count'] = row['call_count'] or 0
        features[nid]['unique_contacts'] = row['unique_contacts'] or 0
        features[nid]['night_calls'] = row['night_calls'] or 0
        total = features[nid]['call_count']
        features[nid]['night_call_ratio'] = (
            features[nid]['night_calls'] / total if total > 0 else 0
        )
    
    for row in fin_stats:
        nid = row['node_id']
        if nid not in features:
            features[nid] = _empty_features()
        features[nid]['tx_count'] = row['tx_count'] or 0
        features[nid]['total_amount'] = row['total_amount'] or 0
        features[nid]['avg_amount'] = row['avg_amount'] or 0
    
    if not features:
        return
    
    node_ids = list(features.keys())
    X = pd.DataFrame([features[nid] for nid in node_ids]).fillna(0)
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Isolation Forest
    clf = IsolationForest(contamination=0.1, random_state=42)
    clf.fit(X_scaled)
    
    # scores: -1 = anomalous, 1 = normal
    raw_scores = clf.decision_function(X_scaled)
    
    # Normalize to 0-100 (higher = more anomalous)
    min_s, max_s = raw_scores.min(), raw_scores.max()
    normalized = [
        int(100 * (1 - (s - min_s) / (max_s - min_s + 1e-9)))
        for s in raw_scores
    ]
    
    # Write scores to Neo4j and fire alerts for high scorers
    from alerts.service import create_alert
    
    for node_id, score in zip(node_ids, normalized):
        feat = features[node_id]
        
        # Build factor explanation
        factors = []
        if feat.get('night_call_ratio', 0) > 0.3:
            factors.append(f"Night call ratio: {feat['night_call_ratio']:.0%}")
        if feat.get('unique_contacts', 0) > 15:
            factors.append(f"Unique contacts: {int(feat['unique_contacts'])}")
        if feat.get('tx_count', 0) > 10:
            factors.append(f"Transaction count: {int(feat['tx_count'])}")
        
        await run_query("""
            MATCH (n {id: $node_id, case_id: $case_id})
            SET n.anomaly_score = $score,
                n.anomaly_factors = $factors
        """, {
            "node_id": node_id,
            "case_id": case_id,
            "score": score,
            "factors": factors,
        })
        
        # Fire alert for high anomaly scores
        if score > 70:
            node_info = await run_query(
                "MATCH (n {id: $id}) RETURN n.name as name",
                {"id": node_id}
            )
            name = node_info[0]['name'] if node_info else node_id
            await create_alert(case_id, {
                "severity": "HIGH",
                "title": f"High anomaly score: {name}",
                "description": f"{name} shows anomalous patterns. Score: {score}/100. Factors: {', '.join(factors)}",
                "entity_ids": [node_id],
                "alert_type": "anomaly"
            })
    
    print(f"✓ Anomaly scores computed for {len(node_ids)} nodes")

def _empty_features():
    return {
        "call_count": 0,
        "unique_contacts": 0,
        "night_calls": 0,
        "night_call_ratio": 0,
        "tx_count": 0,
        "total_amount": 0,
        "avg_amount": 0,
    }