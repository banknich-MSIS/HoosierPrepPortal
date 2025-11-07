from __future__ import annotations

import asyncio
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException
from pydantic import BaseModel

from ..services.job_queue import job_manager
from ..services import file_processor, gemini_service
from ..services.gemini_service import ExamConfig
from ..db import SessionLocal
from ..models import Upload, Question, Concept, Exam


router = APIRouter(tags=["Jobs"])


class JobCreateResponse(BaseModel):
    jobId: str


class JobStatusResponse(BaseModel):
    status: str
    progress: float
    resultId: Optional[int] = None
    error: Optional[str] = None
    requestedCount: Optional[int] = None
    generatedCount: Optional[int] = None
    shortfall: Optional[bool] = None
    shortfallReason: Optional[str] = None


class _AsyncBytesUpload:
    """A minimal UploadFile-like wrapper backed by in-memory bytes for async processing."""

    def __init__(self, filename: str, content: bytes) -> None:
        self.filename = filename
        self._content = content
        self._pos = 0

    async def read(self, n: Optional[int] = None) -> bytes:
        if n is None:
            return self._content
        start = self._pos
        end = min(len(self._content), start + n)
        self._pos = end
        return self._content[start:end]

    async def seek(self, pos: int) -> None:
        self._pos = pos


@router.post("/exams/generate", response_model=JobCreateResponse, status_code=202)
async def start_exam_generation_job(
    files: List[UploadFile] = File(...),
    question_count: int = Form(20),
    difficulty: str = Form("medium"),
    question_types: str = Form("mcq,short"),
    focus_concepts: Optional[str] = Form(None),
    exam_name: Optional[str] = Form(None),
    exam_mode: Optional[str] = Form("exam"),
    generation_mode: Optional[str] = Form("strict"),
    class_id: Optional[int] = Form(None),
    x_gemini_api_key: str = Header(..., alias="X-Gemini-API-Key"),
):
    if not exam_name or not exam_name.strip():
        raise HTTPException(status_code=400, detail="Exam title is required")

    # Copy file contents into memory for background processing
    in_memory_files: List[_AsyncBytesUpload] = []
    for f in files:
        content = await f.read()
        await f.seek(0)
        in_memory_files.append(_AsyncBytesUpload(f.filename, content))

    job = await job_manager.create_job({"type": "exam_generation", "exam_name": exam_name.strip()})

    async def _worker(job_id: str) -> None:
        await job_manager.set_status(job_id, "running", progress=0.05)
        db = SessionLocal()
        try:
            # Build content from files
            await job_manager.set_status(job_id, "running", progress=0.15)
            content = await file_processor.process_multiple_files(in_memory_files)  # type: ignore[arg-type]
            if not content or len(content) < 100:
                raise HTTPException(status_code=400, detail="Insufficient content extracted from files")

            # Build config
            await job_manager.set_status(job_id, "running", progress=0.25)
            question_types_list = [qt.strip() for qt in question_types.split(",") if qt.strip()]
            focus_concepts_list = None
            if focus_concepts:
                focus_concepts_list = [fc.strip() for fc in focus_concepts.split(",") if fc.strip()]

            config = ExamConfig(
                question_count=question_count,
                difficulty=difficulty,
                question_types=question_types_list,
                focus_concepts=focus_concepts_list,
                generation_mode=(generation_mode or "strict").lower(),
            )

            # Generate exam
            await job_manager.set_status(job_id, "running", progress=0.55)
            generated_exam = await gemini_service.generate_exam_from_content(
                content=content,
                config=config,
                api_key=x_gemini_api_key,
            )

            # Top-up logic to ensure requested count
            questions_list = list(generated_exam.questions)
            missing = max(0, question_count - len(questions_list))
            shortfall_reason: Optional[str] = None
            if missing > 0:
                await job_manager.set_status(job_id, "running", progress=0.62)
                existing_stems = [q.question for q in questions_list]
                extra = await gemini_service.generate_additional_questions(
                    content=content,
                    base_config=config,
                    missing_count=missing,
                    api_key=x_gemini_api_key,
                    existing_stems=existing_stems,
                )
                questions_list.extend(extra)
                # Dedupe
                questions_list = gemini_service.dedupe_questions(questions_list)
                missing = max(0, question_count - len(questions_list))

            if missing > 0:
                await job_manager.set_status(job_id, "running", progress=0.68)
                variants = gemini_service.synthesize_variants(questions_list, missing)
                questions_list.extend(variants)
                questions_list = gemini_service.dedupe_questions(questions_list)
                missing = max(0, question_count - len(questions_list))
                if missing > 0:
                    shortfall_reason = "variant_fallback_insufficient"
            # If still missing after LLM top-up (without variants), mark reason
            if shortfall_reason is None and len(questions_list) < question_count:
                shortfall_reason = "llm_shortfall"

            # Create upload
            await job_manager.set_status(job_id, "running", progress=0.75)
            ai_upload_count = db.query(Upload).filter(Upload.file_type == "ai_generated").count()
            filename = exam_name.strip() if exam_name and exam_name.strip() else f"AI Generated Quiz {ai_upload_count + 1}"
            upload = Upload(filename=filename, file_type="ai_generated", created_at=datetime.now())
            db.add(upload)
            db.flush()

            # Create concepts
            concept_names = set()
            for q_data in generated_exam.questions:
                if q_data.concepts:
                    concept_names.update(q_data.concepts)
            concept_map = {}
            for name in concept_names:
                c = Concept(upload_id=upload.id, name=name, score=1.0)
                db.add(c)
                concept_map[name] = c
            db.flush()

            # Create questions
            created_questions = []
            for q_data in questions_list:
                options_dict = None
                if q_data.options and len(q_data.options) > 0:
                    options_dict = {"list": q_data.options}
                answer_dict = None
                if q_data.answer:
                    if q_data.type == "multi":
                        if isinstance(q_data.answer, str):
                            answer_list = [a.strip() for a in q_data.answer.split(",") if a.strip()]
                            answer_dict = {"value": answer_list}
                        elif isinstance(q_data.answer, list):
                            answer_dict = {"value": q_data.answer}
                        else:
                            answer_dict = {"value": str(q_data.answer)}
                    elif q_data.type == "cloze":
                        if isinstance(q_data.answer, str):
                            answer_list = [a.strip() for a in q_data.answer.split(",") if a.strip()]
                            answer_dict = {"value": answer_list}
                        elif isinstance(q_data.answer, list):
                            answer_dict = {"value": q_data.answer}
                        else:
                            answer_dict = {"value": [str(q_data.answer)]}
                    else:
                        answer_dict = {"value": str(q_data.answer)}

                concept_ids = [concept_map[name].id for name in (q_data.concepts or []) if name in concept_map]
                question = Question(
                    upload_id=upload.id,
                    stem=q_data.question,
                    qtype=q_data.type,
                    options=options_dict,
                    answer=answer_dict,
                    concept_ids=concept_ids if concept_ids else None,
                )
                db.add(question)
                created_questions.append(question)

            # Create exam record
            question_ids = [q.id for q in created_questions]
            exam_settings = {
                "question_count": question_count,
                "difficulty": difficulty,
                "question_types": question_types_list,
                "exam_name": exam_name,
                "exam_mode": exam_mode,
                "generation_mode": (generation_mode or "strict").lower(),
            }
            exam = Exam(upload_id=upload.id, settings=exam_settings, question_ids=question_ids)
            db.add(exam)
            db.commit()
            db.refresh(exam)

            # Record metadata about counts/shortfall on the job
            requested = question_count
            generated = len(questions_list)
            await job_manager.set_metadata(job_id, {
                "requestedCount": requested,
                "generatedCount": generated,
                "shortfall": generated < requested,
                "shortfallReason": shortfall_reason,
            })

            await job_manager.set_result(job_id, exam.id)
            await job_manager.set_status(job_id, "succeeded", progress=1.0)
        except HTTPException as he:
            await job_manager.set_error(job_id, he.detail)
            await job_manager.set_status(job_id, "failed", progress=1.0)
            db.rollback()
        except Exception as e:
            await job_manager.set_error(job_id, str(e))
            await job_manager.set_status(job_id, "failed", progress=1.0)
            db.rollback()
        finally:
            db.close()

    asyncio.create_task(_worker(job.job_id))
    return JobCreateResponse(jobId=job.job_id)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    job = await job_manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        status=job.status,
        progress=job.progress,
        resultId=job.result_id,
        error=job.error,
        requestedCount=job.metadata.get("requestedCount"),
        generatedCount=job.metadata.get("generatedCount"),
        shortfall=job.metadata.get("shortfall"),
        shortfallReason=job.metadata.get("shortfallReason"),
    )


