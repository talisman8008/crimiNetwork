"""
Phase 3 — Entity data class and regex fallbacks.

The fine-tuned NER model won't catch everything, especially structured
entities like phone numbers and vehicle plates that follow fixed patterns.
This module provides regex-based fallback extraction.
"""

import re
from dataclasses import dataclass
from typing import List

@dataclass
class Entity:
    text: str
    label: str
    start: int
    end: int
    confidence: float
    source_snippet: str   # 20 chars before and after for evidence

ENTITY_TYPES = [
    "PERSON", "ALIAS", "LOCATION", "PHONE",
    "VEHICLE", "ORGANISATION", "IPC_SECTION",
    "DATE_EVENT", "WEAPON",
]

# Regex patterns for structured entities
PATTERNS = {
    "PHONE": [
        r'\+91[-\s]?\d{5}[-\s]?\d{5}',
        r'\+91[-\s]?\d{10}',
        r'[6-9]\d{9}',
    ],
    "VEHICLE": [
        r'[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{4}',
    ],
    "IPC_SECTION": [
        r'[Ss]ection\s+\d{1,3}[A-Z]?(?:\s+(?:read\s+with|r/w)\s+\d{1,3}[A-Z]?)*\s+IPC',
        r'IPC\s+[Ss]ection\s+\d{1,3}[A-Z]?',
        r'NDPS\s+Act\s+[Ss]ection\s+\d{1,3}[A-Z]?(?:\([a-z]\))?',
        r'[Ss]ection\s+\d{1,3}[A-Z]?(?:\([a-z]\))?(?:\s+of\s+the\s+\w+\s+Act)?',
    ],
    "DATE_EVENT": [
        r'\d{2}/\d{2}/\d{4}',
        r'\d{2}-\d{2}-\d{4}',
    ],
}


def apply_regex_fallbacks(text: str, existing_entities: List[Entity]) -> List[Entity]:
    """
    Run regex patterns on text and add any entities not already found by NER.
    If a regex matches, it overrides any overlapping ML predictions.
    """
    new_entities = list(existing_entities)

    for label, patterns in PATTERNS.items():
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                start, end = match.start(), match.end()
                
                # Remove any existing ML entities that overlap with this regex match
                new_entities = [
                    e for e in new_entities 
                    if (end <= e.start or start >= e.end)
                ]
                
                snippet_start = max(0, start - 20)
                snippet_end = min(len(text), end + 20)
                new_entities.append(Entity(
                    text=match.group(),
                    label=label,
                    start=start,
                    end=end,
                    confidence=0.95,
                    source_snippet=text[snippet_start:snippet_end],
                ))

    return sorted(new_entities, key=lambda e: e.start)
