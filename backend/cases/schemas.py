from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from datetime import datetime

class CaseStatus(str, Enum):
    PENDING_DATA = "pending_data"
    PROCESSING = "processing"
    ACTIVE = "active"
    CLOSED = "closed"

class CaseCreate(BaseModel):
    name: str
    fir_number: Optional[str] = None
    date_filed: Optional[str] = None
    case_type: Optional[str] = None
    description: Optional[str] = None

class CaseUpdate(BaseModel):
    name: Optional[str] = None
    fir_number: Optional[str] = None
    date_filed: Optional[str] = None
    case_type: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CaseStatus] = None
    assigned_to: Optional[str] = None

class CaseResponse(BaseModel):
    id: str
    name: str
    fir_number: Optional[str]
    status: CaseStatus
    entity_count: int
    link_count: int
    last_updated: datetime
    sources_uploaded: List[str]
    assigned_to: Optional[str]
    
    # Frontend compatibility fields
    title: str
    code: Optional[str]
    summary: str
    priority: str
    openedOn: Optional[str]
    leadOfficer: Optional[str]
    station: str
    sections: List[str]

    model_config = {"from_attributes": True}
