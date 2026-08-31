import os
from dotenv import load_dotenv
from neo4j import AsyncGraphDatabase
from typing import List
load_dotenv()  
_driver = None

def get_driver():
    global _driver
    if _driver is None:
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")
        _driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
    return _driver

async def run_query(cypher: str, params: dict = {}) -> List[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(cypher, params)
        return [record.data() async for record in result]

async def close():
    global _driver
    if _driver:
        await _driver.close()
        _driver = None

async def create_schema():
    """Run once on app startup to create constraints and indexes."""
    constraints = [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (ph:Phone) REQUIRE ph.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (v:Vehicle) REQUIRE v.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Case) REQUIRE c.id IS UNIQUE",
        "CREATE INDEX IF NOT EXISTS FOR (p:Person) ON (p.name)",
        "CREATE INDEX IF NOT EXISTS FOR (p:Person) ON (p.case_id)",
        "CREATE INDEX IF NOT EXISTS FOR (p:Person) ON (p.anomaly_score)",
    ]
    for cypher in constraints:
        await run_query(cypher)
    print("✓ Neo4j schema created")