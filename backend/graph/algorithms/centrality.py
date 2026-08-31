import networkx as nx
from db.neo4j import run_query
import numpy as np

async def compute_centrality(case_id: str):
    """
    Compute PageRank and betweenness centrality for all nodes in case.
    Writes scores back to Neo4j.
    Percentiles computed for Role Explainer (Dev 2 uses these).
    """
    print(f"Computing centrality for case {case_id}")
    
    # Load graph from Neo4j into NetworkX
    G = await _load_graph(case_id)
    
    if len(G.nodes) == 0:
        print("No nodes found — skipping centrality")
        return
    
    # PageRank
    pagerank = nx.pagerank(G, alpha=0.85)
    
    # Betweenness centrality (normalize=True for comparability)
    betweenness = nx.betweenness_centrality(G, normalized=True)
    
    # Degree centrality
    degree = dict(G.degree())
    
    # Compute percentile ranks
    pr_values = list(pagerank.values())
    bt_values = list(betweenness.values())
    
    # Write back to Neo4j
    for node_id in G.nodes:
        pr = pagerank.get(node_id, 0)
        bt = betweenness.get(node_id, 0)
        deg = degree.get(node_id, 0)
        
        pr_percentile = int(np.percentile(
            [1 if v <= pr else 0 for v in pr_values], 100
        ) if pr_values else 50)
        
        bt_percentile = int(
            sum(1 for v in bt_values if v <= bt) / len(bt_values) * 100
            if bt_values else 50
        )
        
        await run_query("""
            MATCH (n {id: $node_id, case_id: $case_id})
            SET n.pagerank = $pr,
                n.pagerank_percentile = $pr_pct,
                n.betweenness = $bt,
                n.betweenness_percentile = $bt_pct,
                n.degree = $deg
        """, {
            "node_id": node_id,
            "case_id": case_id,
            "pr": round(pr, 6),
            "pr_pct": pr_percentile,
            "bt": round(bt, 6),
            "bt_pct": bt_percentile,
            "deg": deg,
        })
    
    print(f"✓ Centrality computed for {len(G.nodes)} nodes")

async def _load_graph(case_id: str) -> nx.DiGraph:
    """Fetch all nodes and edges for case into NetworkX."""
    G = nx.DiGraph()
    
    # Fetch nodes
    nodes = await run_query(
        "MATCH (n {case_id: $case_id}) RETURN n.id as id, n.name as name, labels(n) as labels",
        {"case_id": case_id}
    )
    for node in nodes:
        G.add_node(node['id'], name=node['name'], labels=node['labels'])
    
    # Fetch edges
    edges = await run_query("""
        MATCH (a {case_id: $case_id})-[r]->(b {case_id: $case_id})
        WHERE type(r) <> 'PART_OF'
        RETURN a.id as source, b.id as target,
               type(r) as rel_type, r.confidence as confidence,
               coalesce(r.frequency, 1) as weight
    """, {"case_id": case_id})
    
    for edge in edges:
        G.add_edge(
            edge['source'], edge['target'],
            rel_type=edge['rel_type'],
            confidence=edge['confidence'] or 0.5,
            weight=edge['weight']
        )
    
    return G