import pandas as pd
from ingestion.cleaner import normalize_date

def parse_financial(file_path: str) -> dict:
    records = []
    try:
        df = pd.read_csv(file_path)
        
        col_map = {
            "sender": ["sender", "sender_name", "from_account"],
            "receiver": ["receiver", "receiver_name", "to_account"],
            "amount": ["amount", "transaction_amount", "value"],
            "date": ["date", "transaction_date", "datetime"],
            "type": ["type", "transaction_type", "tx_type"]
        }

        def get_col(df, possible_names):
            for name in possible_names:
                if name in df.columns:
                    return name
            for col in df.columns:
                if col.lower() in possible_names:
                    return col
            return None

        c_sender = get_col(df, col_map["sender"])
        c_receiver = get_col(df, col_map["receiver"])
        c_amount = get_col(df, col_map["amount"])
        c_date = get_col(df, col_map["date"])
        c_type = get_col(df, col_map["type"])

        for idx, row in df.iterrows():
            amt = 0.0
            if c_amount and pd.notna(row[c_amount]):
                try:
                    # Clean currency symbols
                    amt_str = str(row[c_amount]).replace('$', '').replace('Rs', '').replace(',', '').strip()
                    amt = float(amt_str)
                except ValueError:
                    pass

            record = {
                "sender": str(row[c_sender]) if c_sender and pd.notna(row[c_sender]) else "",
                "receiver": str(row[c_receiver]) if c_receiver and pd.notna(row[c_receiver]) else "",
                "amount": amt,
                "date": normalize_date(str(row[c_date])) if c_date and pd.notna(row[c_date]) else "",
                "transaction_type": str(row[c_type]) if c_type and pd.notna(row[c_type]) else "",
                "source_file": file_path,
                "row_number": idx + 1
            }
            records.append(record)
    except Exception as e:
        print(f"Error parsing Financial CSV {file_path}: {e}")
        
    return {
        "records": records
    }
