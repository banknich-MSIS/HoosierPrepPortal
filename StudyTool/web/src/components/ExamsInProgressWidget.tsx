import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AttemptSummary } from "../types";

interface ExamsInProgressWidgetProps {
  attempts: AttemptSummary[];
  onDelete: (attemptId: number) => void;
  darkMode: boolean;
  theme: any;
}

export default function ExamsInProgressWidget({
  attempts,
  onDelete,
  darkMode,
  theme,
}: ExamsInProgressWidgetProps) {
  const navigate = useNavigate();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleResume = (attempt: AttemptSummary) => {
    if (attempt.exam_type === "practice") {
      navigate(`/practice/${attempt.exam_id}`, { state: { autoResume: true } });
    } else {
      navigate(`/exam/${attempt.exam_id}`, { state: { autoResume: true } });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, attemptId: number) => {
    e.stopPropagation();
    setDeleteConfirmId(attemptId);
  };

  const confirmDelete = (e: React.MouseEvent, attemptId: number) => {
    e.stopPropagation();
    onDelete(attemptId);
    setDeleteConfirmId(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const formatDate = (dateString: string) => {
    // Ensure UTC parsing if 'Z' is missing
    const dateStr = dateString.endsWith("Z") ? dateString : dateString + "Z";
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(date);
  };

  // Get difficulty color
  const getDifficultyColor = (diff?: string | null) => {
    const d = (diff || "medium").toLowerCase();
    if (d === "easy") return theme.btnSuccess;
    if (d === "hard") return theme.btnDanger;
    return theme.btnWarning; // medium/default
  };

  if (attempts.length === 0) {
    return (
      <div
        style={{
          padding: 32,
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
          No exams in progress
        </h3>
        <p
          style={{
            margin: "0 0 16px 0",
            color: theme.textSecondary,
            fontSize: 14,
          }}
        >
          Start an exam or practice session to save your progress automatically.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16,
      }}
    >
      {attempts.map((attempt) => (
        <div
          key={attempt.id}
          style={{
            position: "relative",
            background: theme.cardBg,
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            borderRadius: 12,
            border: `1px solid ${
              hoveredRow === attempt.id ? theme.border : theme.glassBorder
            }`,
            padding: 16,
            transition: "all 0.2s ease",
            boxShadow:
              hoveredRow === attempt.id
                ? theme.glassShadowHover
                : theme.glassShadow,
            cursor: "pointer",
          }}
          onMouseEnter={() => setHoveredRow(attempt.id)}
          onMouseLeave={() => setHoveredRow(null)}
          onClick={() => handleResume(attempt)}
        >
          {/* Header: Type and Difficulty */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 4,
                  background:
                    attempt.exam_type === "practice"
                      ? darkMode
                        ? "rgba(23, 162, 184, 0.2)"
                        : "rgba(23, 162, 184, 0.1)"
                      : darkMode
                      ? "rgba(196, 30, 58, 0.2)"
                      : "rgba(196, 30, 58, 0.1)",
                  color:
                    attempt.exam_type === "practice"
                      ? theme.btnInfo
                      : theme.crimson,
                  border: `1px solid ${
                    attempt.exam_type === "practice"
                      ? theme.btnInfo
                      : theme.crimson
                  }40`,
                }}
              >
                {attempt.exam_type === "practice" ? "Practice" : "Exam"}
              </span>
              {attempt.difficulty && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: `${getDifficultyColor(attempt.difficulty)}15`,
                    color: getDifficultyColor(attempt.difficulty),
                    border: `1px solid ${getDifficultyColor(
                      attempt.difficulty
                    )}40`,
                  }}
                >
                  {attempt.difficulty}
                </span>
              )}
            </div>

            {/* Delete Button (or Confirm UI) */}
            <div onClick={(e) => e.stopPropagation()}>
              {deleteConfirmId === attempt.id ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: theme.textSecondary }}>
                    Confirm?
                  </span>
                  <button
                    onClick={(e) => confirmDelete(e, attempt.id)}
                    style={{
                      padding: "2px 6px",
                      background: theme.btnDanger,
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={cancelDelete}
                    style={{
                      padding: "2px 6px",
                      background: theme.glassBorder,
                      color: theme.text,
                      border: "none",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => handleDeleteClick(e, attempt.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: theme.textSecondary,
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 4,
                    opacity: hoveredRow === attempt.id ? 1 : 0.5,
                    transition: "all 0.2s",
                  }}
                  title="Discard attempt"
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
              )}
            </div>
          </div>

          {/* Title */}
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: 16,
              fontWeight: 600,
              color: theme.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={attempt.upload_filename}
          >
            {attempt.upload_filename}
          </h3>

          {/* Class Tag */}
          {attempt.class_tags && attempt.class_tags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 12,
                  color: theme.textSecondary,
                  background: theme.glassBorder,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {attempt.class_tags[0]}
              </span>
            </div>
          )}

          {/* Progress Bar */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: theme.textSecondary,
                marginBottom: 4,
              }}
            >
              <span>Progress</span>
              <span>
                {attempt.correct_count} / {attempt.question_count}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 6,
                background: darkMode ? theme.glassBorder : "rgba(0, 0, 0, 0.1)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (attempt.correct_count / attempt.question_count) * 100
                  )}%`,
                  height: "100%",
                  background:
                    attempt.exam_type === "practice"
                      ? theme.btnInfo
                      : theme.crimson,
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>

          {/* Footer: Last updated & Resume action */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "auto",
              fontSize: 12,
            }}
          >
            <span style={{ color: theme.textSecondary }}>
              Last saved: {formatDate(attempt.finished_at)}
            </span>
            <span
              style={{
                color:
                  attempt.exam_type === "practice"
                    ? theme.btnInfo
                    : theme.crimson,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Resume
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
