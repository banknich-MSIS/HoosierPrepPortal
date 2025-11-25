"""
Backup and restore routes for database migration.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List
import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..db import get_db, engine
from ..models import Upload, Question, Concept, Exam, Attempt, AttemptAnswer, Class, upload_classes

router = APIRouter(tags=["backup"])


@router.get("/backup/create")
def create_backup(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Create a complete backup of all database data"""
    
    # Fetch all data from each table
    uploads = db.query(Upload).all()
    questions = db.query(Question).all()
    concepts = db.query(Concept).all()
    exams = db.query(Exam).all()
    attempts = db.query(Attempt).all()
    attempt_answers = db.query(AttemptAnswer).all()
    classes = db.query(Class).all()
    
    # Get upload_classes associations
    upload_classes_data = db.execute(text("SELECT upload_id, class_id FROM upload_classes")).fetchall()
    
    # Serialize data
    backup_data = {
        "version": "1.0",
        "app_name": "Hoosier Prep Portal",
        "created_at": datetime.utcnow().isoformat(),
        "data": {
            "uploads": [
                {
                    "id": u.id,
                    "filename": u.filename,
                    "file_type": u.file_type,
                    "csv_file_path": u.csv_file_path,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in uploads
            ],
            "questions": [
                {
                    "id": q.id,
                    "upload_id": q.upload_id,
                    "stem": q.stem,
                    "qtype": q.qtype,
                    "options": q.options,
                    "answer": q.answer,
                    "concept_ids": q.concept_ids,
                }
                for q in questions
            ],
            "concepts": [
                {
                    "id": c.id,
                    "upload_id": c.upload_id,
                    "name": c.name,
                    "score": c.score,
                }
                for c in concepts
            ],
            "exams": [
                {
                    "id": e.id,
                    "upload_id": e.upload_id,
                    "settings": e.settings,
                    "question_ids": e.question_ids,
                }
                for e in exams
            ],
            "attempts": [
                {
                    "id": a.id,
                    "exam_id": a.exam_id,
                    "started_at": a.started_at.isoformat() if a.started_at else None,
                    "finished_at": a.finished_at.isoformat() if a.finished_at else None,
                    "score_pct": a.score_pct,
                    "duration_seconds": a.duration_seconds,
                    "exam_type": a.exam_type,
                    "status": a.status,
                }
                for a in attempts
            ],
            "attempt_answers": [
                {
                    "id": aa.id,
                    "attempt_id": aa.attempt_id,
                    "question_id": aa.question_id,
                    "response": aa.response,
                    "correct": aa.correct,
                }
                for aa in attempt_answers
            ],
            "classes": [
                {
                    "id": cls.id,
                    "name": cls.name,
                    "description": cls.description,
                    "color": cls.color,
                    "created_at": cls.created_at.isoformat() if cls.created_at else None,
                }
                for cls in classes
            ],
            "upload_classes": [
                {"upload_id": uc[0], "class_id": uc[1]} for uc in upload_classes_data
            ],
        },
        "metadata": {
            "total_uploads": len(uploads),
            "total_questions": len(questions),
            "total_exams": len(exams),
            "total_attempts": len(attempts),
            "total_classes": len(classes),
        },
    }
    
    return backup_data


@router.post("/backup/restore")
async def restore_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Restore database from a backup file"""
    
    try:
        # Read and parse the backup file
        content = await file.read()
        backup_data = json.loads(content)
        
        # Validate backup format
        if backup_data.get("version") != "1.0":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported backup version: {backup_data.get('version')}"
            )
        
        if backup_data.get("app_name") != "Hoosier Prep Portal":
            raise HTTPException(
                status_code=400,
                detail="Invalid backup file: not from Hoosier Prep Portal"
            )
        
        data = backup_data.get("data", {})
        
        # Clear all existing data (in reverse order of dependencies)
        db.execute(text("DELETE FROM attempt_answers"))
        db.execute(text("DELETE FROM attempts"))
        db.execute(text("DELETE FROM exams"))
        db.execute(text("DELETE FROM questions"))
        db.execute(text("DELETE FROM concepts"))
        db.execute(text("DELETE FROM upload_classes"))
        db.execute(text("DELETE FROM classes"))
        db.execute(text("DELETE FROM uploads"))
        db.commit()
        
        # Restore data (in order of dependencies)
        # 1. Uploads
        for u in data.get("uploads", []):
            upload = Upload(
                id=u["id"],
                filename=u["filename"],
                file_type=u["file_type"],
                csv_file_path=u.get("csv_file_path"),
                created_at=datetime.fromisoformat(u["created_at"]) if u.get("created_at") else datetime.utcnow(),
            )
            db.add(upload)
        
        # 2. Questions
        for q in data.get("questions", []):
            question = Question(
                id=q["id"],
                upload_id=q["upload_id"],
                stem=q["stem"],
                qtype=q["qtype"],
                options=q.get("options"),
                answer=q.get("answer"),
                concept_ids=q.get("concept_ids"),
            )
            db.add(question)
        
        # 3. Concepts
        for c in data.get("concepts", []):
            concept = Concept(
                id=c["id"],
                upload_id=c["upload_id"],
                name=c["name"],
                score=c.get("score", 0.0),
            )
            db.add(concept)
        
        # 4. Exams
        for e in data.get("exams", []):
            exam = Exam(
                id=e["id"],
                upload_id=e["upload_id"],
                settings=e.get("settings"),
                question_ids=e["question_ids"],
            )
            db.add(exam)
        
        # 5. Attempts
        for a in data.get("attempts", []):
            attempt = Attempt(
                id=a["id"],
                exam_id=a["exam_id"],
                started_at=datetime.fromisoformat(a["started_at"]) if a.get("started_at") else datetime.utcnow(),
                finished_at=datetime.fromisoformat(a["finished_at"]) if a.get("finished_at") else None,
                score_pct=a.get("score_pct"),
                duration_seconds=a.get("duration_seconds"),
                exam_type=a.get("exam_type", "exam"),
                status=a.get("status", "completed"),
            )
            db.add(attempt)
        
        # 6. Attempt Answers
        for aa in data.get("attempt_answers", []):
            attempt_answer = AttemptAnswer(
                id=aa["id"],
                attempt_id=aa["attempt_id"],
                question_id=aa["question_id"],
                response=aa.get("response"),
                correct=aa.get("correct"),
            )
            db.add(attempt_answer)
        
        # 7. Classes
        for cls in data.get("classes", []):
            class_obj = Class(
                id=cls["id"],
                name=cls["name"],
                description=cls.get("description"),
                color=cls.get("color"),
                created_at=datetime.fromisoformat(cls["created_at"]) if cls.get("created_at") else datetime.utcnow(),
            )
            db.add(class_obj)
        
        # 8. Upload-Classes associations
        for uc in data.get("upload_classes", []):
            db.execute(
                text("INSERT INTO upload_classes (upload_id, class_id) VALUES (:uid, :cid)"),
                {"uid": uc["upload_id"], "cid": uc["class_id"]}
            )
        
        db.commit()
        
        return {
            "success": True,
            "message": "Backup restored successfully",
            "restored": {
                "uploads": len(data.get("uploads", [])),
                "questions": len(data.get("questions", [])),
                "attempts": len(data.get("attempts", [])),
                "classes": len(data.get("classes", [])),
            },
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

