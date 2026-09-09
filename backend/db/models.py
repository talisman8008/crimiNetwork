import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship

from .database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    badge_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False) # INVESTIGATOR, SUPERVISOR
    password_hash = Column(String(255), nullable=False)
    token_version = Column(Integer, default=1, nullable=False)

    cases = relationship("Case", back_populates="assigned_user")


class Case(Base):
    __tablename__ = "cases"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    fir_number = Column(String(100), nullable=True)
    date_filed = Column(String(50), nullable=True) # ISO string format YYYY-MM-DD
    case_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="pending_data", nullable=False) # pending_data | processing | active | closed
    assigned_to = Column(String(50), ForeignKey("users.badge_id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    assigned_user = relationship("User", back_populates="cases")
    uploaded_files = relationship("UploadedFile", back_populates="case", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="case", cascade="all, delete-orphan")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False) # fir, cdr, financial, social_media, surveillance
    file_path = Column(String(500), nullable=False)
    status = Column(String(50), default="uploaded")
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="uploaded_files")
    jobs = relationship("ProcessingJob", back_populates="uploaded_file", cascade="all, delete-orphan")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    file_id = Column(String(36), ForeignKey("uploaded_files.id"), nullable=False)
    status = Column(String(50), default="queued") # queued, parsing, nlp, complete, failed
    progress = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="processing_jobs")
    uploaded_file = relationship("UploadedFile", back_populates="jobs")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    alert_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), default="MEDIUM") # HIGH, MEDIUM, LOW
    entity_ids_json = Column(Text, nullable=False) # JSON array of node IDs
    viewed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    case = relationship("Case")
