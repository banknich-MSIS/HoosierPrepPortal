from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Attempt, AttemptAnswer, Exam, Question, Upload

router = APIRouter(tags=["analytics"])


@router.get("/analytics/detailed")
def get_detailed_analytics(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Return comprehensive analytics data for visualization:
    - Timeline data with scores, dates, difficulty, source type
    - Question type statistics (accuracy by type)
    - Source material statistics (accuracy by upload)
    """
    
    # Get all completed attempts
    attempts = (
        db.query(Attempt)
        .filter(Attempt.finished_at.isnot(None))
        .order_by(Attempt.finished_at.asc())
        .all()
    )
    
    if not attempts:
        return {
            "timeline_data": [],
            "question_type_stats": {},
            "source_material_stats": {}
        }
    
    # Build timeline data
    timeline_data = []
    question_type_totals = {}
    source_material_totals = {}
    
    for attempt in attempts:
        exam = db.get(Exam, attempt.exam_id)
        if not exam:
            continue
        
        upload = db.get(Upload, exam.upload_id)
        if not upload:
            continue
        
        # Extract settings
        settings = exam.settings or {}
        difficulty = settings.get("difficulty", "Medium")
        source_type = settings.get("questionSourcing", "Mixed")
        
        # Add to timeline
        timeline_data.append({
            "attempt_id": attempt.id,
            "date": attempt.finished_at.isoformat() if attempt.finished_at else attempt.started_at.isoformat(),
            "score": round(attempt.score_pct or 0.0, 2),
            "difficulty": difficulty,
            "source_type": source_type,
            "upload_names": [upload.filename]
        })
        
        # Track question type stats
        answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).all()
        for answer in answers:
            question = db.get(Question, answer.question_id)
            if not question:
                continue
            
            qtype = question.qtype
            if qtype not in question_type_totals:
                question_type_totals[qtype] = {"total": 0, "correct": 0}
            
            question_type_totals[qtype]["total"] += 1
            if answer.correct:
                question_type_totals[qtype]["correct"] += 1
        
        # Track source material stats
        source_name = upload.filename
        if source_name not in source_material_totals:
            source_material_totals[source_name] = {
                "total": 0,
                "correct": 0,
                "appearances": 0,
                "question_ids": set()
            }
        
        source_material_totals[source_name]["appearances"] += 1
        
        for answer in answers:
            question = db.get(Question, answer.question_id)
            if not question:
                continue
            
            # Only count each unique question once per source
            if question.id not in source_material_totals[source_name]["question_ids"]:
                source_material_totals[source_name]["question_ids"].add(question.id)
                source_material_totals[source_name]["total"] += 1
                if answer.correct:
                    source_material_totals[source_name]["correct"] += 1
    
    # Calculate question type stats
    question_type_stats = {}
    for qtype, stats in question_type_totals.items():
        accuracy = (stats["correct"] / stats["total"] * 100) if stats["total"] > 0 else 0
        question_type_stats[qtype] = {
            "total": stats["total"],
            "correct": stats["correct"],
            "accuracy": round(accuracy, 1)
        }
    
    # Calculate source material stats
    source_material_stats = {}
    for source, stats in source_material_totals.items():
        accuracy = (stats["correct"] / stats["total"] * 100) if stats["total"] > 0 else 0
        source_material_stats[source] = {
            "accuracy": round(accuracy, 1),
            "question_count": stats["total"],
            "appearances": stats["appearances"]
        }
    
    return {
        "timeline_data": timeline_data,
        "question_type_stats": question_type_stats,
        "source_material_stats": source_material_stats
    }


@router.post("/analytics/generate-insights")
async def generate_insights_endpoint(
    analytics_data: Dict[str, Any],
    x_gemini_api_key: str = Header(..., alias="X-Gemini-API-Key")
) -> Dict[str, str]:
    """
    Generate AI-powered performance insights from analytics data.
    Requires Gemini API key in header.
    """
    from ..services.gemini_service import generate_performance_insights
    
    try:
        insights = await generate_performance_insights(
            timeline_data=analytics_data.get("timeline_data", []),
            question_type_stats=analytics_data.get("question_type_stats", {}),
            source_material_stats=analytics_data.get("source_material_stats", {}),
            api_key=x_gemini_api_key
        )
        
        return {"insights": insights}
    except Exception as e:
        return {"insights": f"Unable to generate insights: {str(e)}"}


