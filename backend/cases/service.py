from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from db.models import Case, User
from cases.schemas import CaseCreate, CaseUpdate

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
