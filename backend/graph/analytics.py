from graph.algorithms.centrality import compute_centrality
from graph.algorithms.community import detect_communities
from graph.algorithms.anomaly import score_anomalies
from graph.cross_case import run_cross_case_scan_all
from alerts.rules import run_all_rules

async def run_post_ingestion_analytics(case_id: str):
    """
    Orchestrates all analytics algorithms and alert rules that should run
    after a new file is ingested and the graph is updated.
    """
    print(f"[RUN] Running post-ingestion analytics for case {case_id}")

    await compute_centrality(case_id)
    await detect_communities(case_id)
    await score_anomalies(case_id)
    
    # Run cross-case scan. This is a global operation but we trigger it here
    # so any new entities from this case are checked against others.
    try:
        await run_cross_case_scan_all()
    except Exception as e:
        print(f"[WARN] Cross-case scan failed (non-fatal): {e}")

    await run_all_rules(case_id)
    
    print(f"[OK] Post-ingestion analytics complete for case {case_id}")
