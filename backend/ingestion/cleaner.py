import re
from datetime import datetime
from dateutil import parser as date_parser

def clean_text(raw_text: str) -> str:
    if not raw_text:
        return ""
    # Lowercase
    text = raw_text.lower()
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove some non-ascii junk but keep basic punctuation
    text = re.sub(r'[^\w\s.,;:()\-+]', '', text)
    return text.strip()

def normalize_phone(phone_str: str) -> str:
    if not phone_str:
        return ""
    # Extract digits
    digits = re.sub(r'\D', '', str(phone_str))
    
    if len(digits) == 10:
        return f"+91{digits}"
    elif len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    elif len(digits) > 10 and digits.startswith("0"):
        # Assume it might be a domestic number with 0 prefix
        rest = digits[1:]
        if len(rest) == 10:
             return f"+91{rest}"
             
    # If not matching standard Indian length, just return with + if possible or as is
    if digits:
        return f"+{digits}"
    return phone_str

def normalize_date(date_str: str) -> str:
    if not date_str:
        return ""
    try:
        value = str(date_str).strip()
        # Never apply day-first parsing to an ISO date. dateutil otherwise reads
        # 2026-06-10 as 6 October when dayfirst=True.
        if re.match(r"^\d{4}-\d{2}-\d{2}", value):
            return datetime.strptime(value[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
        # Indian CDR/FIR inputs such as 10/06/2026 remain day-first.
        parsed_date = date_parser.parse(value, dayfirst=True)
        return parsed_date.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return ""
