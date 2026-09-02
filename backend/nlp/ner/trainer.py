"""
Phase 2.2 — NER fine-tuning trainer.

Run this script ONCE to fine-tune the NER model on annotated FIR data.
Not part of the API — offline training only.

Usage:
    cd crimiNetwork
    python -m backend.nlp.ner.trainer

Prereqs:
    1. Run  python data/training/convert_to_spacy.py  first
    2. Ensure data/training/config.cfg exists

Saves model to: backend/models/ner/indicbert_finetuned/
"""

import subprocess
import sys
from pathlib import Path


def train():
    train_path = "data/training/spacy_data/train.spacy"
    dev_path = "data/training/spacy_data/dev.spacy"
    config_path = "data/training/config.cfg"
    output_path = "backend/models/ner/indicbert_finetuned"

    # Verify files exist
    for path in [train_path, dev_path, config_path]:
        if not Path(path).exists():
            print(f"ERROR: {path} not found. Run convert_to_spacy.py first.")
            sys.exit(1)

    print("=" * 60)
    print("Starting NER fine-tuning...")
    print(f"  Train data : {train_path}")
    print(f"  Dev data   : {dev_path}")
    print(f"  Config     : {config_path}")
    print(f"  Output     : {output_path}")
    print("=" * 60)

    # Run spaCy training
    result = subprocess.run([
        sys.executable, "-m", "spacy", "train",
        config_path,
        "--output", output_path,
        "--paths.train", train_path,
        "--paths.dev", dev_path,
    ], capture_output=False)

    if result.returncode == 0:
        print("\n" + "=" * 60)
        print("✓ Training complete!")
        print(f"  Model saved to: {output_path}/model-best/")
        print("=" * 60)
        print("\nNext step: Test the model with:")
        print("  python -c \"import spacy; nlp = spacy.load('backend/models/ner/indicbert_finetuned/model-best'); "
              "doc = nlp('Accused Rajan Kumar arrived in vehicle MH-02-BQ-4471'); "
              "print([(ent.text, ent.label_) for ent in doc.ents])\"")
    else:
        print("\n✗ Training failed. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    train()
