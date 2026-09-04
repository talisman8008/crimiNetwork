import json

def fix_misaligned_spans(input_path, output_path):
    fixed_count = 0
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    fixed_lines = []
    for line in lines:
        data = json.loads(line)
        text = data['text']
        new_labels = []
        
        for start, end, label in data.get('label', []):
            span_text = text[start:end]
            
            # Fix leading spaces
            orig_start = start
            orig_end = end
            
            while span_text.startswith(' ') or span_text.startswith('\n'):
                start += 1
                span_text = text[start:end]
                
            # Fix trailing spaces
            while span_text.endswith(' ') or span_text.endswith('\n'):
                end -= 1
                span_text = text[start:end]
                
            if start != orig_start or end != orig_end:
                fixed_count += 1
                
            new_labels.append([start, end, label])
            
        data['label'] = new_labels
        fixed_lines.append(data)
        
    with open(output_path, 'w', encoding='utf-8') as f:
        for data in fixed_lines:
            f.write(json.dumps(data) + '\n')
            
    print(f"Fixed {fixed_count} misaligned spans!")

if __name__ == "__main__":
    fix_misaligned_spans("data/training/admin.jsonl", "data/training/admin_fixed.jsonl")
