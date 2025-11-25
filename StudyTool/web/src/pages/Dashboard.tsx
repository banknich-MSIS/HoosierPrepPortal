import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import ExamsInProgressWidget from "../components/ExamsInProgressWidget";
import CSVLibrary from "../components/CSVLibrary";
import ExamHistory from "../components/ExamHistory";
import PerformanceAnalytics from "../components/PerformanceAnalytics";
import DashboardLayoutSettings, {
  DashboardSection,
} from "../components/DashboardLayoutSettings";
import {
  fetchAllUploads,
  fetchRecentAttempts,
  fetchInProgressAttempts,
  deleteUpload,
  downloadCSV,
  deleteAttempt,
  archiveUpload,
} from "../api/client";
import type { UploadSummary, AttemptSummary } from "../types";

export default function Dashboard() {
  const navigate = useNavigate();
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [inProgressAttempts, setInProgressAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [layoutSections, setLayoutSections] = useState<DashboardSection[]>(
    () => {
      // Load from localStorage or use defaults
      const saved = localStorage.getItem("dashboardLayout");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Fall through to default
        }
      }
      return [
        {
          id: "analytics",
          title: "Performance Analytics",
          visible: true,
          order: 0,
        },
        {
          id: "in_progress",
          title: "Exams in Progress",
          visible: true,
          order: 1,
        },
        {
          id: "history",
          title: "Recent Exam History",
          visible: true,
          order: 2,
        },
        { id: "library", title: "CSV Library", visible: true, order: 3 },
      ];
    }
  );

  // Ensure in_progress section exists for existing users
  useEffect(() => {
    const hasInProgress = layoutSections.some((s) => s.id === "in_progress");
    if (!hasInProgress) {
      const newSections = [
        {
          id: "in_progress",
          title: "Exams in Progress",
          visible: true,
          order: 1,
        },
        ...layoutSections.map((s) => ({ ...s, order: s.order + 1 })),
      ];
      setLayoutSections(newSections);
      localStorage.setItem("dashboardLayout", JSON.stringify(newSections));
    }
  }, []);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Show restore prompt on first dashboard load when no data exists
  useEffect(() => {
    if (!loaded) return;
    const alreadyShown = localStorage.getItem("restore_prompt_shown") === "true";
    if (!alreadyShown && uploads.length === 0 && attempts.length === 0) {
      setShowRestorePrompt(true);
    }
  }, [loaded, uploads.length, attempts.length]);

  // Targeted refresh of CSV Library while page is visible
  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const uploadsData = await fetchAllUploads();
        if (!cancelled) setUploads(uploadsData);
      } catch {}
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [uploadsData, attemptsData, inProgressData] = await Promise.all([
        fetchAllUploads(),
        fetchRecentAttempts(10),
        fetchInProgressAttempts(),
      ]);
      setUploads(uploadsData);
      setAttempts(attemptsData);
      setInProgressAttempts(inProgressData);
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  // Refresh uploads when a generation job completes
  useEffect(() => {
    const onCompleted = async () => {
      try {
        const uploadsData = await fetchAllUploads();
        setUploads(uploadsData);
      } catch {}
    };
    window.addEventListener("exam-job-completed", onCompleted as any);
    return () =>
      window.removeEventListener("exam-job-completed", onCompleted as any);
  }, []);

  const handleCreateExam = (
    uploadIds: number[],
    uploadData?: UploadSummary
  ) => {
    navigate("/settings", { state: { uploadIds, uploadData } });
  };

  const handleDeleteUpload = async (uploadId: number) => {
    try {
      await deleteUpload(uploadId);
      setUploads(uploads.filter((u) => u.id !== uploadId));
    } catch (e: any) {
      setError(e?.message || "Failed to delete CSV");
    }
  };

  const handleDownloadCSV = async (uploadId: number) => {
    try {
      const blob = await downloadCSV(uploadId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        uploads.find((u) => u.id === uploadId)?.filename || "download.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Failed to download CSV");
    }
  };

  const handleArchiveUpload = async (uploadId: number) => {
    try {
      await archiveUpload(uploadId);
      setUploads(uploads.filter((u) => u.id !== uploadId));
    } catch (e: any) {
      setError(e?.message || "Failed to archive upload");
    }
  };

  const handleReviewAttempt = (attemptId: number) => {
    navigate(`/history/${attemptId}`);
  };

  const handleDeleteAttempt = async (attemptId: number) => {
    try {
      await deleteAttempt(attemptId);
      setAttempts(attempts.filter((a) => a.id !== attemptId));
      // Trigger insights refresh on exam deletion
      window.dispatchEvent(new CustomEvent("exam-deleted"));
    } catch (e: any) {
      setError(e?.message || "Failed to delete attempt");
    }
  };

  const handleDeleteInProgress = async (attemptId: number) => {
    try {
      await deleteAttempt(attemptId);
      setInProgressAttempts(inProgressAttempts.filter((a) => a.id !== attemptId));
    } catch (e: any) {
      setError(e?.message || "Failed to delete in-progress attempt");
    }
  };

  const handleBulkDeleteAttempts = async (attemptIds: number[]) => {
    try {
      // Delete all attempts in parallel
      await Promise.all(attemptIds.map((id) => deleteAttempt(id)));
      // Update state once with all deletions
      setAttempts(attempts.filter((a) => !attemptIds.includes(a.id)));
      // Trigger insights refresh on exam deletion
      window.dispatchEvent(new CustomEvent("exam-deleted"));
    } catch (e: any) {
      setError(e?.message || "Failed to delete attempts");
      throw e; // Re-throw to let ExamHistory show error
    }
  };

  const handleUploadNew = () => {
    navigate("/upload");
  };

  const handleViewAllHistory = () => {
    navigate("/history");
  };

  const handleShowTutorial = () => {
    window.dispatchEvent(new CustomEvent("showTutorial"));
  };

  const handleSaveLayout = (sections: DashboardSection[]) => {
    // Update state and persist to localStorage when Save is clicked
    setLayoutSections(sections);
    localStorage.setItem("dashboardLayout", JSON.stringify(sections));
  };

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case "analytics":
        return (
          (!loaded && (
            <div
              key="analytics"
              style={{
                height: 120,
                borderRadius: 12,
                background: theme.cardBg,
                border: "1px solid " + theme.glassBorder,
                boxShadow: theme.glassShadow,
              }}
            />
          )) || (
            <section key="analytics">
              <h2
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 28,
                  fontWeight: 700,
                  color: theme.crimson,
                  letterSpacing: "-0.5px",
                }}
              >
                Performance Analytics
              </h2>
              {attempts.length > 0 ? (
                <PerformanceAnalytics
                  attempts={attempts}
                  darkMode={darkMode}
                  theme={theme}
                />
              ) : (
                <div
                  style={{
                    padding: 48,
                    textAlign: "center",
                    background: theme.cardBg,
                    backdropFilter: theme.glassBlur,
                    WebkitBackdropFilter: theme.glassBlur,
                    borderRadius: 12,
                    border: `2px dashed ${theme.glassBorder}`,
                    boxShadow: theme.glassShadow,
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 8px 0",
                      color: theme.textSecondary,
                      fontSize: 18,
                    }}
                  >
                    No analytics yet
                  </h3>
                  <p
                    style={{
                      margin: "0",
                      color: theme.textSecondary,
                      fontSize: 14,
                    }}
                  >
                    Take an exam to see your performance analytics here.
                  </p>
                </div>
              )}
            </section>
          )
        );
      case "in_progress":
        return (
          <section key="in_progress">
            <h2
              style={{
                margin: "0 0 16px 0",
                fontSize: 28,
                fontWeight: 700,
                color: theme.crimson,
                letterSpacing: "-0.5px",
              }}
            >
              Exams in Progress
            </h2>
            {!loaded ? (
              <div
                style={{
                  padding: 48,
                  background: theme.cardBg,
                  borderRadius: 12,
                  border: "1px solid " + theme.glassBorder,
                  boxShadow: theme.glassShadow,
                  color: theme.textSecondary,
                  textAlign: "center",
                }}
              >
                Loading in-progress exams...
              </div>
            ) : (
              <ExamsInProgressWidget
                attempts={inProgressAttempts}
                onDelete={handleDeleteInProgress}
                darkMode={darkMode}
                theme={theme}
              />
            )}
          </section>
        );
      case "history":
        return (
          <section key="history">
            <h2
              style={{
                margin: "0 0 16px 0",
                fontSize: 28,
                fontWeight: 700,
                color: theme.crimson,
                letterSpacing: "-0.5px",
              }}
            >
              Recent Exam History
            </h2>
            {!loaded ? (
              <div
                style={{
                  padding: 48,
                  background: theme.cardBg,
                  borderRadius: 12,
                  border: "1px solid " + theme.glassBorder,
                  boxShadow: theme.glassShadow,
                  color: theme.textSecondary,
                  textAlign: "center",
                }}
              >
                Loading recent history...
              </div>
            ) : attempts.length > 0 ? (
              <ExamHistory
                attempts={attempts}
                onReviewAttempt={handleReviewAttempt}
                onDeleteAttempt={handleDeleteAttempt}
                onBulkDeleteAttempts={handleBulkDeleteAttempts}
                darkMode={darkMode}
                theme={theme}
              />
            ) : (
              <div
                style={{
                  padding: 48,
                  textAlign: "center",
                  background: theme.cardBg,
                  backdropFilter: theme.glassBlur,
                  WebkitBackdropFilter: theme.glassBlur,
                  borderRadius: 12,
                  border: `2px dashed ${theme.glassBorder}`,
                  boxShadow: theme.glassShadow,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    color: theme.textSecondary,
                    fontSize: 18,
                  }}
                >
                  No exams taken yet
                </h3>
                <p
                  style={{
                    margin: "0",
                    color: theme.textSecondary,
                    fontSize: 14,
                  }}
                >
                  Generate an exam and take it to see your history here.
                </p>
              </div>
            )}
          </section>
        );
      case "library":
        return (
          <section key="library">
            <h2
              style={{
                margin: "0 0 16px 0",
                fontSize: 28,
                fontWeight: 700,
                color: theme.crimson,
                letterSpacing: "-0.5px",
              }}
            >
              CSV Library
            </h2>
            {!loaded ? (
              <div
                style={{
                  padding: 48,
                  background: theme.cardBg,
                  borderRadius: 12,
                  border: "1px solid " + theme.glassBorder,
                  boxShadow: theme.glassShadow,
                  color: theme.textSecondary,
                  textAlign: "center",
                }}
              >
                Loading CSV library...
              </div>
            ) : (
              <CSVLibrary
                uploads={uploads}
                onCreateExam={handleCreateExam}
                onDelete={handleDeleteUpload}
                onDownload={handleDownloadCSV}
                onUpdate={loadDashboardData}
                onArchive={handleArchiveUpload}
                darkMode={darkMode}
                theme={theme}
              />
            )}
          </section>
        );
      default:
        return null;
    }
  };

  // Note: do not block the entire page during loading; show section skeletons below

  if (error) {
    return (
      <div
        style={{
          padding: 32,
          background: theme.cardBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          borderRadius: 12,
          boxShadow: theme.glassShadow,
          border: `1px solid ${theme.crimson}`,
        }}
      >
        <div
          style={{
            color: theme.crimson,
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          Error: {error}
        </div>
        <button
          onClick={loadDashboardData}
          onMouseEnter={() => setHoveredButton("retry")}
          onMouseLeave={() => setHoveredButton(null)}
          style={{
            padding: "10px 24px",
            background:
              hoveredButton === "retry" ? theme.crimsonDark : theme.crimson,
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            transition: "all 0.3s ease",
            boxShadow:
              hoveredButton === "retry"
                ? "0 6px 20px rgba(196, 30, 58, 0.4)"
                : "0 3px 12px rgba(196, 30, 58, 0.3)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Get visible sections in order
  const visibleSections = layoutSections
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      <div style={{ display: "grid", gap: 24 }}>
        {/* Layout Settings Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: -8,
          }}
        >
          <button
            onClick={() => setShowLayoutSettings(true)}
            onMouseEnter={() => setHoveredButton("layout")}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              padding: "8px 16px",
              background:
                hoveredButton === "layout"
                  ? darkMode
                    ? "rgba(194, 155, 74, 0.15)"
                    : "rgba(196, 30, 58, 0.1)"
                  : "transparent",
              color: theme.crimson,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Customize Layout
          </button>
        </div>

        {/* Render sections dynamically */}
        {visibleSections.map((section) => renderSection(section.id))}
      </div>

      {/* Layout Settings Modal */}
      {showLayoutSettings && (
        <DashboardLayoutSettings
          sections={layoutSections}
          onSave={handleSaveLayout}
          onClose={() => setShowLayoutSettings(false)}
          darkMode={darkMode}
          theme={theme}
        />
      )}

      {/* Restore Data Prompt */}
      {showRestorePrompt && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200,
          }}
          onClick={() => {
            localStorage.setItem("restore_prompt_shown", "true");
            setShowRestorePrompt(false);
          }}
        >
          <div
            style={{
              background: theme.modalBg,
              borderRadius: 12,
              padding: 24,
              width: "90%",
              maxWidth: 480,
              border: `1px solid ${theme.glassBorder}`,
              boxShadow: theme.glassShadowHover,
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: 20,
                fontWeight: 700,
                color: theme.text,
              }}
            >
              Restore your previous data?
            </h3>
            <p style={{ margin: "0 0 16px 0", color: theme.textSecondary }}>
              If you want to restore a backup, you can do so in Utilities at the bottom of the app.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  localStorage.setItem("restore_prompt_shown", "true");
                  setShowRestorePrompt(false);
                }}
                style={{
                  padding: "10px 16px",
                  background: "transparent",
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 8,
                  color: theme.text,
                  cursor: "pointer",
                }}
              >
                Not now
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("restore_prompt_shown", "true");
                  setShowRestorePrompt(false);
                  navigate("/utilities");
                }}
                style={{
                  padding: "10px 16px",
                  background: theme.crimson,
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Go to Utilities
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
