from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from db.models import Case, User
from db.neo4j import run_query
from cases.schemas import CaseCreate, CaseUpdate


# These IDs are the persisted Neo4j investigations. Their labels are display
# metadata only; the UUIDs remain the stable backend/graph identifiers.
GRAPH_CASE_DISPLAY = {
    "7c3a1f61-b967-45b9-817e-fade87314fe3": {
        "name": "Case 001",
        "fir_number": "CASE001",
    },
    "ea53345e-a74c-4083-bbbb-c34ca9e267f4": {
        "name": "Case 002",
        "fir_number": "CASE002",
    },
}

async def create_case(db: AsyncSession, case_data: CaseCreate, user: User) -> Case:
    new_case = Case(
        name=case_data.name,
        fir_number=case_data.fir_number,
        date_filed=case_data.date_filed,
        case_type=case_data.case_type,
        description=case_data.description,
        assigned_to=user.badge_id
    )
    db.add(new_case)
    await db.commit()
    await db.refresh(new_case)
    return new_case

async def get_cases(db: AsyncSession, user: User) -> List[Case]:
    query = select(Case).options(selectinload(Case.uploaded_files), selectinload(Case.assigned_user))
    if user.role == "INVESTIGATOR":
        query = query.where(Case.assigned_to == user.badge_id)
    
    result = await db.execute(query)
    return result.scalars().all()

async def get_case(db: AsyncSession, case_id: str, user: User) -> Optional[Case]:
    query = select(Case).options(selectinload(Case.uploaded_files), selectinload(Case.assigned_user)).where(Case.id == case_id)
    result = await db.execute(query)
    case = result.scalars().first()

    if not case:
        return None
        
    if user.role == "INVESTIGATOR" and case.assigned_to != user.badge_id:
        return None

    return case

async def update_case(db: AsyncSession, case_id: str, case_data: CaseUpdate, user: User) -> Optional[Case]:
    case = await get_case(db, case_id, user)
    if not case:
        return None

    update_dict = case_data.model_dump(exclude_unset=True)
    
    # Restrict investigators from modifying case assignment
    if user.role == "INVESTIGATOR" and "assigned_to" in update_dict:
        update_dict.pop("assigned_to")

    for key, value in update_dict.items():
        setattr(case, key, value)
        
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case

async def delete_case(db: AsyncSession, case_id: str) -> bool:
    query = select(Case).where(Case.id == case_id)
    result = await db.execute(query)
    case = result.scalars().first()
    
    if not case:
        return False
        
    await db.delete(case)
    await db.commit()
    return True

async def seed_demo_cases(db: AsyncSession):
    result = await db.execute(select(Case).limit(1))
    if result.scalars().first() is None:
        demo_cases = [
            Case(
                id="c-1",
                name="Operation Silent Thread",
                fir_number="RC-2026/04",
                date_filed="2026-02-14",
                case_type="organized_crime",
                description="Investigation into a coordinated series of high-value cryptocurrency thefts targeting domestic exchanges, with suspected routing through dark web mixers.",
                status="active",
                assigned_to="BADGE001"
            ),
            Case(
                id="c-2",
                name="Cross-Border Narcotics Syndicate",
                fir_number="FIR-44/2026",
                date_filed="2026-05-22",
                case_type="drug_trafficking",
                description="Large scale synthetic drug distribution network operating across three states. Initial break from a seized shipment in sector 14.",
                status="pending_data",
                assigned_to="BADGE001"
            )
        ]
        db.add_all(demo_cases)
        await db.commit()


async def sync_graph_cases(db: AsyncSession):
    """Create SQL case records for existing Neo4j investigations.

    Neo4j holds the source-of-truth network. If its persisted graph survives
    while the local SQLite volume is recreated, the graph IDs must be restored
    to the case registry so authenticated investigators can open it again.
    """
    graph_cases = await run_query(
        "MATCH (c:Case) WHERE c.id IS NOT NULL RETURN DISTINCT c.id AS id, c.name AS name"
    )
    if not graph_cases:
        return

    investigator = (
        await db.execute(select(User).where(User.badge_id == "BADGE001"))
    ).scalars().first()
    assigned_to = investigator.badge_id if investigator else None

    for graph_case in graph_cases:
        case_id = graph_case["id"]
        display = GRAPH_CASE_DISPLAY.get(case_id, {})
        existing = (
            await db.execute(select(Case).where(Case.id == case_id))
        ).scalars().first()
        if existing:
            # Reconcile records created by an earlier recovery pass. Do not
            # alter the graph ID or any Neo4j data.
            if display:
                existing.name = display["name"]
                existing.fir_number = display["fir_number"]
            continue

        db.add(
            Case(
                id=case_id,
                name=display.get("name") or graph_case.get("name") or f"Investigation {case_id[:8]}",
                fir_number=display.get("fir_number") or f"FIR/{case_id[:8].upper()}",
                description="Recovered investigation backed by the persisted entity network.",
                status="active",
                assigned_to=assigned_to,
            )
        )

    await db.commit()
