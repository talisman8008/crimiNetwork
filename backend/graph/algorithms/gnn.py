import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv
from torch_geometric.data import Data
from torch_geometric.utils import negative_sampling
from dataclasses import dataclass
from typing import List
from db.neo4j import run_query
import os

@dataclass
class PredictedLink:
    node_a_id: str
    node_a_name: str
    node_b_id: str
    node_b_name: str
    confidence: float
    basis: str

class GraphSAGELinkPredictor(torch.nn.Module):
    def __init__(self, in_channels=4, hidden_channels=64, out_channels=32):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, out_channels)
    
    def encode(self, x, edge_index):
        x = self.conv1(x, edge_index).relu()
        x = F.dropout(x, p=0.3, training=self.training)
        return self.conv2(x, edge_index)
    
    def decode(self, z, edge_index):
        return (z[edge_index[0]] * z[edge_index[1]]).sum(dim=-1)
    
    def forward(self, x, edge_index):
        z = self.encode(x, edge_index)
        return z

async def _load_pyg_data(case_id: str):
    """Load Neo4j graph into PyTorch Geometric Data object."""
    nodes = await run_query(
        """MATCH (n {case_id: $case_id})
           WHERE NOT n:Case
           RETURN n.id as id, n.name as name,
                  coalesce(n.pagerank, 0.0) as pr,
                  coalesce(n.betweenness, 0.0) as bt,
                  coalesce(n.degree, 0) as deg,
                  coalesce(n.anomaly_score, 0) as anomaly""",
        {"case_id": case_id}
    )
    
    if not nodes:
        return None, {}, []
    
    # Node index mapping
    node_to_idx = {n['id']: i for i, n in enumerate(nodes)}
    
    # Feature matrix
    x = torch.tensor([
        [n['pr'], n['bt'], n['deg'] / 100.0, n['anomaly'] / 100.0]
        for n in nodes
    ], dtype=torch.float)
    
    # Edges
    edges = await run_query("""
        MATCH (a {case_id: $case_id})-[r]->(b {case_id: $case_id})
        WHERE type(r) <> 'PART_OF' AND type(r) <> 'ALIAS_OF'
        RETURN a.id as source, b.id as target
    """, {"case_id": case_id})
    
    if not edges:
        return None, node_to_idx, nodes
    
    edge_index = torch.tensor([
        [node_to_idx[e['source']] for e in edges if e['source'] in node_to_idx],
        [node_to_idx[e['target']] for e in edges if e['target'] in node_to_idx]
    ], dtype=torch.long)
    
    data = Data(x=x, edge_index=edge_index)
    return data, node_to_idx, nodes

async def train_gnn(case_id: str, epochs: int = 200):
    """Train GraphSAGE on case graph. Saves model weights."""
    print(f"Training GNN for case {case_id}")
    
    data, node_to_idx, nodes = await _load_pyg_data(case_id)
    
    if data is None or data.num_nodes < 4:
        print("Not enough nodes to train GNN")
        return
    
    model = GraphSAGELinkPredictor()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    
    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        
        z = model(data.x, data.edge_index)
        
        # Positive edges (existing)
        pos_edge_index = data.edge_index
        
        # Negative edges (non-existing)
        neg_edge_index = negative_sampling(
            edge_index=data.edge_index,
            num_nodes=data.num_nodes,
            num_neg_samples=data.edge_index.size(1)
        )
        
        pos_pred = model.decode(z, pos_edge_index).sigmoid()
        neg_pred = model.decode(z, neg_edge_index).sigmoid()
        
        loss = F.binary_cross_entropy(
            torch.cat([pos_pred, neg_pred]),
            torch.cat([
                torch.ones(pos_pred.size(0)),
                torch.zeros(neg_pred.size(0))
            ])
        )
        
        loss.backward()
        optimizer.step()
        
        if epoch % 50 == 0:
            print(f"Epoch {epoch}: Loss = {loss.item():.4f}")
    
    # Save model
    os.makedirs(f"backend/models/gnn", exist_ok=True)
    torch.save({
        'model_state': model.state_dict(),
        'node_to_idx': node_to_idx,
        'nodes': nodes,
        'case_id': case_id
    }, f"backend/models/gnn/{case_id}_weights.pt")
    
    print(f"✓ GNN trained and saved for case {case_id}")

async def predict_hidden_links(case_id: str, top_k: int = 10) -> List[PredictedLink]:
    """Load trained model and predict top-k hidden links."""
    model_path = f"backend/models/gnn/{case_id}_weights.pt"
    
    if not os.path.exists(model_path):
        print(f"No trained GNN found for {case_id}. Train first.")
        return []
    
    checkpoint = torch.load(model_path)
    node_to_idx = checkpoint['node_to_idx']
    nodes = checkpoint['nodes']
    idx_to_node = {v: k for k, v in node_to_idx.items()}
    node_info = {n['id']: n for n in nodes}
    
    data, _, _ = await _load_pyg_data(case_id)
    if data is None:
        return []
    
    model = GraphSAGELinkPredictor()
    model.load_state_dict(checkpoint['model_state'])
    model.eval()
    
    with torch.no_grad():
        z = model(data.x, data.edge_index)
    
    # Score all non-existing pairs
    existing_edges = set(zip(
        data.edge_index[0].tolist(),
        data.edge_index[1].tolist()
    ))
    
    predictions = []
    n = data.num_nodes
    
    for i in range(n):
        for j in range(i + 1, n):
            if (i, j) not in existing_edges and (j, i) not in existing_edges:
                score = torch.sigmoid(
                    (z[i] * z[j]).sum()
                ).item()
                
                if score > 0.5:
                    node_a_id = idx_to_node.get(i)
                    node_b_id = idx_to_node.get(j)
                    
                    if node_a_id and node_b_id:
                        predictions.append(PredictedLink(
                            node_a_id=node_a_id,
                            node_a_name=node_info.get(node_a_id, {}).get('name', node_a_id),
                            node_b_id=node_b_id,
                            node_b_name=node_info.get(node_b_id, {}).get('name', node_b_id),
                            confidence=round(score, 3),
                            basis="structural similarity in criminal network"
                        ))
    
    predictions.sort(key=lambda p: p.confidence, reverse=True)
    return predictions[:top_k]