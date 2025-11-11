import React, { useState } from "react";
import type { AttemptSummary } from "../types";

interface ExamHistoryProps {
  attempts: AttemptSummary[];
  onReviewAttempt: (attemptId: number) => void;
  onDeleteAttempt: (attemptId: number) => void;
  darkMode: boolean;
  theme: any;
}

export default function ExamHistory({
  attempts,
  onReviewAttempt,
  onDeleteAttempt,
  darkMode,
  theme,
}: ExamHistoryProps) {
  const [sortBy, setSortBy] = useState<
    "date" | "score" | "source" | "duration" | "accuracy" | "difficulty"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Column widths state (in pixels)
  const [columnWidths, setColumnWidths] = useState({
    date: 180,
    score: 100,
    source: 180,
    questions: 110,
    duration: 110,
    difficulty: 110,
    avgTime: 110,
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
    column: "date" | "score" | "source" | "duration" | "accuracy" | "difficulty"
  ) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (
    column: "date" | "score" | "source" | "duration" | "accuracy" | "difficulty"
  ) => {
    if (sortBy !== column) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

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
            Total Exams
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

      {/* Attempts Table - Glassmorphism */}
      <div
        ref={tableRef}
        style={{
          border: `1px solid ${theme.glassBorder}`,
          borderRadius: 12,
          overflow: "hidden",
          background: theme.cardBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          boxShadow: theme.glassShadow,
        }}
      >
        {/* Fixed Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${columnWidths.date}px ${columnWidths.score}px ${columnWidths.source}px ${columnWidths.questions}px ${columnWidths.duration}px ${columnWidths.difficulty}px ${columnWidths.avgTime}px auto`,
            background: theme.navBg,
            padding: "16px 16px 16px 16px",
            fontWeight: 700,
            fontSize: 14,
            borderBottom: `1px solid ${theme.glassBorder}`,
            color: theme.crimson,
            position: "relative",
          }}
        >
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
                top: -16,
                bottom: -16,
                width: 8,
                cursor: "col-resize",
                userSelect: "none",
                zIndex: 10,
                borderRight:
                  resizing === "date"
                    ? `2px solid ${theme.crimson}`
                    : `1px solid ${theme.glassBorder}`,
                transition: "border-color 0.2s ease",
              }}
              title="Drag to resize"
            />
          </div>
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
                top: -16,
                bottom: -16,
                width: 8,
                cursor: "col-resize",
                userSelect: "none",
                zIndex: 10,
                borderRight:
                  resizing === "score"
                    ? `2px solid ${theme.crimson}`
                    : `1px solid ${theme.glassBorder}`,
                transition: "border-color 0.2s ease",
              }}
              title="Drag to resize"
            />
          </div>
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
                top: -16,
                bottom: -16,
                width: 8,
                cursor: "col-resize",
                userSelect: "none",
                zIndex: 10,
                borderRight:
                  resizing === "source"
                    ? `2px solid ${theme.crimson}`
                    : `1px solid ${theme.glassBorder}`,
                transition: "border-color 0.2s ease",
              }}
              title="Drag to resize"
            />
          </div>
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
                top: -16,
                bottom: -16,
                width: 8,
                cursor: "col-resize",
                userSelect: "none",
                zIndex: 10,
                borderRight:
                  resizing === "questions"
                    ? `2px solid ${theme.crimson}`
                    : `1px solid ${theme.glassBorder}`,
                transition: "border-color 0.2s ease",
              }}
              title="Drag to resize"
            />
          </div>
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
                top: -16,
                bottom: -16,
                width: 8,
                cursor: "col-resize",
                userSelect: "none",
                zIndex: 10,
                borderRight:
                  resizing === "duration"
                    ? `2px solid ${theme.crimson}`
                    : `1px solid ${theme.glassBorder}`,
                transition: "border-color 0.2s ease",
              }}
              title="Drag to resize"
            />
          </div>
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
                top: -16,
                bottom: -16,
                width: 8,
                cursor: "col-resize",
                userSelect: "none",
                zIndex: 10,
                borderRight:
                  resizing === "difficulty"
                    ? `2px solid ${theme.crimson}`
                    : `1px solid ${theme.glassBorder}`,
                transition: "border-color 0.2s ease",
              }}
              title="Drag to resize"
            />
          </div>
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
                top: -16,
                bottom: -16,
                width: 8,
                cursor: "col-resize",
                userSelect: "none",
                zIndex: 10,
                borderRight:
                  resizing === "avgTime"
                    ? `2px solid ${theme.crimson}`
                    : `1px solid ${theme.glassBorder}`,
                transition: "border-color 0.2s ease",
              }}
              title="Drag to resize"
            />
          </div>
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
                gridTemplateColumns: `${columnWidths.date}px ${columnWidths.score}px ${columnWidths.source}px ${columnWidths.questions}px ${columnWidths.duration}px ${columnWidths.difficulty}px ${columnWidths.avgTime}px auto`,
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
                  width="16"
                  height="16"
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
