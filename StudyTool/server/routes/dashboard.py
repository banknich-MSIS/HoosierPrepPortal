from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..db import get_db
from ..models import Attempt, AttemptAnswer, Exam, Question, Upload
from ..schemas import (
    AttemptDetail,
    AttemptSummary,
    QuestionDTO,
    QuestionReview,
    UploadSummary,
)

router = APIRouter(tags=["dashboard"])


@router.get("/debug/routes")
def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes_info = []
    for route in router.routes:
        routes_info.append({
            "path": route.path,
            "methods": list(route.methods) if hasattr(route, 'methods') else [],
            "name": route.name
        })
    return {"routes": routes_info}


@router.get("/uploads", response_model=List[UploadSummary])
def get_all_uploads(archived: bool = False, db: Session = Depends(get_db)) -> List[UploadSummary]:
    """Return all uploaded CSVs with question counts and metadata"""
    # Filter by archived status
    query = db.query(Upload).filter(Upload.is_archived == archived)
    
    uploads = query.order_by(Upload.created_at.desc()).all()
    
    result = []
    for upload in uploads:
        # Extract themes from concepts
        themes = []
        if upload.concepts:
            themes = [concept.name for concept in upload.concepts]
        
        # Parse metadata if available
        metadata = {}
        if hasattr(upload, 'metadata_json') and upload.metadata_json:
            try:
                import json
                metadata = json.loads(upload.metadata_json)
                if 'themes' in metadata:
                    themes = metadata['themes']
            except (json.JSONDecodeError, KeyError):
                pass
        
        # Get class tags
        class_tags = [cls.name for cls in upload.classes] if upload.classes else []
        
        # Filter to only active questions
        active_questions = [q for q in upload.questions if q.is_active]
        
        # Calculate question type counts (only for active questions)
        question_type_counts = {}
        for question in active_questions:
            qtype = question.qtype
            question_type_counts[qtype] = question_type_counts.get(qtype, 0) + 1
        
        # Exams taken = number of completed attempts across all exams from this upload
        attempts_taken = 0
        if upload.exams:
            for ex in upload.exams:
                if ex.attempts:
                    attempts_taken += sum(1 for at in ex.attempts if at.finished_at is not None)

        result.append(
            UploadSummary(
                id=upload.id,
                filename=upload.filename,
                created_at=upload.created_at,
                question_count=len(active_questions),
                themes=themes,
                exam_count=attempts_taken,
                file_type=upload.file_type,
                class_tags=class_tags,
                question_type_counts=question_type_counts if question_type_counts else None,
                is_archived=upload.is_archived,
            )
        )
    
    return result


@router.get("/attempts", response_model=List[AttemptSummary])
def get_all_attempts(db: Session = Depends(get_db)) -> List[AttemptSummary]:
    """Return all completed exam attempts sorted by date"""
    attempts = (
        db.query(Attempt)
        .filter(Attempt.finished_at.isnot(None))
        .filter(
            or_(Attempt.status == "completed", Attempt.status.is_(None))
        )  # Only show completed attempts (or legacy attempts without status)
        .order_by(Attempt.finished_at.desc())
        .all()
    )
    
    result = []
    for attempt in attempts:
        exam = db.get(Exam, attempt.exam_id)
        if not exam:
            continue
            
        upload = db.get(Upload, exam.upload_id)
        if not upload:
            continue
        
        # Count correct answers
        correct_count = 0
        if attempt.answers:
            correct_count = sum(1 for answer in attempt.answers if answer.correct)
        
        # Get duration from attempt record (preferred) or calculate from timestamps
        duration_seconds = attempt.duration_seconds
        if duration_seconds is None and attempt.started_at and attempt.finished_at:
            duration_seconds = int((attempt.finished_at - attempt.started_at).total_seconds())
        
        # Calculate average time per question
        average_time_per_question = None
        if duration_seconds and len(exam.question_ids) > 0:
            average_time_per_question = round(duration_seconds / len(exam.question_ids), 1)
        
        # Extract difficulty from exam settings
        difficulty = None
        if exam.settings and isinstance(exam.settings, dict):
            difficulty = exam.settings.get("difficulty", "Medium")
        
        # Get class tags from upload
        class_tags = [cls.name for cls in upload.classes] if upload.classes else []
        
        # Get exam type
        exam_type = attempt.exam_type or "exam"
        
        result.append(
            AttemptSummary(
                id=attempt.id,
                exam_id=attempt.exam_id,
                upload_filename=upload.filename,
                score_pct=attempt.score_pct or 0.0,
                finished_at=attempt.finished_at or attempt.started_at,
                question_count=len(exam.question_ids),
                correct_count=correct_count,
                duration_seconds=duration_seconds,
                difficulty=difficulty,
                class_tags=class_tags,
                exam_type=exam_type,
                average_time_per_question=average_time_per_question,
            )
        )
    
    return result


@router.get("/attempts/recent", response_model=List[AttemptSummary])
def get_recent_attempts(limit: int = 10, db: Session = Depends(get_db)) -> List[AttemptSummary]:
    """Return recent exam attempts with scores"""
    attempts = (
        db.query(Attempt)
        .filter(Attempt.finished_at.isnot(None))
        .filter(
            or_(Attempt.status == "completed", Attempt.status.is_(None))
        )  # Only show completed attempts (or legacy attempts without status)
        .order_by(Attempt.finished_at.desc())
        .limit(limit)
        .all()
    )
    
    result = []
    for attempt in attempts:
        exam = db.get(Exam, attempt.exam_id)
        if not exam:
            continue
            
        upload = db.get(Upload, exam.upload_id)
        if not upload:
            continue
        
        # Count correct answers
        correct_count = 0
        if attempt.answers:
            correct_count = sum(1 for answer in attempt.answers if answer.correct)
        
        # Get duration from attempt record (preferred) or calculate from timestamps
        duration_seconds = attempt.duration_seconds
        if duration_seconds is None and attempt.started_at and attempt.finished_at:
            duration_seconds = int((attempt.finished_at - attempt.started_at).total_seconds())
        
        # Calculate average time per question
        average_time_per_question = None
        if duration_seconds and len(exam.question_ids) > 0:
            average_time_per_question = round(duration_seconds / len(exam.question_ids), 1)
        
        # Extract difficulty from exam settings
        difficulty = None
        if exam.settings and isinstance(exam.settings, dict):
            difficulty = exam.settings.get("difficulty", "Medium")
        
        # Get class tags from upload
        class_tags = [cls.name for cls in upload.classes] if upload.classes else []
        
        # Get exam type
        exam_type = attempt.exam_type or "exam"
        
        result.append(
            AttemptSummary(
                id=attempt.id,
                exam_id=attempt.exam_id,
                upload_filename=upload.filename,
                score_pct=attempt.score_pct or 0.0,
                finished_at=attempt.finished_at or attempt.started_at,
                question_count=len(exam.question_ids),
                correct_count=correct_count,
                duration_seconds=duration_seconds,
                difficulty=difficulty,
                class_tags=class_tags,
                exam_type=exam_type,
                average_time_per_question=average_time_per_question,
            )
        )
    
    return result


@router.get("/attempts/in-progress", response_model=List[AttemptSummary])
def get_in_progress_attempts(db: Session = Depends(get_db)) -> List[AttemptSummary]:
    """Return all in-progress attempts"""
    attempts = (
        db.query(Attempt)
        .filter(Attempt.status == "in_progress")
        .order_by(Attempt.started_at.desc())
        .all()
    )
    
    result = []
    for attempt in attempts:
        exam = db.get(Exam, attempt.exam_id)
        if not exam:
            continue
            
        upload = db.get(Upload, exam.upload_id)
        if not upload:
            continue
        
        # Calculate progress (answered questions)
        answered_count = 0
        if attempt.answers:
            # Count answers that have a value
            answered_count = sum(1 for answer in attempt.answers if answer.response and answer.response.get("value") is not None)
        
        # Extract difficulty from exam settings
        difficulty = None
        if exam.settings and isinstance(exam.settings, dict):
            difficulty = exam.settings.get("difficulty", "Medium")
        
        # Get class tags from upload
        class_tags = [cls.name for cls in upload.classes] if upload.classes else []
        
        # Get exam type
        exam_type = attempt.exam_type or "exam"
        
        # Use last saved time from progress_state if available, else started_at
        last_updated = attempt.started_at
        if attempt.progress_state and isinstance(attempt.progress_state, dict):
            last_saved = attempt.progress_state.get("last_saved_at")
            if last_saved:
                try:
                    last_updated = datetime.fromisoformat(last_saved)
                except ValueError:
                    pass

        result.append(
            AttemptSummary(
                id=attempt.id,
                exam_id=attempt.exam_id,
                upload_filename=upload.filename,
                score_pct=0.0, # Not graded yet
                finished_at=last_updated, # Use this field for "last updated" in the UI
                question_count=len(exam.question_ids),
                correct_count=answered_count, # Repurpose this for "answered count" in in-progress context
                duration_seconds=None,
                difficulty=difficulty,
                class_tags=class_tags,
                exam_type=exam_type,
                average_time_per_question=None,
            )
        )
    
    return result


@router.get("/uploads/{upload_id}", response_model=UploadSummary)
def get_upload(upload_id: int, db: Session = Depends(get_db)) -> UploadSummary:
    """Return details for a specific upload"""
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    # Extract themes from concepts
    themes = []
    if upload.concepts:
        themes = [concept.name for concept in upload.concepts]
    
    # Parse metadata if available
    metadata = {}
    if hasattr(upload, 'metadata_json') and upload.metadata_json:
        try:
            import json
            metadata = json.loads(upload.metadata_json)
            if 'themes' in metadata:
                themes = metadata['themes']
        except (json.JSONDecodeError, KeyError):
            pass
    
    # Get class tags
    class_tags = [cls.name for cls in upload.classes] if upload.classes else []
    
    # Calculate question type counts
    question_type_counts = {}
    for question in upload.questions:
        qtype = question.qtype
        question_type_counts[qtype] = question_type_counts.get(qtype, 0) + 1
    
    # Exams taken = number of completed attempts across all exams from this upload
    attempts_taken = 0
    if upload.exams:
        for ex in upload.exams:
            if ex.attempts:
                attempts_taken += sum(1 for at in ex.attempts if at.finished_at is not None)

    return UploadSummary(
        id=upload.id,
        filename=upload.filename,
        created_at=upload.created_at,
        question_count=len(upload.questions),
        themes=themes,
        exam_count=attempts_taken,
        file_type=upload.file_type,
        class_tags=class_tags,
        question_type_counts=question_type_counts if question_type_counts else None,
        is_archived=upload.is_archived,
    )


@router.delete("/attempts/delete/{attempt_id}")
def delete_attempt(attempt_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Delete an exam attempt and its answers"""
    attempt = db.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    # Delete all answers first
    db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt_id).delete()
    
    # Delete the attempt
    db.delete(attempt)
    db.commit()
    
    return {"success": True}


@router.get("/attempts/{attempt_id}", response_model=AttemptDetail)
def get_attempt_detail(attempt_id: int, db: Session = Depends(get_db)) -> AttemptDetail:
    """Return full attempt details for review"""
    attempt = db.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    exam = db.get(Exam, attempt.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Get all questions for this exam
    questions_query = (
        db.query(Question)
        .filter(Question.id.in_(exam.question_ids))
        .all()
    )
    
    # Create a lookup
    question_lookup = {q.id: q for q in questions_query}
    
    # Use stored question order from progress_state if available (preserves shuffled order)
    # Otherwise fall back to exam.question_ids (original order)
    question_order = exam.question_ids
    if attempt.progress_state and isinstance(attempt.progress_state, dict):
        stored_order = attempt.progress_state.get("question_order")
        if stored_order and isinstance(stored_order, list):
            # Validate that stored order contains valid question IDs
            valid_order = [qid for qid in stored_order if qid in question_lookup]
            if len(valid_order) == len(question_lookup):
                question_order = valid_order
    
    # Maintain order from question_order
    questions = [question_lookup[qid] for qid in question_order if qid in question_lookup]
    
    # Get all answers for this attempt
    answers = (
        db.query(AttemptAnswer)
        .filter(AttemptAnswer.attempt_id == attempt_id)
        .all()
    )
    
    # Create answer lookup
    answer_lookup = {answer.question_id: answer for answer in answers}
    
    # Build question reviews
    question_reviews = []
    for question in questions:
        answer = answer_lookup.get(question.id)
        
        # Extract options from the JSON structure
        options_data = None
        if question.options and isinstance(question.options, dict):
            options_data = question.options.get("list", [])
        
        # Explicitly construct QuestionDTO with proper type
        question_dto = QuestionDTO.model_validate({
            "id": question.id,
            "stem": question.stem,
            "type": question.qtype,
            "options": options_data if options_data else None,
            "concepts": question.concept_ids if question.concept_ids else [],
            "explanation": question.explanation,
        })
        
        question_reviews.append(
            QuestionReview(
                question=question_dto,
                user_answer=answer.response.get("value") if answer and answer.response else None,
                correct_answer=(question.answer or {}).get("value"),
                is_correct=answer.correct if answer else False,
                ai_explanation=answer.ai_explanation if answer else None,
            )
        )
    
    return AttemptDetail(
        id=attempt.id,
        exam_id=attempt.exam_id,
        score_pct=attempt.score_pct or 0.0,
        finished_at=attempt.finished_at or attempt.started_at,
        questions=question_reviews,
    )


@router.get("/export/data")
def export_performance_data(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Export user's performance data and analytics as JSON"""
    # Get all attempts
    attempts = (
        db.query(Attempt)
        .filter(Attempt.finished_at.isnot(None))
        .order_by(Attempt.finished_at.desc())
        .all()
    )
    
    # Build export data
    export_attempts = []
    total_correct = 0
    total_questions = 0
    
    for attempt in attempts:
        exam = db.get(Exam, attempt.exam_id)
        if not exam:
            continue
        
        upload = db.get(Upload, exam.upload_id)
        if not upload:
            continue
        
        # Count correct answers
        correct_count = sum(1 for ans in attempt.answers if ans.correct) if attempt.answers else 0
        question_count = len(exam.question_ids)
        
        total_correct += correct_count
        total_questions += question_count
        
        export_attempts.append({
            "id": attempt.id,
            "exam_name": upload.filename,
            "finished_at": attempt.finished_at.isoformat() if attempt.finished_at else None,
            "score_pct": round(attempt.score_pct or 0.0, 2),
            "correct_count": correct_count,
            "question_count": question_count,
        })
    
    # Calculate summary statistics
    avg_score = sum(a["score_pct"] for a in export_attempts) / len(export_attempts) if export_attempts else 0.0
    
    return {
        "version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_attempts": len(export_attempts),
            "total_questions_answered": total_questions,
            "total_correct": total_correct,
            "avg_score": round(avg_score, 2),
        },
        "attempts": export_attempts,
    }


@router.delete("/uploads/{upload_id}")
def delete_upload(upload_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Delete CSV and all associated data"""
    import os
    
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    # Delete CSV file from disk if it exists
    if upload.csv_file_path and os.path.exists(upload.csv_file_path):
        try:
            os.remove(upload.csv_file_path)
        except Exception as e:
            print(f"Warning: Could not delete CSV file {upload.csv_file_path}: {e}")
    
    # Cascade deletes will handle related data
    db.delete(upload)
    db.commit()
    
    return {"success": True}


@router.patch("/uploads/{upload_id}")
def update_upload_name(upload_id: int, new_name: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Update the filename of an upload"""
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    upload.filename = new_name
    db.commit()
    
    return {"success": True, "filename": new_name}


@router.put("/uploads/{upload_id}/archive")
def archive_upload(upload_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Archive an upload (hide from main library)"""
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    upload.is_archived = True
    db.commit()
    
    return {"success": True}


@router.put("/uploads/{upload_id}/unarchive")
def unarchive_upload(upload_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Unarchive an upload (restore to main library)"""
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    upload.is_archived = False
    db.commit()
    
    return {"success": True}


@router.get("/uploads/{upload_id}/download")
def download_csv(upload_id: int, db: Session = Depends(get_db)):
    """Download the static CSV file"""
    import os
    from fastapi.responses import FileResponse
    
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    # Only allow download for CSV type uploads
    if upload.file_type == "ai_generated":
        raise HTTPException(
            status_code=400,
            detail="AI-generated exams cannot be downloaded as CSV files. Only uploaded CSVs support downloads."
        )
    elif upload.file_type != "csv":
        raise HTTPException(
            status_code=400,
            detail="Only uploaded CSV files can be downloaded. This is a text-based or generated upload."
        )
    
    # Check if CSV file exists
    if not upload.csv_file_path or not os.path.exists(upload.csv_file_path):
        # Try alternative path if uploaded as text file but stored as CSV
        alt_path = upload.csv_file_path.replace('.txt', '.csv') if upload.csv_file_path else None
        if alt_path and os.path.exists(alt_path):
            upload.csv_file_path = alt_path
        else:
            raise HTTPException(
                status_code=404, 
                detail=f"CSV file not found on disk. File type: {upload.file_type}. This upload may not support downloads."
            )
    
    # Serve the static file
    return FileResponse(
        path=upload.csv_file_path,
        media_type="text/csv",
        filename=upload.filename if upload.filename.endswith('.csv') else f"{upload.filename}.csv"
    )
