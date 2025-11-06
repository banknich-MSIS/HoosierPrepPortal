import { useEffect, useState } from "react";
import { getJobStatus } from "../api/client";

export default function JobToaster({ theme }: { theme: any }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [resultId, setResultId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const active = localStorage.getItem("active_exam_job");
    if (active) {
      setJobId(active);
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await getJobStatus(jobId);
        if (cancelled) return;
        setStatus(s.status);
        setProgress(Math.round((s.progress || 0) * 100));
        if (s.resultId) setResultId(s.resultId);
        if (s.error) setError(s.error);
        if (s.status === "succeeded" || s.status === "failed") {
          // Clear active job
          localStorage.removeItem("active_exam_job");
          // Auto-hide after a short delay on success
          if (s.status === "succeeded") {
            setTimeout(() => setVisible(false), 4000);
          }
        }
      } catch (e: any) {
        // ignore transient errors
      }
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId]);

  if (!visible || !jobId) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 96,
        left: 24,
        zIndex: 9998,
        minWidth: 280,
        padding: 14,
        background: theme.cardBg,
        color: theme.text,
        border: `1px solid ${theme.glassBorder}`,
        borderRadius: 10,
        boxShadow: theme.glassShadow,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Exam generation</div>
      <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>
        {status === "succeeded"
          ? "Completed"
          : status === "failed"
          ? `Failed${error ? `: ${error}` : ""}`
          : status === "running"
          ? "In progress"
          : "Queued"}
      </div>
      {status !== "succeeded" && (
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
              width: `${progress}%`,
              background: theme.crimson,
              transition: "width 0.35s ease",
            }}
          />
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <small style={{ color: theme.textSecondary }}>
          You can browse around while your exam generates.
        </small>
        <div style={{ display: "flex", gap: 8 }}>
          {status === "succeeded" && resultId && (
            <a
              href={`#/exam/${resultId}`}
              style={{
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: 6,
                background: theme.crimson,
                color: "white",
                fontSize: 12,
              }}
            >
              View exam
            </a>
          )}
          <button
            onClick={() => setVisible(false)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${theme.glassBorder}`,
              background: "transparent",
              color: theme.text,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}


