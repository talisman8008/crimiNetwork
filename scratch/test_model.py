import sys
sys.path.append("backend")

from nlp.ner.model import extract_entities

test_text = """
Accused Rajan Kumar @ Raju Bhai S/o Late Suresh Kumar
R/o Flat No. 204 Sai Krupa CHS Andheri West arrived in
vehicle MH-02-BQ-4471 under Section 384 IPC
contact +91-90000-11122
"""

print(f"Testing local NER pipeline on text:\n{test_text.strip()}\n")
print("-" * 50)
print(f"{'ENTITY TEXT':<40} | {'LABEL'}")
print("-" * 50)

entities = extract_entities(test_text)
for ent in entities:
    # Remove newlines from text for cleaner output
    clean_text = ent.text.replace("\n", " ").strip()
    print(f"{clean_text:<40} | {ent.label}")

print("-" * 50)
print(f"Total found: {len(entities)}")
