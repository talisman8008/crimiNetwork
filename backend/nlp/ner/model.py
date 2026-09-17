"""
Phase 4 — NER inference module.

Loads the fine-tuned spaCy NER model (or falls back to en_core_web_trf)
and runs entity extraction with regex fallbacks.

Usage (from API):
    from backend.nlp.ner.model import extract_entities
    entities = extract_entities(fir_text)
"""

import spacy
from pathlib import Path
from typing import List
from .entities import Entity, apply_regex_fallbacks

MODEL_PATH = "backend/models/ner/indicbert_finetuned/model-best"
FALLBACK_MODEL = "en_core_web_sm"

_nlp = None


def load_model():
    global _nlp
    if _nlp is not None:
        return _nlp

    if Path(MODEL_PATH).exists():
        print(f"Loading fine-tuned model from {MODEL_PATH}")
        _nlp = spacy.load(MODEL_PATH)
    else:
        print(f"Fine-tuned model not found. Loading fallback: {FALLBACK_MODEL}")
        _nlp = spacy.load(FALLBACK_MODEL)

    return _nlp


def extract_entities(text: str) -> List[Entity]:
    """
    Run NER on text and return a list of Entity objects.
    Combines model predictions with regex fallback patterns.
    """
    nlp = load_model()
    doc = nlp(text)

    # Get entities from model
    entities = []
    for ent in doc.ents:
        snippet_start = max(0, ent.start_char - 20)
        snippet_end = min(len(text), ent.end_char + 20)
        entities.append(Entity(
            text=ent.text,
            label=ent.label_,
            start=ent.start_char,
            end=ent.end_char,
            confidence=float(ent.kb_id_) if ent.kb_id_ else 0.85,
            source_snippet=text[snippet_start:snippet_end],
        ))

    # Add regex fallbacks
    entities = apply_regex_fallbacks(text, entities)

    return entities
