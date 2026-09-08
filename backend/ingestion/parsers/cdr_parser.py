import pandas as pd
from ingestion.cleaner import normalize_phone, normalize_date

def parse_cdr(file_path: str) -> dict:
    records = []
    try:
        df = pd.read_csv(file_path)
        
        # Handle different possible column names (PRD vs existing sample)
        col_map = {
            "caller": ["caller", "caller_number", "calling_number"],
            "callee": ["callee", "callee_number", "called_number"],
            "date": ["date", "call_date", "datetime"],
            "time": ["time", "call_time"],
            "duration": ["duration", "duration_seconds", "call_duration"],
            "tower_id": ["tower_id", "caller_area", "location", "tower_location"]
        }

        def get_col(df, possible_names):
            for name in possible_names:
                if name in df.columns:
                    return name
            # case insensitive match
            for col in df.columns:
                if col.lower() in possible_names:
                    return col
            return None

        c_caller = get_col(df, col_map["caller"])
        c_callee = get_col(df, col_map["callee"])
        c_date = get_col(df, col_map["date"])
        c_time = get_col(df, col_map["time"])
        c_duration = get_col(df, col_map["duration"])
        c_tower = get_col(df, col_map["tower_id"])

        for idx, row in df.iterrows():
            record = {
                "caller": normalize_phone(str(row[c_caller])) if c_caller else "",
                "callee": normalize_phone(str(row[c_callee])) if c_callee else "",
                "datetime": normalize_date(str(row[c_date])) if c_date else "",
                "duration_seconds": int(row[c_duration]) if c_duration and pd.notna(row[c_duration]) else 0,
                "tower_location": str(row[c_tower]) if c_tower else "",
                "source_file": file_path,
                "row_number": idx + 1
            }
            # Try combining date and time if time exists
            if c_time and c_date and pd.notna(row[c_time]) and record["datetime"]:
                 record["datetime"] = f"{record['datetime']} {row[c_time]}"

            records.append(record)
    except Exception as e:
        print(f"Error parsing CDR {file_path}: {e}")
        # Log warnings, don't crash
        pass
        
    return {
        "records": records
    }
