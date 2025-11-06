from fastapi.testclient import TestClient
from server.main import app
from server.services.gemini_service import GeneratedExam, ExamMetadata, QuestionData


def _fake_generated_exam():
    return GeneratedExam(
        metadata=ExamMetadata(
            topic="Test Topic",
            themes=["t1", "t2"],
            difficulty="medium",
            estimated_time_minutes=5,
        ),
        questions=[
            QuestionData(question="Q1?", answer="A1", type="mcq", options=["A1","B","C","D"], concepts=["c1"]),
            QuestionData(question="Q2?", answer="A2", type="short", options=None, concepts=["c2"]),
        ],
    )


def test_async_job_flow(monkeypatch, tmp_path):
    client = TestClient(app)

    # Monkeypatch Gemini generation to avoid external call
    async def _fake_generate_exam_from_content(content, config, api_key):
        return _fake_generated_exam()

    monkeypatch.setattr(
        "server.services.gemini_service.generate_exam_from_content",
        _fake_generate_exam_from_content,
    )

    files = {"files": ("sample.txt", b"hello world", "text/plain")}
    data = {
        "question_count": "2",
        "difficulty": "medium",
        "question_types": "mcq,short",
        "exam_name": "My Test Exam",
        "exam_mode": "exam",
        "generation_mode": "strict",
    }
    headers = {"X-Gemini-API-Key": "fake"}

    # Start job
    resp = client.post("/api/exams/generate", files=files, data=data, headers=headers)
    assert resp.status_code == 202
    job_id = resp.json()["jobId"]

    # Poll status until done
    for _ in range(20):
        s = client.get(f"/api/jobs/{job_id}").json()
        if s["status"] in ("succeeded", "failed"):
            break
    assert s["status"] == "succeeded"
    assert s.get("resultId") is not None


def test_title_persisted_in_upload_name(monkeypatch):
    client = TestClient(app)

    async def _fake_generate_exam_from_content(content, config, api_key):
        return _fake_generated_exam()

    monkeypatch.setattr(
        "server.services.gemini_service.generate_exam_from_content",
        _fake_generate_exam_from_content,
    )

    files = {"files": ("sample.txt", b"content", "text/plain")}
    data = {
        "question_count": "2",
        "difficulty": "medium",
        "question_types": "mcq,short",
        "exam_name": "Persisted Title",
    }
    headers = {"X-Gemini-API-Key": "fake"}

    # Use synchronous endpoint to simplify validation
    resp = client.post("/api/ai/generate-exam", files=files, data=data, headers=headers)
    assert resp.status_code == 200
    upload_id = resp.json()["upload_id"]

    # Fetch uploads and ensure name matches
    uploads = client.get("/api/uploads").json()
    names = {u["id"]: u["filename"] for u in uploads}
    assert names[upload_id] == "Persisted Title"


