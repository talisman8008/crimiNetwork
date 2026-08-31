# reports/generator.py
import os
from datetime import datetime
from db.neo4j import run_query

async def generate_report(case_id: str, report_type: str, fmt: str) -> str:
    """
    Generates a basic text report for the case.
    Returns file path to generated report.
    report_type: "full" | "network_summary" | "suspect_dossier"
    fmt: "txt" (expand to pdf/docx later)
    """
    data = await _collect_report_data(case_id)
    content = _build_report_text(case_id, report_type, data)
    
    os.makedirs("reports_output", exist_ok=True)
    filename = f"reports_output/{case_id}_{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    with open(filename, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"✓ Report saved to {filename}")
    return filename

async def _collect_report_data(case_id: str) -> dict:
    # Top suspects by centrality
    suspects = await run_query("""
        MATCH (p:Person {case_id: $case_id})
        WHERE p.pagerank IS NOT NULL
        RETURN p.name as name, p.pagerank as pagerank,
               p.anomaly_score as anomaly_score,
               p.community_id as community_id
        ORDER BY p.pagerank DESC LIMIT 10
    """, {"case_id": case_id})
    
    # Total counts
    counts = await run_query("""
        MATCH (n {case_id: $case_id}) WHERE NOT n:Case
        RETURN count(n) as total_entities
    """, {"case_id": case_id})
    
    # Relationship count
    rels = await run_query("""
        MATCH (a {case_id: $case_id})-[r]->(b {case_id: $case_id})
        WHERE type(r) <> 'PART_OF'
        RETURN count(r) as total_relationships
    """, {"case_id": case_id})
    
    return {
        "suspects": suspects,
        "total_entities": counts[0]['total_entities'] if counts else 0,
        "total_relationships": rels[0]['total_relationships'] if rels else 0,
    }

def _build_report_text(case_id: str, report_type: str, data: dict) -> str:
    lines = [
        "=" * 60,
        f"CRIMINAL NETWORK ANALYSIS REPORT",
        f"Case ID: {case_id}",
        f"Report Type: {report_type.upper()}",
        f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        "FICTIONAL / SYNTHETIC DATA — DEMO PURPOSES ONLY",
        "=" * 60,
        "",
        f"NETWORK SUMMARY",
        f"Total Entities: {data['total_entities']}",
        f"Total Relationships: {data['total_relationships']}",
        "",
        "TOP SUSPECTS BY INFLUENCE:",
    ]
    
    for i, s in enumerate(data['suspects'], 1):
        lines.append(
            f"  {i}. {s['name']} | "
            f"Influence: {s['pagerank']:.4f} | "
            f"Risk Score: {s.get('anomaly_score') or 'N/A'} | "
            f"Community: {s.get('community_id') or 'N/A'}"
        )
    
    lines += ["", "=" * 60, "END OF REPORT"]
    return "\n".join(lines)