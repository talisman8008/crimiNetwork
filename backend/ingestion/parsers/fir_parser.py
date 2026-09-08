import pdfplumber
import re

def parse_fir(file_path: str) -> dict:
    raw_text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    raw_text += text + "\n"
    except Exception:
        # If pdfplumber fails, maybe it's a txt file
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_text = f.read()

    # Simple regex extractions as placeholders before NER
    fir_number_match = re.search(r'(FIR No\.|FIR Number|CR No\.)[:\-\s]+([A-Z0-9\-/]+)', raw_text, re.IGNORECASE)
    fir_number = fir_number_match.group(2) if fir_number_match else ""

    date_match = re.search(r'(Date|Dated)[\s:]+([\d]{1,2}[/-][\d]{1,2}[/-][\d]{2,4})', raw_text, re.IGNORECASE)
    date_filed = date_match.group(2) if date_match else ""

    station_match = re.search(r'(Police Station|P\.S\.)[\s:]+([A-Za-z\s]+)', raw_text, re.IGNORECASE)
    police_station = station_match.group(2).strip() if station_match else ""

    # Extract sections like "302 IPC", "U/S 420"
    sections = []
    section_matches = re.finditer(r'(U/S|Under Section|Sec\.?)[\s:]+([\d\w, ]+)(IPC|Act)?', raw_text, re.IGNORECASE)
    for match in section_matches:
        sections.append(match.group(0).strip())
        
    return {
        "raw_text": raw_text,
        "fir_number": fir_number,
        "date_filed": date_filed,
        "police_station": police_station,
        "sections": list(set(sections)),
        "persons_mentioned": []
    }
