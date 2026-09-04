import json
import random

IPC_PATTERNS = [
    "Section 384 IPC",
    "Section 506 IPC",
    "Section 392 IPC",
    "Section 34 IPC",
    "Section 420 IPC",
    "Section 120B IPC",
    "Section 387 IPC",
    "Section 506(2) IPC",
    "Section 399 IPC",
    "Section 402 IPC",
    "NDPS Act Section 8(c)",
    "NDPS Act Section 21",
    "Section 384 read with Section 34 IPC"
]

LOCATIONS = [
    "Andheri West",
    "Flat No. 204 Sai Krupa CHS"
]

# Generate 30 sentences
new_entries = []
for i in range(30):
    ipc = random.choice(IPC_PATTERNS)
    loc = random.choice(LOCATIONS)
    
    text = f"The accused was found residing at {loc} and was subsequently charged under {ipc} for the offenses committed."
    
    # Calculate offsets
    loc_start = text.find(loc)
    loc_end = loc_start + len(loc)
    
    ipc_start = text.find(ipc)
    ipc_end = ipc_start + len(ipc)
    
    entry = {
        "id": 100 + i,
        "text": text,
        "label": [
            [loc_start, loc_end, "LOCATION"],
            [ipc_start, ipc_end, "IPC_SECTION"]
        ],
        "Comments": []
    }
    new_entries.append(entry)

with open("data/training/admin.jsonl", "a", encoding="utf-8") as f:
    for entry in new_entries:
        f.write(json.dumps(entry) + "\n")

print(f"Appended 30 synthetic sentences to admin.jsonl")
