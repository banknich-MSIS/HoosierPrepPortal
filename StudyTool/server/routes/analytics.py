from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Attempt, AttemptAnswer, Concept, Exam, Question, Upload

router = APIRouter(tags=["analytics"])

# Configuration constants
MIN_ATTEMPTS_FOR_CONCEPT = 5
RECOMMENDED_TIME_RANGE_SECONDS = [35.0, 40.0]
RECENT_WINDOW_DAYS = 7
PREVIOUS_WINDOW_DAYS = 7
MOMENTUM_THRESHOLD_PCT_POINTS = 2.0


def calculate_weak_areas(attempts: List[Attempt], db: Session) -> List[Dict[str, Any]]:
    """
    Calculate concept-level performance across all completed attempts.
    Returns a list of concepts sorted by accuracy (worst to best).
    """
    concept_stats = {}
    
    for attempt in attempts:
        answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).all()
        
        for answer in answers:
            question = db.get(Question, answer.question_id)
            if not question or not question.concept_ids:
                continue
            
            # Track stats for each concept this question is tagged with
            for concept_id in question.concept_ids:
                if concept_id not in concept_stats:
                    concept_stats[concept_id] = {
                        "total_attempts": 0,
                        "correct_attempts": 0,
                        "last_seen_at": None
                    }
                
                concept_stats[concept_id]["total_attempts"] += 1
                if answer.correct:
                    concept_stats[concept_id]["correct_attempts"] += 1
                
                # Track last seen timestamp
                if attempt.finished_at:
                    if (concept_stats[concept_id]["last_seen_at"] is None or 
                        attempt.finished_at > concept_stats[concept_id]["last_seen_at"]):
                        concept_stats[concept_id]["last_seen_at"] = attempt.finished_at
    
    # Build the result list
    weak_areas = []
    for concept_id, stats in concept_stats.items():
        # Filter out concepts with too few attempts
        if stats["total_attempts"] < MIN_ATTEMPTS_FOR_CONCEPT:
            continue
        
        # Calculate accuracy
        accuracy_pct = (stats["correct_attempts"] / stats["total_attempts"]) * 100
        
        # Look up concept name
        concept = db.get(Concept, concept_id)
        concept_name = concept.name if concept else f"Concept #{concept_id}"
        
        weak_areas.append({
            "concept_id": concept_id,
            "concept_name": concept_name,
            "accuracy_pct": round(accuracy_pct, 1),
            "correct_attempts": stats["correct_attempts"],
            "total_attempts": stats["total_attempts"],
            "last_seen_at": stats["last_seen_at"].isoformat() if stats["last_seen_at"] else None
        })
    
    # Sort by accuracy (worst first)
    weak_areas.sort(key=lambda x: x["accuracy_pct"])
    
    return weak_areas


def calculate_time_management(attempts: List[Attempt], db: Session) -> Dict[str, Any]:
    """
    Calculate time management statistics including avg time per question
    and detailed attempt-level timing data.
    """
    time_attempts = []
    total_time_weighted = 0.0
    total_questions = 0
    
    for attempt in attempts:
        # Skip attempts without duration data
        if not attempt.duration_seconds or attempt.duration_seconds == 0:
            continue
        
        # Get question count for this attempt
        answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).all()
        question_count = len(answers)
        
        # Fallback to exam question_ids if needed
        if question_count == 0:
            exam = db.get(Exam, attempt.exam_id)
            if exam and exam.question_ids:
                question_count = len(exam.question_ids)
        
        # Guard against division by zero
        if question_count == 0:
            continue
        
        avg_time_per_question = attempt.duration_seconds / question_count
        
        time_attempts.append({
            "attempt_id": attempt.id,
            "finished_at": attempt.finished_at.isoformat() if attempt.finished_at else attempt.started_at.isoformat(),
            "score_pct": round(attempt.score_pct or 0.0, 2),
            "duration_seconds": attempt.duration_seconds,
            "question_count": question_count,
            "avg_time_per_question_seconds": round(avg_time_per_question, 1)
        })
        
        # Accumulate for overall average
        total_time_weighted += attempt.duration_seconds
        total_questions += question_count
    
    # Calculate overall average
    overall_avg = None
    if total_questions > 0:
        overall_avg = round(total_time_weighted / total_questions, 1)
    
    return {
        "summary": {
            "overall_avg_time_per_question_seconds": overall_avg,
            "recommended_range_seconds": RECOMMENDED_TIME_RANGE_SECONDS
        },
        "attempts": time_attempts
    }


def calculate_momentum(attempts: List[Attempt]) -> Dict[str, Any]:
    """
    Calculate performance momentum by comparing recent 7 days vs previous 7 days.
    """
    if not attempts:
        return {
            "recent_window_days": RECENT_WINDOW_DAYS,
            "previous_window_days": PREVIOUS_WINDOW_DAYS,
            "recent": {"exams_count": 0, "avg_score_pct": None},
            "previous": {"exams_count": 0, "avg_score_pct": None},
            "deltas": {"score_change_pct_points": None, "exams_change": 0},
            "momentum": "flat"
        }
    
    # Use the latest finished_at as "now"
    now = max(
        (a.finished_at for a in attempts if a.finished_at),
        default=datetime.utcnow()
    )
    
    recent_cutoff = now - timedelta(days=RECENT_WINDOW_DAYS)
    previous_cutoff = now - timedelta(days=RECENT_WINDOW_DAYS + PREVIOUS_WINDOW_DAYS)
    
    # Partition attempts
    recent_attempts = [
        a for a in attempts 
        if a.finished_at and recent_cutoff <= a.finished_at <= now
    ]
    previous_attempts = [
        a for a in attempts 
        if a.finished_at and previous_cutoff <= a.finished_at < recent_cutoff
    ]
    
    # Calculate averages
    recent_count = len(recent_attempts)
    recent_avg = None
    if recent_count > 0:
        recent_avg = round(
            sum(a.score_pct or 0.0 for a in recent_attempts) / recent_count, 
            1
        )
    
    previous_count = len(previous_attempts)
    previous_avg = None
    if previous_count > 0:
        previous_avg = round(
            sum(a.score_pct or 0.0 for a in previous_attempts) / previous_count,
            1
        )
    
    # Calculate deltas
    score_change = None
    if recent_avg is not None and previous_avg is not None:
        score_change = round(recent_avg - previous_avg, 1)
    
    exams_change = recent_count - previous_count
    
    # Determine momentum classification
    momentum = "flat"
    if score_change is not None:
        if score_change > MOMENTUM_THRESHOLD_PCT_POINTS:
            momentum = "improving"
        elif score_change < -MOMENTUM_THRESHOLD_PCT_POINTS:
            momentum = "declining"
    
    return {
        "recent_window_days": RECENT_WINDOW_DAYS,
        "previous_window_days": PREVIOUS_WINDOW_DAYS,
        "recent": {
            "exams_count": recent_count,
            "avg_score_pct": recent_avg
        },
        "previous": {
            "exams_count": previous_count,
            "avg_score_pct": previous_avg
        },
        "deltas": {
            "score_change_pct_points": score_change,
            "exams_change": exams_change
        },
        "momentum": momentum
    }


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
            "source_material_stats": {},
            "weak_areas": [],
            "time_management": {
                "summary": {
                    "overall_avg_time_per_question_seconds": None,
                    "recommended_range_seconds": RECOMMENDED_TIME_RANGE_SECONDS
                },
                "attempts": []
            },
            "momentum": {
                "recent_window_days": RECENT_WINDOW_DAYS,
                "previous_window_days": PREVIOUS_WINDOW_DAYS,
                "recent": {"exams_count": 0, "avg_score_pct": None},
                "previous": {"exams_count": 0, "avg_score_pct": None},
                "deltas": {"score_change_pct_points": None, "exams_change": 0},
                "momentum": "flat"
            }
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
    
    # Calculate new analytics sections
    weak_areas = calculate_weak_areas(attempts, db)
    time_management = calculate_time_management(attempts, db)
    momentum = calculate_momentum(attempts)
    
    return {
        "timeline_data": timeline_data,
        "question_type_stats": question_type_stats,
        "source_material_stats": source_material_stats,
        "weak_areas": weak_areas,
        "time_management": time_management,
        "momentum": momentum
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


