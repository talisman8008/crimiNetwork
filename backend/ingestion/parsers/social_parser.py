import pandas as pd
import json

def parse_social(file_path: str) -> dict:
    records = []
    raw_text = ""
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith('.json'):
            df = pd.read_json(file_path)
        else:
            df = pd.DataFrame() # Fallback

        col_map = {
            "platform": ["platform", "source", "network", "camera", "camera_id"],
            "username": ["username", "handle", "user", "author", "subject", "entity"],
            "content": ["content", "text", "post", "message", "tweet", "observation", "description", "event"],
            "date": ["date", "timestamp", "created_at", "recorded_at", "observed_at"]
        }

        def get_col(df, possible_names):
            for name in possible_names:
                if name in df.columns:
                    return name
            for col in df.columns:
                if col.lower() in possible_names:
                    return col
            return None

        c_platform = get_col(df, col_map["platform"])
        c_username = get_col(df, col_map["username"])
        c_content = get_col(df, col_map["content"])
        c_date = get_col(df, col_map["date"])

        for idx, row in df.iterrows():
            content = str(row[c_content]) if c_content and pd.notna(row[c_content]) else ""
            if content:
                raw_text += content + "\n\n"
                
            record = {
                "platform": str(row[c_platform]) if c_platform and pd.notna(row[c_platform]) else "unknown",
                "username": str(row[c_username]) if c_username and pd.notna(row[c_username]) else "unknown",
                "content": content,
                "date": str(row[c_date]) if c_date and pd.notna(row[c_date]) else "",
                "confidence": 0.45
            }
            records.append(record)
    except Exception as e:
        print(f"Error parsing Social Media file {file_path}: {e}")
        
    return {
        "raw_text": raw_text.strip(),
        "records": records
    }
