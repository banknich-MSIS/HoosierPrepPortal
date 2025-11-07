import { useEffect, useState } from "react";
import { getJobStatus } from "../api/client";

export default function JobToaster({ theme }: { theme: any }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [resultId, setResultId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("Queued");
  const [shortfallInfo, setShortfallInfo] = useState<
    | { requested: number; generated: number; reason?: string }
    | null
  >(null);
  // Persistent toaster: no auto-hide. Dismiss controls visibility & cleanup.

  useEffect(() => {
    const active = localStorage.getItem("active_exam_job");
    if (active) {
      setJobId(active);
      setVisible(true);
    }
    const onStarted = (e: any) => {
      if (e?.detail?.jobId) {
        setJobId(e.detail.jobId);
        setVisible(true);
      }
    };
    window.addEventListener("exam-job-started", onStarted as any);
    return () => {
      window.removeEventListener("exam-job-started", onStarted as any);
    };
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let intervalId: any = null;
    const tick = async () => {
      try {
        const s = await getJobStatus(jobId);
        if (cancelled) return;
        const pct = Math.round((s.progress || 0) * 100);
        setStatus(s.status);
        setProgress(pct);
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
        setMessage(msg);
        if (s.resultId) setResultId(s.resultId);
        if (s.error) setError(s.error);
        if (s.status === "succeeded" && s.shortfall && s.requestedCount && s.generatedCount !== undefined) {
          setShortfallInfo({
            requested: s.requestedCount,
            generated: s.generatedCount,
            reason: s.shortfallReason,
          });
        }
        // Emit completion but do not hide or clear; user must Dismiss
        if (s.status === "succeeded" && !cancelled) {
          window.dispatchEvent(
            new CustomEvent("exam-job-completed", {
              detail: { jobId, resultId: s.resultId },
            })
          );
          // Stop polling on terminal state
          if (intervalId) clearInterval(intervalId);
        }
        if (s.status === "failed" && intervalId) {
          clearInterval(intervalId);
        }
      } catch (e: any) {
        // keep toaster visible; retry on next tick
      }
    };
    tick();
    intervalId = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId]);

  // Fallback: if no jobId yet, poll localStorage briefly to pick up a newly set job
  useEffect(() => {
    if (jobId) return;
    let tries = 0;
    const id = setInterval(() => {
      if (tries++ > 5) {
        clearInterval(id);
        return;
      }
      const active = localStorage.getItem("active_exam_job");
      if (active) {
        setJobId(active);
        setVisible(true);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Exam generation</div>
      <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>{message}</div>
      {status === "succeeded" && shortfallInfo && (
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
          Requested {shortfallInfo.requested}, generated {shortfallInfo.generated}. Content is still close to target.
        </div>
      )}
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
      <style>{`
        @keyframes hp-stripes {
          0% { background-position: 0 0; }
          100% { background-position: 28px 0; }
        }
      `}</style>
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <small style={{ color: theme.textSecondary }}>
          You can browse around while your exam generates.
        </small>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              setVisible(false);
              if (jobId) localStorage.removeItem("active_exam_job");
            }}
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


