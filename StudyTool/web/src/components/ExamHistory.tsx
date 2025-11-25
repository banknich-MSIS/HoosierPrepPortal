import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import type { AttemptSummary } from "../types";

interface ExamHistoryProps {
  attempts: AttemptSummary[];
  onReviewAttempt: (attemptId: number) => void;
  onDeleteAttempt: (attemptId: number) => void;
  onBulkDeleteAttempts?: (attemptIds: number[]) => Promise<void>;
  darkMode: boolean;
  theme: any;
}

export default function ExamHistory({
  attempts,
  onReviewAttempt,
  onDeleteAttempt,
  onBulkDeleteAttempts,
  darkMode,
  theme,
}: ExamHistoryProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [sortBy, setSortBy] = useState<
    | "date"
    | "score"
    | "source"
    | "duration"
    | "accuracy"
    | "difficulty"
    | "examType"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [selectedAttempts, setSelectedAttempts] = useState<Set<number>>(
    new Set()
  );

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    score: true,
    source: true,
    questions: true,
    duration: true,
    difficulty: true,
    examType: true,
    avgTime: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Column widths state (in pixels) - optimized to prevent horizontal scroll
  const [columnWidths, setColumnWidths] = useState({
    date: 140,
    score: 80,
    source: 160,
    questions: 90,
    duration: 90,
    difficulty: 90,
    examType: 80,
    avgTime: 90,
  });
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [hoverResize, setHoverResize] = useState<string | null>(null);
  const tableRef = React.useRef<HTMLDivElement>(null);

  const handleResizeStart = (
    e: React.MouseEvent,
    column: keyof typeof columnWidths
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column]);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizing || !tableRef.current) return;
    const diff = e.clientX - startX;
    const newWidth = Math.max(80, startWidth + diff); // Minimum width of 80px

    // Calculate total width including the delete button column (estimate ~50px)
    const otherColumnsWidth = Object.entries(columnWidths)
      .filter(([key]) => key !== resizing)
      .reduce((sum, [, width]) => sum + width, 0);

    // Get actual container width
    const containerWidth = tableRef.current.offsetWidth;
    const maxAvailableWidth = containerWidth - otherColumnsWidth - 50 - 80; // 50px for delete button, 80px for column padding (20px per column)

    // Constrain the new width
    const constrainedWidth = Math.min(
      newWidth,
      Math.max(80, maxAvailableWidth)
    );

    setColumnWidths((prev) => ({
      ...prev,
      [resizing]: constrainedWidth,
    }));
  };

  const handleResizeEnd = () => {
    setResizing(null);
  };

  React.useEffect(() => {
    if (resizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [resizing, startX, startWidth]);

  const formatDate = (date: string) => {
    // Ensure UTC parsing if 'Z' is missing
    const dateStr = date.endsWith("Z") ? date : date + "Z";
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatAvgTime = (avgTimePerQuestion: number | null | undefined) => {
    if (!avgTimePerQuestion) return null;
    return `${Math.round(avgTimePerQuestion)}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#28a745"; // Green
    if (score >= 60) return "#ffc107"; // Yellow
    return "#dc3545"; // Red
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return "#d4edda";
    if (score >= 60) return "#fff3cd";
    return "#f8d7da";
  };

  const sortedAttempts = [...attempts].sort((a, b) => {
    let aVal: any, bVal: any;

    switch (sortBy) {
      case "date":
        const aDate = a.finished_at.endsWith("Z")
          ? a.finished_at
          : a.finished_at + "Z";
        const bDate = b.finished_at.endsWith("Z")
          ? b.finished_at
          : b.finished_at + "Z";
        aVal = new Date(aDate).getTime();
        bVal = new Date(bDate).getTime();
        break;
      case "score":
        aVal = a.score_pct;
        bVal = b.score_pct;
        break;
      case "source":
        aVal = a.upload_filename.toLowerCase();
        bVal = b.upload_filename.toLowerCase();
        break;
      case "duration":
        aVal = a.duration_seconds || 0;
        bVal = b.duration_seconds || 0;
        break;
      case "accuracy":
        aVal = (a.correct_count / a.question_count) * 100;
        bVal = (b.correct_count / b.question_count) * 100;
        break;
      case "difficulty":
        const difficultyOrder = { Easy: 1, Medium: 2, Hard: 3 };
        aVal =
          difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 2;
        bVal =
          difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 2;
        break;
      case "examType":
        aVal = a.exam_type || "exam";
        bVal = b.exam_type || "exam";
        break;
      default:
        return 0;
    }

    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const handleSort = (
    column:
      | "date"
      | "score"
      | "source"
      | "duration"
      | "accuracy"
      | "difficulty"
      | "examType"
  ) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (
    column:
      | "date"
      | "score"
      | "source"
      | "duration"
      | "accuracy"
      | "difficulty"
      | "examType"
  ) => {
    if (sortBy !== column) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  const formatColumnName = (key: string): string => {
    const names: Record<string, string> = {
      date: "Date",
      score: "Score",
      source: "Source",
      questions: "Questions",
      duration: "Duration",
      difficulty: "Difficulty",
      examType: "Type",
      avgTime: "Avg Time/Q",
    };
    return names[key] || key;
  };

  const buildGridTemplate = () => {
    const cols = ["50px"]; // Checkbox column always visible
    if (visibleColumns.date) cols.push(`${columnWidths.date}px`);
    if (visibleColumns.score) cols.push(`${columnWidths.score}px`);
    if (visibleColumns.source) cols.push(`${columnWidths.source}px`);
    if (visibleColumns.questions) cols.push(`${columnWidths.questions}px`);
    if (visibleColumns.duration) cols.push(`${columnWidths.duration}px`);
    if (visibleColumns.difficulty) cols.push(`${columnWidths.difficulty}px`);
    if (visibleColumns.examType) cols.push(`${columnWidths.examType}px`);
    if (visibleColumns.avgTime) cols.push(`${columnWidths.avgTime}px`);
    cols.push("auto"); // Delete button column
    return cols.join(" ");
  };

  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        `Delete ${selectedAttempts.size} selected exam(s)? This cannot be undone.`
      )
    )
      return;

    try {
      const idsToDelete = Array.from(selectedAttempts);

      // Use bulk delete handler if provided, otherwise delete individually
      if (onBulkDeleteAttempts) {
        await onBulkDeleteAttempts(idsToDelete);
      } else {
        // Delete all selected attempts in parallel
        await Promise.all(idsToDelete.map((id) => onDeleteAttempt(id)));
      }

      // Clear selection after successful deletion
      setSelectedAttempts(new Set());
    } catch (error) {
      showToast("Failed to delete some exams. Please try again.", "error");
    }
  };

  // Close column menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showColumnMenu) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showColumnMenu]);

  // Calculate summary stats
  const totalAttempts = attempts.length;
  const averageScore =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((sum, a) => sum + a.score_pct, 0) / attempts.length
        )
      : 0;
  const bestScore =
    attempts.length > 0 ? Math.max(...attempts.map((a) => a.score_pct)) : 0;
  const recentImprovement =
    attempts.length >= 2 ? attempts[0].score_pct - attempts[1].score_pct : 0;

  return (
    <div>
      {/* Summary Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: 20,
            background: theme.cardBg,
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            borderRadius: 12,
            textAlign: "center",
            border: `1px solid ${theme.glassBorder}`,
            boxShadow: theme.glassShadow,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: theme.crimson,
            }}
          >
            {totalAttempts}
          </div>
          <div
            style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}
          >
            Recent Exams
          </div>
        </div>
        <div
          style={{
            padding: 20,
            background: theme.cardBg,
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            borderRadius: 12,
            textAlign: "center",
            border: `1px solid ${theme.glassBorder}`,
            boxShadow: theme.glassShadow,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: theme.btnSuccess,
            }}
          >
            {averageScore}%
          </div>
          <div
            style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}
          >
            Average Score
          </div>
        </div>
        <div
          style={{
            padding: 20,
            background: theme.cardBg,
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            borderRadius: 12,
            textAlign: "center",
            border: `1px solid ${theme.glassBorder}`,
            boxShadow: theme.glassShadow,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: theme.amber,
            }}
          >
            {Math.round(bestScore)}%
          </div>
          <div
            style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}
          >
            Best Score
          </div>
        </div>
        {recentImprovement !== 0 && (
          <div
            style={{
              padding: 20,
              background: theme.cardBg,
              backdropFilter: theme.glassBlur,
              WebkitBackdropFilter: theme.glassBlur,
              borderRadius: 12,
              textAlign: "center",
              border: `1px solid ${
                recentImprovement > 0 ? theme.btnSuccess : theme.btnDanger
              }`,
              boxShadow: theme.glassShadow,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color:
                  recentImprovement > 0 ? theme.btnSuccess : theme.btnDanger,
              }}
            >
              {recentImprovement > 0 ? "+" : ""}
              {Math.round(recentImprovement)}%
            </div>
            <div
              style={{
                fontSize: 14,
                color: theme.textSecondary,
                marginTop: 4,
              }}
            >
              Recent Change
            </div>
          </div>
        )}
      </div>

      {/* Column Selector Menu */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => navigate("/history")}
          style={{
            background: "transparent",
            border: "none",
            color: theme.crimson,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = theme.navHover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          View all exams
        </button>

        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowColumnMenu(!showColumnMenu);
            }}
            style={{
              padding: "6px 8px",
              background: "transparent",
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Column visibility"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={theme.text}>
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {showColumnMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                right: 0,
                top: 40,
                background: darkMode ? "#3d2325" : "#ffffff",
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 8,
                padding: 12,
                boxShadow: theme.glassShadow,
                zIndex: 10,
                minWidth: 200,
              }}
            >
              {Object.entries(visibleColumns).map(([key, visible]) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "6px 0",
                    cursor: "pointer",
                    color: theme.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() =>
                      setVisibleColumns({
                        ...visibleColumns,
                        [key]: !visible,
                      })
                    }
                    style={{ cursor: "pointer" }}
                  />
                  <span>{formatColumnName(key)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedAttempts.size > 0 && (
        <div
          style={{
            padding: 12,
            background: theme.cardBg,
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            borderRadius: 8,
            border: `1px solid ${theme.glassBorder}`,
            boxShadow: theme.glassShadow,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: theme.text,
              fontWeight: 500,
            }}
          >
            {selectedAttempts.size} exam(s) selected
          </span>
          <button
            onClick={handleBulkDelete}
            onMouseEnter={() => setHoveredButton("bulkDelete")}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              padding: "8px 16px",
              background:
                hoveredButton === "bulkDelete" ? "#b91c1c" : "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
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
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            Delete Selected
          </button>
        </div>
      )}

      {/* Attempts Table - Glassmorphism */}
      <div
        ref={tableRef}
        style={{
          border: `1px solid ${theme.glassBorder}`,
          borderRadius: 12,
          background: theme.cardBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          boxShadow: theme.glassShadow,
          maxWidth: "100%",
          overflow: "auto",
        }}
      >
        {/* Fixed Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: buildGridTemplate(),
            background: theme.navBg,
            padding: "16px 16px 16px 16px",
            fontWeight: 700,
            fontSize: 14,
            borderBottom: `1px solid ${theme.glassBorder}`,
            color: theme.crimson,
            position: "relative",
          }}
        >
          {/* Master Checkbox */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: 8,
            }}
          >
            <input
              type="checkbox"
              checked={
                sortedAttempts.length > 0 &&
                sortedAttempts.every((a) => selectedAttempts.has(a.id))
              }
              onChange={() => {
                if (
                  sortedAttempts.length > 0 &&
                  sortedAttempts.every((a) => selectedAttempts.has(a.id))
                ) {
                  setSelectedAttempts(new Set());
                } else {
                  setSelectedAttempts(new Set(sortedAttempts.map((a) => a.id)));
                }
              }}
              style={{ cursor: "pointer", width: 16, height: 16 }}
            />
          </div>
          {visibleColumns.date && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                position: "relative",
                paddingRight: 12,
                paddingLeft: 8,
              }}
            >
              <span
                onClick={() => handleSort("date")}
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Date {getSortIcon("date")}
              </span>
              <div
                onMouseDown={(e) => handleResizeStart(e, "date")}
                onMouseEnter={() => setHoverResize("date")}
                onMouseLeave={() => setHoverResize(null)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  bottom: -8,
                  width: 8,
                  cursor: "col-resize",
                  userSelect: "none",
                  zIndex: 10,
                  borderRight:
                    resizing === "date"
                      ? `2px solid ${theme.crimson}`
                      : hoverResize === "date"
                      ? `2px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.2)"
                        }`
                      : `1px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.15)"
                        }`,
                  transition: "border-color 0.2s ease",
                }}
                title="Drag to resize"
              />
            </div>
          )}
          {visibleColumns.score && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                position: "relative",
                paddingRight: 12,
                paddingLeft: 8,
              }}
            >
              <span
                onClick={() => handleSort("score")}
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Score {getSortIcon("score")}
              </span>
              <div
                onMouseDown={(e) => handleResizeStart(e, "score")}
                onMouseEnter={() => setHoverResize("score")}
                onMouseLeave={() => setHoverResize(null)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  bottom: -8,
                  width: 8,
                  cursor: "col-resize",
                  userSelect: "none",
                  zIndex: 10,
                  borderRight:
                    resizing === "score"
                      ? `2px solid ${theme.crimson}`
                      : hoverResize === "score"
                      ? `2px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.2)"
                        }`
                      : `1px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.15)"
                        }`,
                  transition: "border-color 0.2s ease",
                }}
                title="Drag to resize"
              />
            </div>
          )}
          {visibleColumns.source && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                position: "relative",
                paddingRight: 12,
                paddingLeft: 8,
              }}
            >
              <span
                onClick={() => handleSort("source")}
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Source {getSortIcon("source")}
              </span>
              <div
                onMouseDown={(e) => handleResizeStart(e, "source")}
                onMouseEnter={() => setHoverResize("source")}
                onMouseLeave={() => setHoverResize(null)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  bottom: -8,
                  width: 8,
                  cursor: "col-resize",
                  userSelect: "none",
                  zIndex: 10,
                  borderRight:
                    resizing === "source"
                      ? `2px solid ${theme.crimson}`
                      : hoverResize === "source"
                      ? `2px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.2)"
                        }`
                      : `1px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.15)"
                        }`,
                  transition: "border-color 0.2s ease",
                }}
                title="Drag to resize"
              />
            </div>
          )}
          {visibleColumns.questions && (
            <div
              style={{
                position: "relative",
                paddingRight: 12,
                paddingLeft: 8,
              }}
            >
              Questions
              <div
                onMouseDown={(e) => handleResizeStart(e, "questions")}
                onMouseEnter={() => setHoverResize("questions")}
                onMouseLeave={() => setHoverResize(null)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  bottom: -8,
                  width: 8,
                  cursor: "col-resize",
                  userSelect: "none",
                  zIndex: 10,
                  borderRight:
                    resizing === "questions"
                      ? `2px solid ${theme.crimson}`
                      : hoverResize === "questions"
                      ? `2px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.2)"
                        }`
                      : `1px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.15)"
                        }`,
                  transition: "border-color 0.2s ease",
                }}
                title="Drag to resize"
              />
            </div>
          )}
          {visibleColumns.duration && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                position: "relative",
                paddingRight: 12,
                paddingLeft: 8,
              }}
            >
              <span
                onClick={() => handleSort("duration")}
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Duration {getSortIcon("duration")}
              </span>
              <div
                onMouseDown={(e) => handleResizeStart(e, "duration")}
                onMouseEnter={() => setHoverResize("duration")}
                onMouseLeave={() => setHoverResize(null)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  bottom: -8,
                  width: 8,
                  cursor: "col-resize",
                  userSelect: "none",
                  zIndex: 10,
                  borderRight:
                    resizing === "duration"
                      ? `2px solid ${theme.crimson}`
                      : hoverResize === "duration"
                      ? `2px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.2)"
                        }`
                      : `1px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.15)"
                        }`,
                  transition: "border-color 0.2s ease",
                }}
                title="Drag to resize"
              />
            </div>
          )}
          {visibleColumns.difficulty && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                position: "relative",
                paddingRight: 12,
                paddingLeft: 8,
              }}
            >
              <span
                onClick={() => handleSort("difficulty")}
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Difficulty {getSortIcon("difficulty")}
              </span>
              <div
                onMouseDown={(e) => handleResizeStart(e, "difficulty")}
                onMouseEnter={() => setHoverResize("difficulty")}
                onMouseLeave={() => setHoverResize(null)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  bottom: -8,
                  width: 8,
                  cursor: "col-resize",
                  userSelect: "none",
                  zIndex: 10,
                  borderRight:
                    resizing === "difficulty"
                      ? `2px solid ${theme.crimson}`
                      : hoverResize === "difficulty"
                      ? `2px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.2)"
                        }`
                      : `1px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.15)"
                        }`,
                  transition: "border-color 0.2s ease",
                }}
                title="Drag to resize"
              />
            </div>
          )}
          {visibleColumns.examType && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                position: "relative",
                paddingRight: 12,
                paddingLeft: 8,
              }}
            >
              <span
                onClick={() => handleSort("examType")}
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Type {getSortIcon("examType")}
              </span>
              <div
                onMouseDown={(e) => handleResizeStart(e, "examType")}
                onMouseEnter={() => setHoverResize("examType")}
                onMouseLeave={() => setHoverResize(null)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  bottom: -8,
                  width: 8,
                  cursor: "col-resize",
                  userSelect: "none",
                  zIndex: 10,
                  borderRight:
                    resizing === "examType"
                      ? `2px solid ${theme.crimson}`
                      : hoverResize === "examType"
                      ? `2px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.2)"
                        }`
                      : `1px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.15)"
                        }`,
                  transition: "border-color 0.2s ease",
                }}
                title="Drag to resize"
              />
            </div>
          )}
          {visibleColumns.avgTime && (
            <div
              style={{
                position: "relative",
                paddingRight: 12,
                paddingLeft: 8,
              }}
            >
              Avg Time/Q
              <div
                onMouseDown={(e) => handleResizeStart(e, "avgTime")}
                onMouseEnter={() => setHoverResize("avgTime")}
                onMouseLeave={() => setHoverResize(null)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  bottom: -8,
                  width: 8,
                  cursor: "col-resize",
                  userSelect: "none",
                  zIndex: 10,
                  borderRight:
                    resizing === "avgTime"
                      ? `2px solid ${theme.crimson}`
                      : hoverResize === "avgTime"
                      ? `2px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.2)"
                        }`
                      : `1px solid ${
                          darkMode ? theme.glassBorder : "rgba(0,0,0,0.15)"
                        }`,
                  transition: "border-color 0.2s ease",
                }}
                title="Drag to resize"
              />
            </div>
          )}
        </div>

        {/* Scrollable Body - max 6 rows visible */}
        <div
          className="exam-history-scroll"
          style={{
            maxHeight: "330px", // Force scroll at 6 entries
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {sortedAttempts.map((attempt) => (
            <div
              key={attempt.id}
              onClick={() => onReviewAttempt(attempt.id)}
              style={{
                display: "grid",
                gridTemplateColumns: buildGridTemplate(),
                padding: "12px 16px",
                borderBottom: `1px solid ${theme.border}`,
                backgroundColor: darkMode
                  ? theme.cardBg
                  : "rgba(38, 38, 38, 0.04)",
                transition: "background-color 0.2s ease",
                alignItems: "center",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.navHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = darkMode
                  ? theme.cardBg
                  : "rgba(38, 38, 38, 0.04)";
              }}
            >
              {/* Row Checkbox */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingLeft: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedAttempts.has(attempt.id)}
                  onChange={() => {
                    const newSelected = new Set(selectedAttempts);
                    if (newSelected.has(attempt.id)) {
                      newSelected.delete(attempt.id);
                    } else {
                      newSelected.add(attempt.id);
                    }
                    setSelectedAttempts(newSelected);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: "pointer", width: 16, height: 16 }}
                />
              </div>
              {visibleColumns.date && (
                <div
                  style={{
                    fontSize: 14,
                    color: theme.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 12,
                    paddingLeft: 8,
                  }}
                >
                  {formatDate(attempt.finished_at)}
                </div>
              )}
              {visibleColumns.score && (
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: "bold",
                    color: getScoreColor(attempt.score_pct),
                    backgroundColor: getScoreBackground(attempt.score_pct),
                    padding: "4px 8px",
                    borderRadius: 4,
                    textAlign: "center",
                    display: "inline-block",
                    width: "fit-content",
                    marginLeft: 8,
                  }}
                >
                  {Math.round(attempt.score_pct)}%
                </div>
              )}
              {visibleColumns.source && (
                <div
                  style={{
                    fontSize: 14,
                    color: theme.textSecondary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 12,
                    paddingLeft: 8,
                  }}
                  title={attempt.upload_filename}
                >
                  {attempt.upload_filename}
                </div>
              )}
              {visibleColumns.questions && (
                <div
                  style={{
                    fontSize: 14,
                    color: theme.textSecondary,
                    paddingRight: 12,
                    paddingLeft: 8,
                  }}
                >
                  {attempt.correct_count}/{attempt.question_count}
                </div>
              )}
              {visibleColumns.duration && (
                <div
                  style={{
                    fontSize: 14,
                    color: theme.textSecondary,
                    paddingRight: 12,
                    paddingLeft: 8,
                  }}
                >
                  {formatDuration(attempt.duration_seconds) || "—"}
                </div>
              )}
              {visibleColumns.difficulty && (
                <div
                  style={{
                    fontSize: 14,
                    color: theme.text,
                    paddingRight: 12,
                    paddingLeft: 8,
                    fontWeight: 500,
                  }}
                >
                  {attempt.difficulty || "Medium"}
                </div>
              )}
              {visibleColumns.examType && (
                <div
                  style={{
                    fontSize: 14,
                    color: theme.text,
                    paddingRight: 12,
                    paddingLeft: 8,
                    fontWeight: 500,
                  }}
                >
                  {attempt.exam_type === "practice" ? "Practice" : "Exam"}
                </div>
              )}
              {visibleColumns.avgTime && (
                <div
                  style={{
                    fontSize: 14,
                    color: theme.textSecondary,
                    paddingRight: 12,
                    paddingLeft: 8,
                  }}
                >
                  {formatAvgTime(attempt.average_time_per_question) || "—"}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      "Are you sure you want to delete this exam attempt?"
                    )
                  ) {
                    onDeleteAttempt(attempt.id);
                  }
                }}
                onMouseEnter={() => setHoveredButton(`delete-${attempt.id}`)}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  padding: "6px 8px",
                  background: "transparent",
                  color: theme.textSecondary,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: hoveredButton === `delete-${attempt.id}` ? 1 : 0.7,
                  justifySelf: "end",
                }}
                title="Delete attempt"
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
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {attempts.length === 0 && (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: theme.textSecondary,
          }}
        >
          No exam attempts yet. Take your first exam to see your history here.
        </div>
      )}
    </div>
  );
}
