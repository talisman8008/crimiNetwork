"""
Phase 1.3 — Convert Doccano JSONL annotations to spaCy DocBin format.

Reads:  data/admin.jsonl  (Doccano export)
Writes: data/training/spacy_data/train.spacy
        data/training/spacy_data/dev.spacy

Usage:
    cd crimiNetwork
    python data/training/convert_to_spacy.py
"""

import json
import random
from pathlib import Path

import spacy
from spacy.tokens import DocBin


def convert_doccano_to_spacy(input_file: str, output_dir: str):
    nlp = spacy.blank("en")

    # ── Read annotations ────────────────────────────────────────────
    data = []
    with open(input_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))

    print(f"Loaded {len(data)} annotated documents")

    # ── Collect unique entity types ─────────────────────────────────
    label_set = set()
    for item in data:
        for start, end, label in item.get("label", []):
            label_set.add(label)
    print(f"Entity types found: {sorted(label_set)}")

    # ── Convert to (text, {"entities": [...]}) tuples ───────────────
    training_data = []
    for item in data:
        text = item["text"]
        entities = [(start, end, label) for start, end, label in item.get("label", [])]
        training_data.append((text, {"entities": entities}))

    # ── Shuffle and split 80 / 20 ──────────────────────────────────
    random.seed(42)
    random.shuffle(training_data)
    split = int(len(training_data) * 0.8)
    train_data = training_data[:split]
    dev_data = training_data[split:]

    print(f"Train: {len(train_data)} | Dev: {len(dev_data)}")

    # ── Build DocBin objects ────────────────────────────────────────
    def make_docbin(data_list, nlp_blank):
        db = DocBin()
        skipped = 0
        for text, annotations in data_list:
            doc = nlp_blank.make_doc(text)
            ents = []
            for start, end, label in annotations["entities"]:
                span = doc.char_span(start, end, label=label)
                if span is None:
                    skipped += 1
                    print(f"  [WARN] Skipped misaligned span: [{start}:{end}] '{text[start:end]}' -> {label}")
                    continue
                ents.append(span)
            try:
                doc.ents = ents
            except ValueError as e:
                # Overlapping spans — use filter_spans as fallback
                from spacy.util import filter_spans
                doc.ents = filter_spans(ents)
                print(f"  [WARN] Overlapping spans resolved via filter_spans: {e}")
            db.add(doc)
        print(f"  Skipped {skipped} misaligned spans total")
        return db

    print("\nBuilding train set...")
    train_db = make_docbin(train_data, nlp)
    print("Building dev set...")
    dev_db = make_docbin(dev_data, nlp)

    # ── Save ────────────────────────────────────────────────────────
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    train_db.to_disk(output / "train.spacy")
    dev_db.to_disk(output / "dev.spacy")

    print(f"\n[OK] Saved to {output_dir}")
    print("  train.spacy and dev.spacy ready for training")


if __name__ == "__main__":
    # Resolve paths relative to project root (two levels up from this script)
    project_root = Path(__file__).resolve().parent.parent.parent
    convert_doccano_to_spacy(
        input_file=str(project_root / "data" / "training" / "admin.jsonl"),
        output_dir=str(project_root / "data" / "training" / "spacy_data"),
    )
