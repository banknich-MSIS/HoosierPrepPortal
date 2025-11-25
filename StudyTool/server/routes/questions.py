from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..db import get_db
from ..models import Question, Upload
from ..schemas import QuestionDTO

router = APIRouter(tags=["questions"])

class QuestionUpdate(BaseModel):
    stem: Optional[str] = None
    options: Optional[Dict[str, Any]] = None
    correct_answer: Optional[Any] = None
    explanation: Optional[str] = None

@router.get("/uploads/{upload_id}/questions", response_model=List[QuestionDTO])
def get_upload_questions(upload_id: int, db: Session = Depends(get_db)) -> List[QuestionDTO]:
    """Get all active questions for an upload"""
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
        
    questions = (
        db.query(Question)
        .filter(Question.upload_id == upload_id, Question.is_active == True)
        .all()
    )
    
    dto = []
    for q in questions:
        # Construct QuestionDTO manually to include necessary fields
        q_data = {
            "id": q.id,
            "stem": q.stem,
            "type": q.qtype,
            "options": (q.options or {}).get("list"),
            "concepts": q.concept_ids or [],
            # Additional fields for editor might be needed, but QuestionDTO structure is fixed in schemas
            # We might need to extend QuestionDTO or use a different schema if we need correct answer exposed
        }
        dto.append(QuestionDTO.model_validate(q_data))
        
    return dto

@router.get("/questions-sets/{upload_id}/editor-data")
def get_questions_for_editor(upload_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Get all active questions with full details for editing (including correct answer)"""
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
        
    questions = (
        db.query(Question)
        .filter(Question.upload_id == upload_id, Question.is_active == True)
        .all()
    )
    
    result = []
    for q in questions:
        result.append({
            "id": q.id,
            "stem": q.stem,
            "type": q.qtype,
            "options": (q.options or {}).get("list"),
            "correct_answer": (q.answer or {}).get("value"),
            "explanation": (q.answer or {}).get("explanation"), # Assuming explanation might be stored here or we need to check models
            "concepts": q.concept_ids or [],
        })
    return result

@router.put("/questions/{question_id}")
def update_question(
    question_id: int, 
    payload: QuestionUpdate, 
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update a question"""
    question = db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    if payload.stem is not None:
        question.stem = payload.stem
        
    if payload.options is not None:
        # Ensure we keep the structure expected by the DB (dict with "list" key usually)
        # The payload.options is likely coming as the raw list or the dict wrapper
        # Let's assume the frontend sends the dict wrapper or we construct it
        # Checking model usage: options: Mapped[Optional[dict]]
        question.options = payload.options
        
    if payload.correct_answer is not None:
        # Update answer JSON
        current_answer = question.answer or {}
        current_answer["value"] = payload.correct_answer
        question.answer = current_answer
        
    if payload.explanation is not None:
        # Update explanation in answer JSON (assuming that's where it lives or we add it)
        # The prompt mentions "Explanation text (if stored)".
        # Looking at existing code, ai_explanation is on AttemptAnswer.
        # But maybe we want a 'canonical' explanation on the Question itself?
        # The models.py shows `answer: Mapped[Optional[dict]]`.
        # Let's store canonical explanation in question.answer["explanation"]
        current_answer = question.answer or {}
        current_answer["explanation"] = payload.explanation
        question.answer = current_answer

    db.commit()
    db.refresh(question)
    
    return {
        "id": question.id,
        "success": True
    }

@router.delete("/questions/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Soft delete a question"""
    question = db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    question.is_active = False
    db.commit()
    
    return {"success": True, "id": question_id}

