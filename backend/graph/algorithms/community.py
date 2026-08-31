import networkx as nx
import community as community_louvain
from db.neo4j import run_query
from .centrality import _load_graph

async def detect_communities(case_id: str):
    """
    Run Louvain community detection.
    Assigns community_id integer to each node.
    Writes back to Neo4j.
    """
    print(f"Detecting communities for case {case_id}")
    
    G = await _load_graph(case_id)
    
    if len(G.nodes) < 2:
        print("Too few nodes for community detection")
        return
    
    # Louvain needs undirected graph
    G_undirected = G.to_undirected()
    
    partition = community_louvain.best_partition(G_undirected)
    # partition = {node_id: community_id}
    
    # Count how many communities each node bridges (for Role Explainer)
    communities_by_node = {}
    for node_id in G.nodes:
        neighbors = list(G.neighbors(node_id)) + list(G.predecessors(node_id))
        neighbor_communities = {partition.get(n) for n in neighbors if n in partition}
        own_community = partition.get(node_id)
        bridged = len(neighbor_communities - {own_community})
        communities_by_node[node_id] = bridged
    
    # Write back to Neo4j
    for node_id, community_id in partition.items():
        await run_query("""
            MATCH (n {id: $node_id, case_id: $case_id})
            SET n.community_id = $community_id,
                n.communities_bridged = $bridged
        """, {
            "node_id": node_id,
            "case_id": case_id,
            "community_id": community_id,
            "bridged": communities_by_node.get(node_id, 0),
        })
    
    num_communities = len(set(partition.values()))
    print(f"✓ Found {num_communities} communities across {len(G.nodes)} nodes")