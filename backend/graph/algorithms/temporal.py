from dataclasses import dataclass
from typing import List
from db.neo4j import run_query
from datetime import datetime, timedelta

@dataclass
class GraphSnapshot:
    date: str
    nodes: List[dict]
    edges: List[dict]
    new_node_ids: List[str]
    new_edge_ids: List[str]
    activity_spikes: List[dict]

@dataclass
class SpikeEvent:
    date: str
    node_id: str
    node_name: str
    activity_count: int
    average_activity: float
    spike_ratio: float

async def get_timeline_snapshots(
    case_id: str,
    date_from: str,
    date_to: str,
    interval: str = "week"
) -> List[GraphSnapshot]:
    """
    Returns ordered snapshots of the graph as it builds up over time.
    Each snapshot contains only nodes/edges that existed up to that date.
    Frontend uses this to animate the timeline scrubber.
    """
    snapshots = []
    
    start = datetime.strptime(date_from, "%Y-%m-%d")
    end = datetime.strptime(date_to, "%Y-%m-%d")
    
    delta = timedelta(weeks=1) if interval == "week" else timedelta(days=1)
    
    previous_node_ids = set()
    previous_edge_ids = set()
    current = start
    
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        
        # Fetch all nodes with edges up to this date
        nodes = await run_query("""
            MATCH (n {case_id: $case_id})
            WHERE EXISTS {
                MATCH (n)-[r]-()
                WHERE r.date <= $date
            }
            RETURN n.id as id, n.name as name,
                   labels(n) as type,
                   n.community_id as community_id,
                   n.centrality as centrality,
                   n.anomaly_score as anomaly_score
        """, {"case_id": case_id, "date": date_str})
        
        edges = await run_query("""
            MATCH (a {case_id: $case_id})-[r]->(b {case_id: $case_id})
            WHERE r.date <= $date AND type(r) <> 'PART_OF'
            RETURN a.id + '_' + type(r) + '_' + b.id as edge_id,
                   a.id as source, b.id as target,
                   type(r) as rel_type,
                   r.confidence as confidence,
                   r.date as date
        """, {"case_id": case_id, "date": date_str})
        
        current_node_ids = {n['id'] for n in nodes}
        current_edge_ids = {e['edge_id'] for e in edges}
        
        new_nodes = current_node_ids - previous_node_ids
        new_edges = current_edge_ids - previous_edge_ids
        
        # Add activity_level to each node (edges active in this interval)
        interval_edges = await run_query("""
            MATCH (a {case_id: $case_id})-[r]-(b {case_id: $case_id})
            WHERE r.date >= $from AND r.date <= $to
            WITH a.id as node_id, count(r) as activity
            RETURN node_id, activity
        """, {
            "case_id": case_id,
            "from": (current - delta).strftime("%Y-%m-%d"),
            "to": date_str
        })
        
        activity_map = {r['node_id']: r['activity'] for r in interval_edges}
        
        for node in nodes:
            node['activity_level'] = activity_map.get(node['id'], 0)
        
        snapshots.append(GraphSnapshot(
            date=date_str,
            nodes=nodes,
            edges=edges,
            new_node_ids=list(new_nodes),
            new_edge_ids=list(new_edges),
            activity_spikes=[]
        ))
        
        previous_node_ids = current_node_ids
        previous_edge_ids = current_edge_ids
        current += delta
    
    return snapshots

async def detect_activity_spikes(case_id: str) -> List[SpikeEvent]:
    """
    Detect dates where communication activity is 2x+ the rolling average.
    Returns list of spike events for timeline markers.
    """
    results = await run_query("""
        MATCH (p:Person {case_id: $case_id})-[r:CALLED]-()
        WHERE r.date IS NOT NULL
        WITH p.id as node_id, p.name as name,
             r.date as date, count(r) as daily_count
        RETURN node_id, name, date, daily_count
        ORDER BY node_id, date
    """, {"case_id": case_id})
    
    if not results:
        return []
    
    # Group by node
    from collections import defaultdict
    import statistics
    
    by_node = defaultdict(list)
    for row in results:
        by_node[row['node_id']].append((row['date'], row['daily_count']))
    
    spikes = []
    for node_id, activity in by_node.items():
        counts = [a[1] for a in activity]
        if len(counts) < 3:
            continue
        
        avg = statistics.mean(counts)
        for date, count in activity:
            if count >= avg * 2.0:
                node_name = next(
                    (r['name'] for r in results if r['node_id'] == node_id), node_id
                )
                spikes.append(SpikeEvent(
                    date=date,
                    node_id=node_id,
                    node_name=node_name,
                    activity_count=count,
                    average_activity=round(avg, 1),
                    spike_ratio=round(count / avg, 2)
                ))
    
    return sorted(spikes, key=lambda s: s.spike_ratio, reverse=True)