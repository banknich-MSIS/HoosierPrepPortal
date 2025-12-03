from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Attempt, AttemptAnswer, Exam as ExamModel, Question as QuestionModel, Upload
from ..schemas import ExamCreate, ExamOut, GradeItem, GradeReport, QuestionDTO, UserAnswer
from ..services.gemini_service import generate_answer_explanation

router = APIRouter(tags=["exam"])


@router.post("/exams", response_model=ExamOut)
def create_exam(payload: ExamCreate, db: Session = Depends(get_db)) -> ExamOut:
    # If multiple upload IDs provided, query from all of them
    if payload.uploadIds and len(payload.uploadIds) > 1:
        # Query questions from multiple uploads
        query = db.query(QuestionModel).filter(
            QuestionModel.upload_id.in_(payload.uploadIds),
            QuestionModel.is_active == True
        )
    else:
        # Single upload (either from uploadId or first of uploadIds)
        upload_id = payload.uploadId
        upload = db.get(Upload, upload_id)
        if upload is None:
            raise HTTPException(status_code=404, detail="Upload not found")
        query = db.query(QuestionModel).filter(
            QuestionModel.upload_id == upload_id,
            QuestionModel.is_active == True
        )
    
    if payload.questionTypes:
        query = query.filter(QuestionModel.qtype.in_(payload.questionTypes))
    
    # Count available questions
    available_count = query.count()
    if payload.count > available_count:
        raise HTTPException(
            status_code=400, 
            detail=f"Requested {payload.count} questions but only {available_count} are available"
        )
    
    questions = query.limit(payload.count).all()

    question_ids = [q.id for q in questions]
    # Use the primary upload ID (or first one if multiple)
    primary_upload_id = payload.uploadId if not payload.uploadIds else payload.uploadIds[0]
    exam = ExamModel(upload_id=primary_upload_id, settings=payload.model_dump(), question_ids=question_ids)
    db.add(exam)
    db.commit()
    db.refresh(exam)

    dto = [
        QuestionDTO.model_validate({
            "id": q.id,
            "stem": q.stem,
            "type": q.qtype,
            "options": (q.options or {}).get("list"),
            "concepts": q.concept_ids or [],
            "explanation": q.explanation,
        })
        for q in questions
    ]
    return ExamOut(examId=exam.id, questions=dto)


@router.get("/exams/{exam_id}", response_model=ExamOut)
def get_exam(exam_id: int, db: Session = Depends(get_db)) -> ExamOut:
    exam = db.get(ExamModel, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    questions = (
        db.query(QuestionModel).filter(QuestionModel.id.in_(exam.question_ids)).all()
    )
    dto = [
        QuestionDTO.model_validate({
            "id": q.id,
            "stem": q.stem,
            "type": q.qtype,
            "options": (q.options or {}).get("list"),
            "concepts": q.concept_ids or [],
            "explanation": q.explanation,
        })
        for q in questions
    ]
    return ExamOut(examId=exam.id, questions=dto)


@router.get("/exams/{exam_id}/preview")
def preview_exam_answers(exam_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get exam questions with correct answers for preview (does not create attempt)"""
    exam = db.get(ExamModel, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    questions = (
        db.query(QuestionModel).filter(QuestionModel.id.in_(exam.question_ids)).all()
    )
    
    preview_data = []
    for q in questions:
        preview_data.append({
            "questionId": q.id,
            "correctAnswer": (q.answer or {}).get("value")
        })
    
    return {"answers": preview_data}


@router.post("/exams/{exam_id}/grade", response_model=GradeReport)
async def grade_exam(
    exam_id: int,
    answers: List[UserAnswer],
    db: Session = Depends(get_db),
    x_gemini_api_key: str = Header(None, alias="X-Gemini-API-Key"),
    x_exam_duration: int = Header(None, alias="X-Exam-Duration"),  # Duration in seconds
    x_exam_type: str = Header(None, alias="X-Exam-Type")  # "exam" or "practice"
) -> GradeReport:
    exam = db.get(ExamModel, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")

    questions = {q.id: q for q in db.query(QuestionModel).filter(QuestionModel.id.in_(exam.question_ids)).all()}
    answers_by_qid: Dict[int, Any] = {a.questionId: a.response for a in answers}

    # Extract question order from submitted answers to preserve shuffled order
    question_order = [a.questionId for a in answers]

    per_items: List[GradeItem] = []
    incorrect_items: List[tuple] = []  # Track incorrect answers for explanation generation
    pending_validations: List[Dict] = []  # Track answers needing AI validation
    correct_count = 0
    pending_count = 0
    
    # Iterate over submitted answers order (preserves shuffled order from frontend)
    for answer_item in answers:
        qid = answer_item.questionId
        q = questions.get(qid)
        if q is None:
            continue
        user_resp = answer_item.response
        correct_answer = (q.answer or {}).get("value")
        
        # Use confidence-based checking
        result, confidence = _check_correct_with_confidence(q.qtype, user_resp, correct_answer)
        
        if result is None:
            # Pending AI validation (only short/cloze can reach here)
            status = "pending"
            pending_count += 1
            pending_validations.append({
                "question_id": qid,
                "question_stem": q.stem,
                "question_type": q.qtype,
                "user_answer": user_resp,
                "correct_answer": correct_answer,
            })
        else:
            # Definitive result
            status = "graded"
            if result:
                correct_count += 1
            else:
                # Track incorrect answers for explanation generation
                options = (q.options or {}).get("list") if q.options else None
                incorrect_items.append((qid, q.stem, q.qtype, correct_answer, user_resp, options))
        
        per_items.append(
            GradeItem(
                questionId=qid,
                correct=result,
                correctAnswer=correct_answer,
                userAnswer=user_resp,
                status=status,
            )
        )

    score_pct = (correct_count / max(1, len(exam.question_ids))) * 100.0
    
    # Check if there's an existing in-progress attempt to update, or create new one
    # Also check for recently completed attempts to prevent duplicates
    existing_attempt = (
        db.query(Attempt)
        .filter(
            Attempt.exam_id == exam_id,
            Attempt.status == "in_progress"
        )
        .first()
    )
    
    # If no in-progress attempt, check for a recently completed one (within last 5 seconds)
    # This prevents duplicate submissions from rapid clicks
    if not existing_attempt:
        recent_completed = (
            db.query(Attempt)
            .filter(
                Attempt.exam_id == exam_id,
                Attempt.status == "completed",
                Attempt.exam_type == (x_exam_type or "exam"),
                Attempt.finished_at >= datetime.utcnow() - timedelta(seconds=5)
            )
            .order_by(Attempt.finished_at.desc())
            .first()
        )
        if recent_completed:
            # Return the existing completed attempt (idempotent behavior)
            existing_answers = (
                db.query(AttemptAnswer)
                .filter(AttemptAnswer.attempt_id == recent_completed.id)
                .all()
            )
            per_items_existing = []
            for ans in existing_answers:
                q = questions.get(ans.question_id)
                correct_answer = (q.answer or {}).get("value") if q else None
                per_items_existing.append(
                    GradeItem(
                        questionId=ans.question_id,
                        correct=ans.correct or False,
                        correctAnswer=correct_answer,
                        userAnswer=ans.response.get("value") if ans.response else None,
                    )
                )
            return GradeReport(
                scorePct=round(recent_completed.score_pct or 0.0, 2),
                perQuestion=per_items_existing,
                attemptId=recent_completed.id
            )
    
    if existing_attempt:
        # Check if this attempt is already being processed (has finished_at set)
        if existing_attempt.finished_at is not None:
            # Attempt is already completed, return it (idempotent)
            existing_answers = (
                db.query(AttemptAnswer)
                .filter(AttemptAnswer.attempt_id == existing_attempt.id)
                .all()
            )
            per_items_existing = []
            for ans in existing_answers:
                q = questions.get(ans.question_id)
                correct_answer = (q.answer or {}).get("value") if q else None
                per_items_existing.append(
                    GradeItem(
                        questionId=ans.question_id,
                        correct=ans.correct or False,
                        correctAnswer=correct_answer,
                        userAnswer=ans.response.get("value") if ans.response else None,
                    )
                )
            return GradeReport(
                scorePct=round(existing_attempt.score_pct or 0.0, 2),
                perQuestion=per_items_existing,
                attemptId=existing_attempt.id
            )
        
        # Update existing attempt to completed
        attempt = existing_attempt
        attempt.finished_at = datetime.utcnow()
        attempt.score_pct = score_pct
        attempt.duration_seconds = x_exam_duration
        attempt.exam_type = x_exam_type or "exam"
        attempt.status = "completed"
        # Store question order in progress_state before clearing other progress data
        # This preserves the shuffled order for the review page
        attempt.progress_state = {"question_order": question_order}
        # Delete existing answer records to replace with graded ones
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).delete()
    else:
        # Create new attempt record with duration and exam type
        # Store question order in progress_state to preserve shuffled order for review
        attempt = Attempt(
            exam_id=exam_id,
            finished_at=datetime.utcnow(),
            score_pct=score_pct,
            duration_seconds=x_exam_duration,
            exam_type=x_exam_type or "exam",
            status="completed",
            progress_state={"question_order": question_order}
        )
        db.add(attempt)
    
    db.flush()
    
    # Save individual answers (without explanations initially)
    answer_records = {}
    for item in per_items:
        answer_record = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=item.questionId,
            response={"value": item.userAnswer},
            correct=item.correct,
            ai_explanation=None  # Will be populated async
        )
        db.add(answer_record)
        answer_records[item.questionId] = answer_record
    
    db.commit()
    
    # Start background AI validation if there are pending items
    if pending_validations and x_gemini_api_key:
        import threading
        thread = threading.Thread(
            target=_validate_pending_answers_sync,
            args=(attempt.id, pending_validations, x_gemini_api_key)
        )
        thread.daemon = True
        thread.start()
    
    # Generate AI explanations for incorrect answers asynchronously (don't block response)
    if x_gemini_api_key and incorrect_items:
        # Launch background task to generate explanations
        asyncio.create_task(_generate_explanations_background(
            incorrect_items,
            answer_records,
            x_gemini_api_key,
            attempt.id
        ))
    
    return GradeReport(
        scorePct=round(score_pct, 2), 
        perQuestion=per_items,
        attemptId=attempt.id,
        pendingCount=pending_count,
        estimatedWaitSeconds=pending_count * 3,
    )


def _validate_pending_answers_sync(attempt_id: int, pending_items: List[Dict], api_key: str):
    """Synchronous wrapper for async validation."""
    import asyncio
    asyncio.run(_validate_pending_answers(attempt_id, pending_items, api_key))


async def _validate_pending_answers(attempt_id: int, pending_items: List[Dict], api_key: str):
    """Validate pending answers in background using AI."""
    from ..services.gemini_service import validate_answer_with_ai
    from ..db import SessionLocal
    
    db = SessionLocal()
    
    try:
        for item in pending_items:
            try:
                # Call AI to validate
                is_correct = await validate_answer_with_ai(
                    question_stem=item["question_stem"],
                    question_type=item["question_type"],
                    user_answer=item["user_answer"],
                    correct_answer=item["correct_answer"],
                    api_key=api_key
                )
                
                # Update database immediately
                answer = db.query(AttemptAnswer).filter(
                    AttemptAnswer.attempt_id == attempt_id,
                    AttemptAnswer.question_id == item["question_id"]
                ).first()
                
                if answer:
                    answer.correct = is_correct
                    db.commit()
                    
            except Exception as e:
                # Mark as incorrect on error
                try:
                    print(f"[AI Validation] Failed for Q{item['question_id']}: {str(e)[:100]}")
                except:
                    pass  # Ignore print errors
                answer = db.query(AttemptAnswer).filter(
                    AttemptAnswer.attempt_id == attempt_id,
                    AttemptAnswer.question_id == item["question_id"]
                ).first()
                if answer:
                    answer.correct = False
                    db.commit()
        
        # Recalculate final score
        answers = db.query(AttemptAnswer).filter(
            AttemptAnswer.attempt_id == attempt_id
        ).all()
        correct = sum(1 for a in answers if a.correct is True)
        score_pct = (correct / len(answers) * 100) if answers else 0
        
        attempt = db.get(Attempt, attempt_id)
        if attempt:
            attempt.score_pct = score_pct
            db.commit()
            
    finally:
        db.close()


async def _generate_explanations_background(
    incorrect_items: List[tuple],
    answer_records: Dict[int, AttemptAnswer],
    api_key: str,
    attempt_id: int
):
    """Background task to generate AI explanations for incorrect answers"""
    from ..db import SessionLocal
    
    try:
        # Generate explanations concurrently
        tasks = []
        for qid, stem, qtype, correct_ans, user_ans, options in incorrect_items:
            task = generate_answer_explanation(
                question_stem=stem,
                question_type=qtype,
                correct_answer=correct_ans,
                user_answer=user_ans,
                options=options,
                api_key=api_key
            )
            tasks.append((qid, task))
        
        # Wait for all explanations
        explanations = {}
        for qid, task in tasks:
            try:
                explanation = await task
                if explanation:
                    explanations[qid] = explanation
            except Exception as e:
                print(f"[Explanation] Failed for question {qid}: {str(e)}")
                continue
        
        # Update database with explanations
        if explanations:
            db = SessionLocal()
            try:
                for qid, explanation in explanations.items():
                    db.query(AttemptAnswer).filter(
                        AttemptAnswer.attempt_id == attempt_id,
                        AttemptAnswer.question_id == qid
                    ).update({"ai_explanation": explanation})
                db.commit()
                print(f"[Explanation] Generated {len(explanations)} explanations for attempt {attempt_id}")
            except Exception as e:
                print(f"[Explanation] Failed to save: {str(e)}")
                db.rollback()
            finally:
                db.close()
                
    except Exception as e:
        print(f"[Explanation] Background task failed: {str(e)}")


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    
    # Convert common number words to digits for semantic matching
    number_words = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
        'eighteen': '18', 'nineteen': '19', 'twenty': '20',
        'thirty': '30', 'forty': '40', 'fifty': '50', 'sixty': '60',
        'seventy': '70', 'eighty': '80', 'ninety': '90',
    }
    
    # Replace number words with digits (word boundary aware)
    import re
    for word, digit in number_words.items():
        text = re.sub(rf'\b{word}\b', digit, text)
    
    return text


def _check_correct_with_confidence(qtype: str, user: Any, answer: Any) -> tuple[bool | None, float]:
    """
    Grade answer and return (result, confidence).
    
    ONLY uses AI validation for short/cloze types.
    MCQ/multi/truefalse always return definitive result.
    
    Returns:
        (True, 1.0) = Definitely correct
        (False, 0.0) = Definitely wrong
        (None, 0.3-0.9) = Uncertain, needs AI (short/cloze only)
    """
    # MCQ, Multi, TrueFalse: NEVER use AI, always definitive
    if qtype in ("mcq", "multi", "truefalse"):
        is_correct = _check_correct(qtype, user, answer)
        return (is_correct, 1.0)
    
    # Short answer and Cloze: Use fuzzy matching + AI for uncertain cases
    if qtype in ("short", "cloze"):
        user_norm = _normalize_text(str(user)) if user else ""
        answer_norm = _normalize_text(str(answer)) if answer else ""
        
        # Exact match
        if user_norm == answer_norm:
            return (True, 1.0)
        
        # Calculate similarity
        from difflib import SequenceMatcher
        similarity = SequenceMatcher(None, user_norm, answer_norm).ratio()
        
        if similarity < 0.2:
            # Too different, definitely wrong
            return (False, 0.0)
        elif similarity > 0.95:
            # Very close (minor typo), accept as correct
            return (True, 0.95)
        else:
            # Uncertain (20-95% similar) - needs AI validation
            return (None, similarity)
    
    # Fallback
    return (_check_correct(qtype, user, answer), 1.0)


def _check_correct(qtype: str, user: Any, answer: Any) -> bool:
    if qtype in ("mcq", "truefalse", "short"):
        return _normalize_text(user) == _normalize_text(answer)
    
    if qtype == "cloze":
        # Normalize answer to list
        correct_list = []
        if isinstance(answer, list):
            correct_list = answer
        elif isinstance(answer, str):
            correct_list = [answer]
        else:
            # Try to handle generic iterable/dict
            correct_list = list(answer) if answer else []

        # Normalize user answer to list
        user_list = []
        if isinstance(user, list):
            user_list = user
        elif isinstance(user, dict):
            # Handle dict {0: "ans", 1: "ans"}
            # Sort by index to ensure order
            try:
                indices = sorted([int(k) for k in user.keys()])
                user_list = [user[str(i)] for i in indices] # keys might be strings in JSON
                # If keys are ints in dict, the above lookup might fail if not cast
                if not user_list and indices:
                     user_list = [user[i] for i in indices]
            except Exception:
                user_list = list(user.values())
        elif isinstance(user, str):
            user_list = [user]
        
        # Fallback for mismatching lengths (e.g. if user provided single string for multi-blank)
        if len(user_list) != len(correct_list):
            return False
            
        # Compare all
        return all(_normalize_text(u) == _normalize_text(c) for u, c in zip(user_list, correct_list))

    if qtype == "multi":
        try:
            user_set = { _normalize_text(v) for v in (user or []) }
            ans_set = { _normalize_text(v) for v in (answer or []) }
            return user_set == ans_set
        except Exception:
            return False
    return False


@router.get("/attempts/{attempt_id}/validation-status")
async def get_validation_status(
    attempt_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Poll for AI validation status updates."""
    attempt = db.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    answers = db.query(AttemptAnswer).filter(
        AttemptAnswer.attempt_id == attempt_id
    ).all()
    
    pending_count = sum(1 for a in answers if a.correct is None)
    
    # Build list of all graded questions
    validated = []
    for ans in answers:
        if ans.correct is not None:
            q = db.get(QuestionModel, ans.question_id)
            validated.append({
                "questionId": ans.question_id,
                "correct": ans.correct,
                "correctAnswer": (q.answer or {}).get("value") if q else None,
                "userAnswer": ans.response.get("value") if ans.response else None,
            })
    
    # Recalculate score
    total = len(answers)
    correct = sum(1 for a in answers if a.correct is True)
    score_pct = (correct / total * 100) if total > 0 else 0
    
    return {
        "pendingCount": pending_count,
        "allComplete": pending_count == 0,
        "currentScore": round(score_pct, 2),
        "validatedQuestions": validated,
    }


@router.post("/attempts/{attempt_id}/questions/{question_id}/override")
def override_question_grade(
    attempt_id: int,
    question_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Override the grade for a specific question in an attempt"""
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    # Find the answer record
    answer_record = (
        db.query(AttemptAnswer)
        .filter(
            AttemptAnswer.attempt_id == attempt_id,
            AttemptAnswer.question_id == question_id
        )
        .first()
    )
    
    if answer_record is None:
        raise HTTPException(status_code=404, detail="Answer not found")
    
    # Toggle the correct status
    answer_record.correct = not answer_record.correct
    
    # Recalculate overall score
    all_answers = (
        db.query(AttemptAnswer)
        .filter(AttemptAnswer.attempt_id == attempt_id)
        .all()
    )
    
    correct_count = sum(1 for ans in all_answers if ans.correct)
    total_count = len(all_answers)
    new_score_pct = (correct_count / max(1, total_count)) * 100.0
    
    attempt.score_pct = new_score_pct
    
    db.commit()
    
    return {
        "success": True,
        "new_status": answer_record.correct,
        "new_score_pct": round(new_score_pct, 2)
    }


# Progress saving endpoints
@router.post("/exams/{exam_id}/start-attempt")
def start_attempt(exam_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Create a new in-progress attempt for an exam"""
    exam = db.get(ExamModel, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Check if there's already an in-progress attempt for this exam
    existing = (
        db.query(Attempt)
        .filter(
            Attempt.exam_id == exam_id,
            Attempt.status == "in_progress"
        )
        .first()
    )
    
    if existing:
        # Return existing attempt instead of creating a new one
        return {
            "attempt_id": existing.id,
            "status": existing.status,
            "started_at": existing.started_at.isoformat(),
            "progress_state": existing.progress_state or {}
        }
    
    # Create new in-progress attempt
    attempt = Attempt(
        exam_id=exam_id,
        status="in_progress",
        exam_type="exam"  # Default, can be overridden when saving progress
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    
    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "started_at": attempt.started_at.isoformat(),
        "progress_state": {}
    }


@router.get("/exams/{exam_id}/in-progress-attempt")
def get_in_progress_attempt(exam_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get the in-progress attempt for an exam, if it exists"""
    exam = db.get(ExamModel, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    attempt = (
        db.query(Attempt)
        .filter(
            Attempt.exam_id == exam_id,
            Attempt.status == "in_progress"
        )
        .first()
    )
    
    if not attempt:
        return {"exists": False}
    
    # Load saved answers
    saved_answers = {}
    for answer_record in attempt.answers:
        saved_answers[answer_record.question_id] = (
            answer_record.response.get("value") if answer_record.response else None
        )
    
    return {
        "exists": True,
        "attempt_id": attempt.id,
        "status": attempt.status,
        "started_at": attempt.started_at.isoformat(),
        "progress_state": attempt.progress_state or {},
        "saved_answers": saved_answers
    }


@router.post("/attempts/{attempt_id}/save-progress")
def save_progress(
    attempt_id: int,
    progress_data: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Save progress for an in-progress attempt"""
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    if attempt.status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail="Cannot save progress for a completed attempt"
        )
    
    # Extract progress data
    answers = progress_data.get("answers", {})  # {questionId: answer}
    bookmarks = progress_data.get("bookmarks", [])  # [questionId, ...]
    current_question_index = progress_data.get("current_question_index", 0)
    timer_state = progress_data.get("timer_state", None)  # {remaining_seconds: int} or null
    exam_type = progress_data.get("exam_type", "exam")  # "exam" or "practice"
    completed_questions = progress_data.get("completed_questions", []) # For practice mode

    # Update attempt metadata
    attempt.exam_type = exam_type
    attempt.progress_state = {
        "current_question_index": current_question_index,
        "timer_state": timer_state,
        "bookmarks": bookmarks,
        "completed_questions": completed_questions,
        "last_saved_at": datetime.utcnow().isoformat()
    }
    
    # Save/update answers
    for question_id, answer_value in answers.items():
        # Find existing answer record or create new one
        answer_record = (
            db.query(AttemptAnswer)
            .filter(
                AttemptAnswer.attempt_id == attempt_id,
                AttemptAnswer.question_id == question_id
            )
            .first()
        )
        
        if answer_record:
            # Update existing answer
            answer_record.response = {"value": answer_value}
        else:
            # Create new answer record (not graded yet)
            answer_record = AttemptAnswer(
                attempt_id=attempt_id,
                question_id=question_id,
                response={"value": answer_value},
                correct=None,  # Not graded yet
                ai_explanation=None
            )
            db.add(answer_record)
    
    db.commit()
    db.refresh(attempt)
    
    return {
        "success": True,
        "attempt_id": attempt.id,
        "status": attempt.status,
        "last_saved_at": attempt.progress_state.get("last_saved_at") if attempt.progress_state else None
    }


@router.get("/attempts/{attempt_id}/progress")
def get_progress(attempt_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get saved progress for an attempt"""
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    # Load saved answers
    saved_answers = {}
    for answer_record in attempt.answers:
        saved_answers[answer_record.question_id] = (
            answer_record.response.get("value") if answer_record.response else None
        )
    
    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "started_at": attempt.started_at.isoformat(),
        "progress_state": attempt.progress_state or {},
        "saved_answers": saved_answers
    }


