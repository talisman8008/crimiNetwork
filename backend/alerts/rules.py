from db.neo4j import run_query
from .service import create_alert
from typing import Optional

async def check_communication_spike(case_id: str):
    """Alert if any node's call frequency spikes 2x+ their rolling average."""
    results = await run_query("""
        MATCH (p:Phone {case_id: $case_id})-[r:CALLED]-()
        WHERE r.date IS NOT NULL
        WITH p, r.date as date, count(r) as daily
        WITH p, avg(daily) as avg_daily,
             max(daily) as peak_daily,
             collect({date: date, count: daily}) as activity
        WHERE peak_daily >= avg_daily * 2
        RETURN p.id as node_id, p.name as name,
               avg_daily, peak_daily
    """, {"case_id": case_id})
    
    for row in results:
        await create_alert(case_id, {
            "severity": "MEDIUM",
            "title": f"Communication spike: {row['name']}",
            "description": (
                f"{row['name']} shows {row['peak_daily']:.0f} calls on peak day "
                f"vs average of {row['avg_daily']:.1f}. "
                f"Spike ratio: {row['peak_daily']/max(row['avg_daily'],1):.1f}x"
            ),
            "entity_ids": [row['node_id']],
            "alert_type": "spike"
        })

async def check_circular_transactions(case_id: str):
    """Detect circular financial flows: A → B → C → A (money laundering pattern)."""
    results = await run_query("""
        MATCH cycle = (a:Person {case_id: $case_id})
                      -[:TRANSACTED_WITH*2..4]->
                      (a)
        RETURN [n IN nodes(cycle) | n.name] as cycle_names,
               [n IN nodes(cycle) | n.id] as cycle_ids,
               length(cycle) as hops
        LIMIT 5
    """, {"case_id": case_id})
    
    for row in results:
        names = " → ".join(row['cycle_names'])
        await create_alert(case_id, {
            "severity": "HIGH",
            "title": "Circular transaction detected",
            "description": (
                f"Circular financial flow detected across {row['hops']} parties: "
                f"{names}. Possible money laundering pattern."
            ),
            "entity_ids": row['cycle_ids'],
            "alert_type": "circular_tx"
        })

async def check_hawala_transactions(case_id: str):
    """Alert on any Hawala transaction type."""
    results = await run_query("""
        MATCH (a)-[r:TRANSACTED_WITH]->(b)
        WHERE a.case_id = $case_id AND r.transaction_type = 'Hawala'
        RETURN a.id as sender_id, a.name as sender,
               b.id as receiver_id, b.name as receiver,
               r.amount as amount, r.date as date
    """, {"case_id": case_id})
    
    for row in results:
        await create_alert(case_id, {
            "severity": "HIGH",
            "title": f"Hawala transaction: {row['sender']} → {row['receiver']}",
            "description": (
                f"Hawala (informal value transfer) of ₹{row.get('amount', 'unknown')} "
                f"from {row['sender']} to {row['receiver']} on {row.get('date', 'unknown date')}."
            ),
            "entity_ids": [row['sender_id'], row['receiver_id']],
            "alert_type": "hawala"
        })

async def run_all_rules(case_id: str):
    """Run all alert rules for a case. Called after intelligence pipeline."""
    await check_communication_spike(case_id)
    await check_circular_transactions(case_id)
    await check_hawala_transactions(case_id)