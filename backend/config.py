import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///data/criminetwork.db")

# Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# ChromaDB
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")

# JWT Auth
SECRET_KEY = os.getenv("SECRET_KEY", "changethisinsecret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

# LLM
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Confidence scores per source type
CONFIDENCE_SCORES = {
    "cdr": 0.95,
    "financial": 0.90,
    "fir": 0.75,
    "surveillance": 0.70,
    "social_media": 0.45,
}

# Anomaly threshold for alerts
ANOMALY_ALERT_THRESHOLD = 70

# Entity resolution similarity threshold
SIMILARITY_THRESHOLD = 0.82