import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import CSVLibrary from "../components/CSVLibrary";
import ExamHistory from "../components/ExamHistory";
import PerformanceAnalytics from "../components/PerformanceAnalytics";
import DashboardLayoutSettings, {
  DashboardSection,
} from "../components/DashboardLayoutSettings";
import {
  fetchAllUploads,
  fetchRecentAttempts,
  deleteUpload,
  downloadCSV,
  deleteAttempt,
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
          id: "history",
          title: "Recent Exam History",
          visible: true,
          order: 1,
        },
        { id: "library", title: "CSV Library", visible: true, order: 2 },
      ];
    }
  );

  useEffect(() => {
    loadDashboardData();
  }, []);

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
      const [uploadsData, attemptsData] = await Promise.all([
        fetchAllUploads(),
        fetchRecentAttempts(10),
      ]);
      setUploads(uploadsData);
      setAttempts(attemptsData);
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

  const handleUploadNew = () => {
    navigate("/upload");
  };

  const handleViewAllHistory = () => {
    navigate("/history");
  };

  const handleShowTutorial = () => {
    window.dispatchEvent(new CustomEvent("showTutorial"));
  };

  const handlePreviewLayout = (sections: DashboardSection[]) => {
    // Update state immediately for preview (don't persist yet)
    setLayoutSections(sections);
  };

  const handleSaveLayout = (sections: DashboardSection[]) => {
    // Persist to localStorage only when Save is clicked
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
          )) ||
          (attempts.length > 0 && (
            <PerformanceAnalytics
              key="analytics"
              attempts={attempts}
              darkMode={darkMode}
              theme={theme}
            />
          ))
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
                  Upload a CSV and take your first exam to see your history
                  here.
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
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3"></path>
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
          onChange={handlePreviewLayout}
          onClose={() => setShowLayoutSettings(false)}
          darkMode={darkMode}
          theme={theme}
        />
      )}
    </>
  );
}
