FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if required by some packages (like reportlab, spacy, etc.)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

# Download spaCy model (commonly needed if doing NER)
RUN python -m spacy download en_core_web_sm || true

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
