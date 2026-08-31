CONFIDENCE_SCORES = {
    "cdr": 0.95,
    "financial": 0.90,
    "fir": 0.75,
    "surveillance": 0.70,
    "social_media": 0.45,
}

def score_edge(source_type: str, corroboration_count: int = 1) -> float:
    """
    Score an edge based on source type.
    Boost if same relationship confirmed in multiple sources.
    """
    base = CONFIDENCE_SCORES.get(source_type, 0.5)
    boost = min(0.05 * (corroboration_count - 1), 0.10)
    return min(round(base + boost, 3), 1.0)

def confidence_to_style(confidence: float) -> str:
    """Returns edge style for frontend rendering."""
    if confidence >= 0.85:
        return "solid_thick"
    elif confidence >= 0.60:
        return "solid"
    else:
        return "dashed"