import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { fetchAllAttempts, deleteAttempt, fetchClasses } from "../api/client";
import type { AttemptSummary } from "../types";

export default function HistoryPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  // Access theme from context
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();

  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [classColors, setClassColors] = useState<Record<string, string>>({});
  const [selectedAttempts, setSelectedAttempts] = useState<Set<number>>(
    new Set()
  );
  const [sortBy, setSortBy] = useState<
    | "date"
    | "score"
    | "duration"
    | "exam_type"
    | "questions"
    | "average_time"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    loadHistory();
    loadClassColors();
  }, []);

  const loadClassColors = async () => {
    try {
      const classes = await fetchClasses();
      const colorMap: Record<string, string> = {};
      classes.forEach((c) => {
        if (c.color) {
          colorMap[c.name] = c.color;
        }
      });
      setClassColors(colorMap);
    } catch (error) {
      console.error("Failed to load class colors:", error);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchAllAttempts();
      setAttempts(data);
    } catch (error) {
      console.error("Failed to load history:", error);
      showToast("Failed to load exam history", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedAttempts.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedAttempts.size} attempt(s)?`
      )
    ) {
      return;
    }

    try {
      // Delete all selected attempts
      await Promise.all(
        Array.from(selectedAttempts).map((id) => deleteAttempt(id))
      );

      // Refresh list
      await loadHistory();

      // Clear selection after successful deletion
      setSelectedAttempts(new Set());
      showToast("Attempts deleted successfully", "success");
    } catch (error) {
      console.error("Failed to delete attempts:", error);
      showToast("Failed to delete some exams. Please try again.", "error");
    }
  };

  const handleSort = (
    key:
      | "date"
      | "score"
      | "duration"
      | "exam_type"
      | "questions"
      | "average_time"
  ) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  };

  const getSortedAttempts = () => {
    const sorted = [...attempts].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortBy) {
        case "date":
          valA = new Date(a.finished_at).getTime();
          valB = new Date(b.finished_at).getTime();
          break;
        case "score":
          valA = a.score_pct;
          valB = b.score_pct;
          break;
        case "duration":
          valA = a.duration_seconds || 0;
          valB = b.duration_seconds || 0;
          break;
        case "exam_type":
          valA = a.exam_type;
          valB = b.exam_type;
          break;
        case "questions":
          valA = a.question_count;
          valB = b.question_count;
          break;
        case "average_time":
          valA = a.average_time_per_question || 0;
          valB = b.average_time_per_question || 0;
          break;
      }

      if (sortOrder === "desc") {
        return valA < valB ? 1 : -1;
      } else {
        return valA > valB ? 1 : -1;
      }
    });
    return sorted;
  };

  const sortedAttempts = getSortedAttempts();
  const paginatedAttempts = sortedAttempts.slice(0, page * pageSize);
  const hasMore = paginatedAttempts.length < sortedAttempts.length;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#28a745"; // Green
    if (score >= 60) return "#ffc107"; // Yellow
    return "#dc3545"; // Red
  };

  // Get class color helper
  const getClassColor = (className: string) => {
    return classColors[className] || "#007bff";
  };

  const getContrastTextColor = (hexColor: string) => {
    // Simple logic for black/white text based on background brightness
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "transparent",
              border: `1px solid ${theme.glassBorder || "#ddd"}`,
              color: theme.text || "#333",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 500,
              fontSize: 14,
            }}
          >
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: 24, color: theme.text || "#333" }}>
            Exam History
          </h1>
        </div>

        {selectedAttempts.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            style={{
              padding: "8px 16px",
              background: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Delete Selected ({selectedAttempts.size})
          </button>
        )}
      </div>

      {loading && attempts.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
          Loading history...
        </div>
      ) : attempts.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: theme.cardBg || "#fff",
            borderRadius: 12,
            border: `1px dashed ${theme.glassBorder || "#ddd"}`,
          }}
        >
          <h3 style={{ marginTop: 0, color: theme.text || "#333" }}>
            You haven't taken any exams yet.
          </h3>
          <button
            onClick={() => navigate("/ai-exam-creator")}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: theme.crimson || "#c41e3a",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Create New Exam
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              background: theme.cardBg || "#fff",
              borderRadius: 12,
              border: `1px solid ${theme.glassBorder || "#eee"}`,
              overflow: "hidden",
              boxShadow: theme.glassShadow || "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: theme.bg || "#f9f9f9",
                    borderBottom: `1px solid ${theme.border || "#eee"}`,
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "12px 16px", width: 40 }}>
                    <input
                      type="checkbox"
                      checked={
                        attempts.length > 0 &&
                        selectedAttempts.size === attempts.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAttempts(
                            new Set(attempts.map((a) => a.id))
                          );
                        } else {
                          setSelectedAttempts(new Set());
                        }
                      }}
                    />
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      userSelect: "none",
                      color: theme.text || "#333",
                    }}
                    onClick={() => handleSort("date")}
                  >
                    Date {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th style={{ padding: "12px 16px", color: theme.text || "#333" }}>Exam Name</th>
                  <th
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      userSelect: "none",
                      color: theme.text || "#333",
                    }}
                    onClick={() => handleSort("exam_type")}
                  >
                    Mode {sortBy === "exam_type" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      userSelect: "none",
                      textAlign: "center",
                      color: theme.text || "#333",
                    }}
                    onClick={() => handleSort("score")}
                  >
                    Score {sortBy === "score" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      userSelect: "none",
                      textAlign: "center",
                      color: theme.text || "#333",
                    }}
                    onClick={() => handleSort("questions")}
                  >
                    Questions {sortBy === "questions" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      userSelect: "none",
                      textAlign: "right",
                      color: theme.text || "#333",
                    }}
                    onClick={() => handleSort("duration")}
                  >
                    Duration {sortBy === "duration" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      userSelect: "none",
                      textAlign: "right",
                      color: theme.text || "#333",
                    }}
                    onClick={() => handleSort("average_time")}
                  >
                    Avg Time {sortBy === "average_time" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedAttempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    style={{
                      borderBottom: `1px solid ${theme.border || "#eee"}`,
                      cursor: "pointer",
                      transition: "background 0.2s",
                      backgroundColor: selectedAttempts.has(attempt.id)
                        ? theme.darkMode
                          ? "rgba(196, 30, 58, 0.15)"
                          : "rgba(196, 30, 58, 0.05)"
                        : "transparent",
                    }}
                    onClick={() => navigate(`/history/${attempt.id}`)}
                    onMouseEnter={(e) => {
                      if (!selectedAttempts.has(attempt.id)) {
                        e.currentTarget.style.backgroundColor = theme.darkMode
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.02)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedAttempts.has(attempt.id)) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <td
                      style={{ padding: "12px 16px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAttempts.has(attempt.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedAttempts);
                          if (e.target.checked) {
                            newSet.add(attempt.id);
                          } else {
                            newSet.delete(attempt.id);
                          }
                          setSelectedAttempts(newSet);
                        }}
                      />
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: theme.text || "#333" }}>
                      {formatDate(attempt.finished_at)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: theme.text || "#333" }}>
                        {attempt.upload_filename}
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {attempt.class_tags &&
                          attempt.class_tags.map((tag, i) => {
                            const bg = getClassColor(tag);
                            return (
                              <span
                                key={i}
                                style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: bg,
                                  color: getContrastTextColor(bg),
                                  fontWeight: "bold",
                                }}
                              >
                                {tag}
                              </span>
                            );
                          })}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textTransform: "capitalize", color: theme.text || "#333" }}>
                      {attempt.exam_type}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          background: getScoreColor(attempt.score_pct) + "20",
                          color: getScoreColor(attempt.score_pct),
                          fontWeight: "bold",
                        }}
                      >
                        {Math.round(attempt.score_pct)}%
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: theme.text || "#333" }}>
                      {attempt.correct_count} / {attempt.question_count}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: theme.text || "#333",
                      }}
                    >
                      {formatDuration(attempt.duration_seconds)}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: theme.text || "#333",
                      }}
                    >
                      {attempt.average_time_per_question
                        ? `${attempt.average_time_per_question}s`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: "10px 24px",
                  background: theme.cardBg || "#fff",
                  border: `1px solid ${theme.glassBorder || "#ddd"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  color: theme.text || "#333",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
