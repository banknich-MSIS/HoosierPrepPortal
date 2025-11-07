from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class JobRecord:
    job_id: str
    status: str = "queued"  # queued | running | succeeded | failed
    progress: float = 0.0
    result_id: Optional[int] = None  # exam id
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class JobManager:
    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}
        self._lock = asyncio.Lock()

    async def create_job(self, metadata: Optional[Dict[str, Any]] = None) -> JobRecord:
        job_id = str(uuid.uuid4())
        record = JobRecord(job_id=job_id, metadata=metadata or {})
        async with self._lock:
            self._jobs[job_id] = record
        return record

    async def set_status(self, job_id: str, status: str, progress: Optional[float] = None) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = status
            if progress is not None:
                job.progress = max(0.0, min(1.0, progress))

    async def set_result(self, job_id: str, result_id: int) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.result_id = result_id

    async def set_error(self, job_id: str, error: str) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.error = error

    async def set_metadata(self, job_id: str, updates: Dict[str, Any]) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.metadata.update(updates or {})

    async def get(self, job_id: str) -> Optional[JobRecord]:
        async with self._lock:
            return self._jobs.get(job_id)


# Singleton instance
job_manager = JobManager()


