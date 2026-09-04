import sys
sys.path.append("backend")
import re
from nlp.ner.entities import PATTERNS

test_text = """
Accused Rajan Kumar @ Raju Bhai S/o Late Suresh Kumar
R/o Flat No. 204 Sai Krupa CHS Andheri West arrived in
vehicle MH-02-BQ-4471 under Section 384 IPC
contact +91-90000-11122
"""

for label, patterns in PATTERNS.items():
    if label == "IPC_SECTION":
        for pattern in patterns:
            print("Pattern:", pattern)
            for match in re.finditer(pattern, test_text):
                print("Matched:", match.group())
