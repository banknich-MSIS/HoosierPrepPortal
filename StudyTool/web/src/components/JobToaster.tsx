import { useEffect, useState } from "react";
import { getJobStatus } from "../api/client";

interface JobState {
  jobId: string;
  examName?: string;
  status: string | null;
  progress: number;
  resultId: number | null;
  error: string | null;
  message: string;
  shortfallInfo: {
    requested: number;
    generated: number;
    reason?: string;
  } | null;
}

export default function JobToaster({ theme }: { theme: any }) {
  const [jobs, setJobs] = useState<JobState[]>([]);
  // Track multiple concurrent jobs

  // Load active jobs from localStorage on mount
  useEffect(() => {
    // Backward compatibility: migrate old single job format to new array format
    const oldJob = localStorage.getItem("active_exam_job");
    if (oldJob) {
      const jobList = [{ jobId: oldJob, examName: "Exam" }];
      localStorage.setItem("active_exam_jobs", JSON.stringify(jobList));
      localStorage.removeItem("active_exam_job");
    }

    const activeJobs = localStorage.getItem("active_exam_jobs");
    if (activeJobs) {
      try {
        const jobList = JSON.parse(activeJobs);
        if (Array.isArray(jobList) && jobList.length > 0) {
          const initialJobs = jobList.map((item: any) => ({
            jobId: item.jobId,
            examName: item.examName || "Exam",
            status: null,
            progress: 0,
            resultId: null,
            error: null,
            message: "Queued",
            shortfallInfo: null,
          }));
          setJobs(initialJobs);
        }
      } catch (e) {
        console.error("Failed to parse active jobs from localStorage:", e);
      }
    }

    const onStarted = (e: any) => {
      if (e?.detail?.jobId) {
        setJobs((prev) => {
          // Check if job already exists
          if (prev.some((j) => j.jobId === e.detail.jobId)) {
            return prev;
          }
          // Add new job to the list
          return [
            ...prev,
            {
              jobId: e.detail.jobId,
              examName: e.detail.examName || "Exam",
              status: null,
              progress: 0,
              resultId: null,
              error: null,
              message: "Queued",
              shortfallInfo: null,
            },
          ];
        });
      }
    };

    window.addEventListener("exam-job-started", onStarted as any);
    return () => {
      window.removeEventListener("exam-job-started", onStarted as any);
    };
  }, []);

  // Poll status for each active job
  useEffect(() => {
    if (jobs.length === 0) return;

    const intervals: any[] = [];
    const cancelled: Record<string, boolean> = {};

    jobs.forEach((job) => {
      if (job.status === "succeeded" || job.status === "failed") {
        return; // Don't poll completed jobs
      }

      const tick = async () => {
        if (cancelled[job.jobId]) return;
        try {
          const s = await getJobStatus(job.jobId);
          if (cancelled[job.jobId]) return;

          const pct = Math.round((s.progress || 0) * 100);

          // Friendly message
          let msg = "Queued";
          if (s.status === "running") {
            if (pct < 15) msg = "Preparing files";
            else if (pct < 35) msg = "Uploading & extracting";
            else if (pct < 70) msg = "Generating with AI";
            else if (pct < 90) msg = "Saving to library";
            else msg = "Finalizing";
          } else if (s.status === "succeeded") {
            msg = "Completed";
          } else if (s.status === "failed") {
            msg = "Failed";
          }

          setJobs((prev) =>
            prev.map((j) =>
              j.jobId === job.jobId
                ? {
                    ...j,
                    status: s.status,
                    progress: pct,
                    resultId: s.resultId || j.resultId,
                    error: s.error || j.error,
                    message: msg,
                    shortfallInfo:
                      s.status === "succeeded" &&
                      s.shortfall &&
                      s.requestedCount &&
                      s.generatedCount !== undefined
                        ? {
                            requested: s.requestedCount,
                            generated: s.generatedCount,
                            reason: s.shortfallReason,
                          }
                        : j.shortfallInfo,
                  }
                : j
            )
          );

          // Emit completion event
          if (s.status === "succeeded" && !cancelled[job.jobId]) {
            window.dispatchEvent(
              new CustomEvent("exam-job-completed", {
                detail: { jobId: job.jobId, resultId: s.resultId },
              })
            );

            // Auto-remove after 5 seconds
            setTimeout(() => {
              removeJob(job.jobId);
            }, 5000);
          }

          // Auto-remove failed jobs after 10 seconds
          if (s.status === "failed" && !cancelled[job.jobId]) {
            setTimeout(() => {
              removeJob(job.jobId);
            }, 10000);
          }
        } catch (e: any) {
          // Retry on next tick
        }
      };

      tick(); // Initial tick
      const intervalId = setInterval(tick, 2500);
      intervals.push(intervalId);
    });

    return () => {
      jobs.forEach((job) => {
        cancelled[job.jobId] = true;
      });
      intervals.forEach((id) => clearInterval(id));
    };
  }, [jobs.map((j) => j.jobId).join(",")]);

  // Update localStorage whenever jobs change
  useEffect(() => {
    const activeJobs = jobs
      .filter((j) => j.status !== "succeeded" && j.status !== "failed")
      .map((j) => ({ jobId: j.jobId, examName: j.examName }));

    if (activeJobs.length > 0) {
      localStorage.setItem("active_exam_jobs", JSON.stringify(activeJobs));
    } else {
      localStorage.removeItem("active_exam_jobs");
    }
  }, [jobs]);

  const removeJob = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
  };

  if (jobs.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 96,
        right: 24,
        zIndex: 9998,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxHeight: "calc(100vh - 200px)",
        overflowY: "auto",
      }}
    >
      <style>{`
        @keyframes hp-stripes {
          0% { background-position: 0 0; }
          100% { background-position: 28px 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {jobs.map((job, index) => (
        <div
          key={job.jobId}
          style={{
            minWidth: 280,
            maxWidth: 320,
            padding: 14,
            background: theme.cardBg,
            color: theme.text,
            border: `1px solid ${theme.glassBorder}`,
            borderRadius: 10,
            boxShadow: theme.glassShadow,
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600 }}>{job.examName || "Exam"}</div>
            <button
              onClick={() => removeJob(job.jobId)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "none",
                background: "transparent",
                color: theme.textSecondary,
                fontSize: 18,
                cursor: "pointer",
                lineHeight: 1,
              }}
              title="Dismiss"
            >
              ×
            </button>
          </div>

          <div
            style={{
              fontSize: 12,
              color: theme.textSecondary,
              marginBottom: 8,
            }}
          >
            {job.message}
          </div>

          {job.status === "succeeded" && job.shortfallInfo && (
            <div
              style={{
                marginBottom: 10,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.05)",
                color: theme.text,
                border: `1px solid ${theme.glassBorder}`,
                fontSize: 12,
              }}
            >
              Requested {job.shortfallInfo.requested}, generated{" "}
              {job.shortfallInfo.generated}. Content is still close to target.
            </div>
          )}

          {job.status !== "succeeded" && job.status !== "failed" && (
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: theme.border,
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${job.progress}%`,
                  backgroundImage:
                    "repeating-linear-gradient(45deg, " +
                    theme.crimson +
                    ", " +
                    theme.crimson +
                    " 10px, " +
                    theme.crimsonLight +
                    " 10px, " +
                    theme.crimsonLight +
                    " 20px)",
                  backgroundSize: "28px 28px",
                  animation: "hp-stripes 1s linear infinite",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          )}

          {job.status === "succeeded" && (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(76, 175, 80, 0.1)",
                color: "#4CAF50",
                fontSize: 12,
                fontWeight: 600,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              ✓ Completed
            </div>
          )}

          {job.status === "failed" && (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(220, 53, 69, 0.1)",
                color: "#dc3545",
                fontSize: 12,
                fontWeight: 600,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              ✗ Failed {job.error && `- ${job.error}`}
            </div>
          )}

          {index === 0 && (
            <div
              style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}
            >
              You can browse around while generating.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
