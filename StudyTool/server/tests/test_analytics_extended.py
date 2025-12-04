"""
Tests for extended analytics features:
- Weak Areas Deep Dive
- Time Management Dashboard
- Recent Performance Momentum
"""

from datetime import datetime, timedelta
from typing import List

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..db import Base
from ..models import Attempt, AttemptAnswer, Concept, Exam, Question, Upload
from ..routes.analytics import (
    calculate_momentum,
    calculate_time_management,
    calculate_weak_areas,
)


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def sample_data(db_session: Session):
    """Create sample data for testing."""
    # Create upload
    upload = Upload(
        filename="test.csv",
        file_type="csv",
        created_at=datetime.utcnow()
    )
    db_session.add(upload)
    db_session.flush()

    # Create concepts
    concepts = [
        Concept(upload_id=upload.id, name="Hypothesis Testing", score=0.0),
        Concept(upload_id=upload.id, name="Regression Analysis", score=0.0),
        Concept(upload_id=upload.id, name="Confidence Intervals", score=0.0),
    ]
    db_session.add_all(concepts)
    db_session.flush()

    # Create questions
    questions = [
        Question(
            upload_id=upload.id,
            stem="Question 1",
            qtype="mcq",
            concept_ids=[concepts[0].id],
            is_active=True
        ),
        Question(
            upload_id=upload.id,
            stem="Question 2",
            qtype="mcq",
            concept_ids=[concepts[1].id],
            is_active=True
        ),
        Question(
            upload_id=upload.id,
            stem="Question 3",
            qtype="mcq",
            concept_ids=[concepts[2].id],
            is_active=True
        ),
    ]
    db_session.add_all(questions)
    db_session.flush()

    # Create exam
    exam = Exam(
        upload_id=upload.id,
        settings={"difficulty": "Medium", "questionSourcing": "Mixed"},
        question_ids=[q.id for q in questions]
    )
    db_session.add(exam)
    db_session.flush()

    db_session.commit()
    
    return {
        "upload": upload,
        "concepts": concepts,
        "questions": questions,
        "exam": exam
    }


def test_weak_areas_no_attempts(db_session: Session):
    """Test weak areas calculation with no attempts."""
    result = calculate_weak_areas([], db_session)
    assert result == []


def test_weak_areas_insufficient_data(db_session: Session, sample_data):
    """Test weak areas calculation with insufficient attempts per concept."""
    exam = sample_data["exam"]
    questions = sample_data["questions"]
    
    # Create 3 attempts (below MIN_ATTEMPTS_FOR_CONCEPT = 5)
    for i in range(3):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=datetime.utcnow() - timedelta(days=i),
            finished_at=datetime.utcnow() - timedelta(days=i) + timedelta(hours=1),
            score_pct=75.0,
            duration_seconds=600,
            status="completed"
        )
        db_session.add(attempt)
        db_session.flush()
        
        # Add answers
        for question in questions:
            answer = AttemptAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                correct=True
            )
            db_session.add(answer)
    
    db_session.commit()
    
    attempts = db_session.query(Attempt).all()
    result = calculate_weak_areas(attempts, db_session)
    
    # Should be empty because we don't have MIN_ATTEMPTS_FOR_CONCEPT
    assert result == []


def test_weak_areas_with_sufficient_data(db_session: Session, sample_data):
    """Test weak areas calculation with sufficient attempts."""
    exam = sample_data["exam"]
    questions = sample_data["questions"]
    concepts = sample_data["concepts"]
    
    # Create 10 attempts with varying correctness
    for i in range(10):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=datetime.utcnow() - timedelta(days=i),
            finished_at=datetime.utcnow() - timedelta(days=i) + timedelta(hours=1),
            score_pct=75.0,
            duration_seconds=600,
            status="completed"
        )
        db_session.add(attempt)
        db_session.flush()
        
        # Question 1 (Concept 0): 30% accuracy (3/10 correct)
        answer1 = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=questions[0].id,
            correct=(i < 3)
        )
        db_session.add(answer1)
        
        # Question 2 (Concept 1): 60% accuracy (6/10 correct)
        answer2 = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=questions[1].id,
            correct=(i < 6)
        )
        db_session.add(answer2)
        
        # Question 3 (Concept 2): 90% accuracy (9/10 correct)
        answer3 = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=questions[2].id,
            correct=(i < 9)
        )
        db_session.add(answer3)
    
    db_session.commit()
    
    attempts = db_session.query(Attempt).all()
    result = calculate_weak_areas(attempts, db_session)
    
    # Should have 3 concepts, sorted by accuracy (worst first)
    assert len(result) == 3
    assert result[0]["concept_name"] == "Hypothesis Testing"
    assert result[0]["accuracy_pct"] == 30.0
    assert result[0]["correct_attempts"] == 3
    assert result[0]["total_attempts"] == 10
    
    assert result[1]["concept_name"] == "Regression Analysis"
    assert result[1]["accuracy_pct"] == 60.0
    
    assert result[2]["concept_name"] == "Confidence Intervals"
    assert result[2]["accuracy_pct"] == 90.0


def test_time_management_no_attempts(db_session: Session):
    """Test time management calculation with no attempts."""
    result = calculate_time_management([], db_session)
    
    assert result["summary"]["overall_avg_time_per_question_seconds"] is None
    assert result["attempts"] == []


def test_time_management_with_attempts(db_session: Session, sample_data):
    """Test time management calculation with valid attempts."""
    exam = sample_data["exam"]
    questions = sample_data["questions"]
    
    # Create 3 attempts with different durations
    durations = [900, 600, 1200]  # 15, 10, 20 minutes
    scores = [85.0, 90.0, 75.0]
    
    for i, (duration, score) in enumerate(zip(durations, scores)):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=datetime.utcnow() - timedelta(days=i),
            finished_at=datetime.utcnow() - timedelta(days=i) + timedelta(seconds=duration),
            score_pct=score,
            duration_seconds=duration,
            status="completed"
        )
        db_session.add(attempt)
        db_session.flush()
        
        # Add 3 answers per attempt
        for question in questions:
            answer = AttemptAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                correct=True
            )
            db_session.add(answer)
    
    db_session.commit()
    
    attempts = db_session.query(Attempt).all()
    result = calculate_time_management(attempts, db_session)
    
    # Check summary
    # Total time: 2700s, Total questions: 9, Avg: 300s
    assert result["summary"]["overall_avg_time_per_question_seconds"] == 300.0
    assert result["summary"]["recommended_range_seconds"] == [35.0, 40.0]
    
    # Check attempts
    assert len(result["attempts"]) == 3
    assert result["attempts"][0]["avg_time_per_question_seconds"] == 300.0  # 900/3
    assert result["attempts"][1]["avg_time_per_question_seconds"] == 200.0  # 600/3
    assert result["attempts"][2]["avg_time_per_question_seconds"] == 400.0  # 1200/3


def test_momentum_no_attempts():
    """Test momentum calculation with no attempts."""
    result = calculate_momentum([])
    
    assert result["momentum"] == "flat"
    assert result["recent"]["exams_count"] == 0
    assert result["previous"]["exams_count"] == 0
    assert result["deltas"]["score_change_pct_points"] is None


def test_momentum_improving(db_session: Session, sample_data):
    """Test momentum calculation with improving performance."""
    exam = sample_data["exam"]
    now = datetime.utcnow()
    
    # Create attempts in previous window (14-7 days ago) with lower scores
    for i in range(3):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=now - timedelta(days=14-i),
            finished_at=now - timedelta(days=14-i) + timedelta(hours=1),
            score_pct=70.0,
            duration_seconds=600,
            status="completed"
        )
        db_session.add(attempt)
    
    # Create attempts in recent window (last 7 days) with higher scores
    for i in range(3):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=now - timedelta(days=6-i),
            finished_at=now - timedelta(days=6-i) + timedelta(hours=1),
            score_pct=85.0,
            duration_seconds=600,
            status="completed"
        )
        db_session.add(attempt)
    
    db_session.commit()
    
    attempts = db_session.query(Attempt).all()
    result = calculate_momentum(attempts)
    
    assert result["momentum"] == "improving"
    assert result["recent"]["exams_count"] == 3
    assert result["recent"]["avg_score_pct"] == 85.0
    assert result["previous"]["exams_count"] == 3
    assert result["previous"]["avg_score_pct"] == 70.0
    assert result["deltas"]["score_change_pct_points"] == 15.0
    assert result["deltas"]["exams_change"] == 0


def test_momentum_declining(db_session: Session, sample_data):
    """Test momentum calculation with declining performance."""
    exam = sample_data["exam"]
    now = datetime.utcnow()
    
    # Create attempts in previous window with higher scores
    for i in range(2):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=now - timedelta(days=14-i),
            finished_at=now - timedelta(days=14-i) + timedelta(hours=1),
            score_pct=90.0,
            duration_seconds=600,
            status="completed"
        )
        db_session.add(attempt)
    
    # Create attempts in recent window with lower scores
    for i in range(2):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=now - timedelta(days=6-i),
            finished_at=now - timedelta(days=6-i) + timedelta(hours=1),
            score_pct=75.0,
            duration_seconds=600,
            status="completed"
        )
        db_session.add(attempt)
    
    db_session.commit()
    
    attempts = db_session.query(Attempt).all()
    result = calculate_momentum(attempts)
    
    assert result["momentum"] == "declining"
    assert result["deltas"]["score_change_pct_points"] == -15.0


def test_momentum_flat(db_session: Session, sample_data):
    """Test momentum calculation with flat performance."""
    exam = sample_data["exam"]
    now = datetime.utcnow()
    
    # Create attempts in both windows with similar scores
    for i in range(2):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=now - timedelta(days=14-i),
            finished_at=now - timedelta(days=14-i) + timedelta(hours=1),
            score_pct=80.0,
            duration_seconds=600,
            status="completed"
        )
        db_session.add(attempt)
    
    for i in range(2):
        attempt = Attempt(
            exam_id=exam.id,
            started_at=now - timedelta(days=6-i),
            finished_at=now - timedelta(days=6-i) + timedelta(hours=1),
            score_pct=81.0,
            duration_seconds=600,
            status="completed"
        )
        db_session.add(attempt)
    
    db_session.commit()
    
    attempts = db_session.query(Attempt).all()
    result = calculate_momentum(attempts)
    
    # Change is 1.0, which is less than threshold of 2.0
    assert result["momentum"] == "flat"
    assert result["deltas"]["score_change_pct_points"] == 1.0

