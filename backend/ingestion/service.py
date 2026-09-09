import os
import asyncio
from typing import Optional
from sqlalchemy.future import select

from db.database import AsyncSessionLocal
from db.models import Case, ProcessingJob, UploadedFile
from ingestion.parsers.fir_parser import parse_fir
from ingestion.parsers.cdr_parser import parse_cdr
from ingestion.parsers.financial_parser import parse_financial
from ingestion.parsers.social_parser import parse_social

# Import nlp process. Use a try-except to allow testing without nlp module
try:
    from nlp.router import process as nlp_process
except ImportError:
    async def nlp_process(case_id, parsed_output, source_type):
        pass

async def process_file_background(job_id: str, file_path: str, source_type: str, case_id: str):
    # Open a fresh session for the background task
    async with AsyncSessionLocal() as db:
        # Get job
        result = await db.execute(select(ProcessingJob).where(ProcessingJob.id == job_id))
        job = result.scalars().first()
        
        # Get case
        result_case = await db.execute(select(Case).where(Case.id == case_id))
        case = result_case.scalars().first()

        if not job or not case:
            return

        try:
            # Update to parsing
            job.status = "parsing"
            job.progress = 20
            case.status = "processing"
            db.add(job)
            db.add(case)
            await db.commit()

            # Parse
            parsed_output = {}
            if source_type == "fir":
                parsed_output = parse_fir(file_path)
            elif source_type == "cdr":
                parsed_output = parse_cdr(file_path)
            elif source_type == "financial":
                parsed_output = parse_financial(file_path)
            elif source_type in ("social_media", "surveillance"):
                parsed_output = parse_social(file_path)
            else:
                raise ValueError(f"Unknown source type: {source_type}")

            # Parsers receive the generated storage path, but investigators need
            # the original uploaded filename in graph evidence and RAG citations.
            uploaded_file = await db.get(UploadedFile, job.file_id)
            parsed_output["source_file"] = uploaded_file.filename if uploaded_file else os.path.basename(file_path)

            # Update to nlp
            job.status = "nlp"
            job.progress = 60
            db.add(job)
            await db.commit()

            # Handoff to NLP
            await nlp_process(case_id, parsed_output, source_type)

            # Update to complete
            job.status = "complete"
            job.progress = 100
            case.status = "active"
            db.add(job)
            db.add(case)
            await db.commit()

        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            case.status = "active" # Or failed? Keep active so it's not locked.
            db.add(job)
            db.add(case)
            await db.commit()
