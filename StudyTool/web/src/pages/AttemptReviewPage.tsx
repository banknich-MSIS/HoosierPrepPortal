import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { fetchAttemptDetail } from "../api/client";
import type { AttemptDetail } from "../types";
import axios from "axios";
import { parseSimpleMarkdown } from "../utils/markdown";

export default function AttemptReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWrongOnly, setShowWrongOnly] = useState(false);
  const [overriddenAnswers, setOverriddenAnswers] = useState<Set<number>>(
    new Set()
  );

  // Helper function to check if answer is empty/unanswered
  const isAnswerEmpty = (answer: any): boolean => {
    return (
      answer === undefined ||
      answer === null ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0)
    );
  };

  useEffect(() => {
    if (attemptId) {
      loadAttemptDetail(parseInt(attemptId));
    }
  }, [attemptId]);

  const loadAttemptDetail = async (id: number) => {
    try {
      setLoading(true);
      const data = await fetchAttemptDetail(id);
      setAttempt(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load attempt details");
    } finally {
      setLoading(false);
    }
  };

  const handleGradeOverride = async (
    questionId: number,
    currentStatus: boolean
  ) => {
    if (!attempt || !attemptId) return;

    try {
      // Call backend to override grade
      await axios.post(
        `http://localhost:8000/api/attempts/${attemptId}/questions/${questionId}/override`
      );

      // Update local state
      setAttempt({
        ...attempt,
        questions: attempt.questions.map((q) =>
          q.question.id === questionId
            ? { ...q, is_correct: !currentStatus }
            : q
        ),
        score_pct: calculateNewScore(
          attempt.questions,
          questionId,
          !currentStatus
        ),
      });

      setOverriddenAnswers(new Set([...overriddenAnswers, questionId]));
    } catch (e: any) {
      alert(`Failed to override grade: ${e?.message || "Unknown error"}`);
    }
  };

  const calculateNewScore = (
    questions: any[],
    overriddenQuestionId: number,
    newStatus: boolean
  ): number => {
    let correctCount = 0;
    questions.forEach((q) => {
      if (q.question.id === overriddenQuestionId) {
        if (newStatus) correctCount++;
      } else if (q.is_correct) {
        correctCount++;
      }
    });
    return (correctCount / questions.length) * 100;
  };

  const scrollToQuestion = (index: number) => {
    const element = document.getElementById(`review-question-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const formatDate = (date: string) => {
    // Ensure UTC parsing if 'Z' is missing
    const dateStr = date.endsWith("Z") ? date : date + "Z";
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#28a745";
    if (score >= 60) return "#ffc107";
    return "#dc3545";
  };

  const getScoreBackground = (score: number) => {
    if (darkMode) {
      if (score >= 80) return "#1a3d1a";
      if (score >= 60) return "#3d3d1a";
      return "#3d1a1a";
    }
    if (score >= 80) return "#d4edda";
    if (score >= 60) return "#fff3cd";
    return "#f8d7da";
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: theme.text }}>
        <div>Loading attempt review...</div>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div style={{ padding: 24, color: "crimson" }}>
        <div>Error: {error || "Attempt not found"}</div>
        <button onClick={() => navigate("/")} style={{ marginTop: 12 }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const allQuestions = attempt.questions;
  const displayedQuestions = showWrongOnly
    ? allQuestions.filter((q) => !q.is_correct)
    : allQuestions;
  const correctCount = allQuestions.filter((q) => q.is_correct).length;
  const totalCount = allQuestions.length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 16,
        minHeight: "calc(100vh - 80px)",
        backgroundColor: theme.bg,
      }}
    >
      {/* Sticky Sidebar Navigator */}
      <aside
        style={{
          padding: "16px",
          backgroundColor: theme.navBg,
          position: "sticky",
          top: 80,
          height: "fit-content",
          maxHeight: "100vh",
          overflow: "auto",
        }}
      >
        {/* Back to Dashboard Button - Top */}
        <button
          onClick={() => navigate("/")}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: darkMode
              ? "rgba(196, 30, 58, 0.2)"
              : "rgba(220, 53, 69, 0.12)",
            color: darkMode ? "#ef5350" : "#c41e3a",
            border: `1px solid ${
              darkMode ? "rgba(196, 30, 58, 0.3)" : "rgba(196, 30, 58, 0.2)"
            }`,
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = darkMode
              ? "rgba(196, 30, 58, 0.3)"
              : "rgba(220, 53, 69, 0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = darkMode
              ? "rgba(196, 30, 58, 0.2)"
              : "rgba(220, 53, 69, 0.12)";
          }}
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
            style={{ marginRight: 8 }}
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Dashboard
        </button>

        <div style={{ marginBottom: 16 }}>
          <h3
            style={{ margin: "0 0 8px 0", fontSize: "18px", color: theme.text }}
          >
            Results
          </h3>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: getScoreColor(attempt.score_pct),
            }}
          >
            {Math.round(attempt.score_pct)}%
          </div>
          <div style={{ fontSize: "14px", color: theme.textSecondary }}>
            {correctCount} / {totalCount} correct
          </div>
        </div>

        {/* Show Wrong Only Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px",
            background: darkMode
              ? "rgba(194, 155, 74, 0.08)"
              : "rgba(194, 155, 74, 0.05)",
            border: `1px solid ${theme.glassBorder}`,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>
            Show Wrong Only
          </span>
          <label
            style={{
              position: "relative",
              display: "inline-block",
              width: 44,
              height: 24,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showWrongOnly}
              onChange={(e) => setShowWrongOnly(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: showWrongOnly
                  ? darkMode
                    ? "rgba(194, 155, 74, 0.4)"
                    : "rgba(194, 155, 74, 0.3)"
                  : darkMode
                  ? "rgba(194, 155, 74, 0.15)"
                  : "rgba(194, 155, 74, 0.1)",
                borderRadius: 12,
                transition: "all 0.3s ease",
                border: `1px solid ${theme.glassBorder}`,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  height: 16,
                  width: 16,
                  left: showWrongOnly ? 24 : 4,
                  bottom: 3,
                  background: darkMode ? "#d4a650" : "#c29b4a",
                  borderRadius: "50%",
                  transition: "all 0.3s ease",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                }}
              />
            </span>
          </label>
        </div>

        {/* Question Navigator Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
            gap: 8,
          }}
        >
          {allQuestions.map((q, idx) => (
            <button
              key={q.question.id}
              onClick={() => scrollToQuestion(idx)}
              style={{
                padding: 8,
                borderRadius: 6,
                border: `1px solid ${theme.border}`,
                background: q.is_correct
                  ? darkMode
                    ? "#1a3d1a"
                    : "#d4edda"
                  : darkMode
                  ? "#3d1a1a"
                  : "#f8d7da",
                cursor: "pointer",
                fontWeight: "bold",
                color: q.is_correct
                  ? darkMode
                    ? "#66bb6a"
                    : "#155724"
                  : darkMode
                  ? "#ef5350"
                  : "#721c24",
                opacity: showWrongOnly && q.is_correct ? 0.3 : 1,
              }}
              title={`Question ${idx + 1} - ${
                q.is_correct ? "Correct" : "Incorrect"
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ overflow: "auto", padding: "16px" }}>
        {/* Questions */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            maxWidth: "800px",
          }}
        >
          {displayedQuestions.map((questionReview, displayIdx) => {
            const actualIndex = allQuestions.indexOf(questionReview);
            const question = questionReview.question;
            const isShortAnswer =
              question.type === "short" || question.type === "cloze";
            const isCorrect = questionReview.is_correct;

            // Determine border color
            let borderColor = "#28a745"; // green
            if (isShortAnswer) {
              borderColor = "#ffc107"; // yellow/amber for short answer
            } else if (!isCorrect) {
              borderColor = "#dc3545"; // red
            }

            return (
              <div
                key={question.id}
                id={`review-question-${actualIndex}`}
                style={{
                  border: `2px solid ${borderColor}`,
                  borderRadius: 8,
                  padding: 16,
                  backgroundColor: isShortAnswer
                    ? darkMode
                      ? "#3d3d1a"
                      : "#fffbf0"
                    : isCorrect
                    ? darkMode
                      ? "#1e2e1e"
                      : "#f8fff9"
                    : darkMode
                    ? "#2e1e1e"
                    : "#fff8f8",
                }}
              >
                {/* Question Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        color: theme.textSecondary,
                      }}
                    >
                      Question {actualIndex + 1}
                    </h3>
                    {isAnswerEmpty(questionReview.user_answer) && (
                      <div
                        style={{
                          padding: "4px 10px",
                          borderRadius: 4,
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: darkMode
                            ? "rgba(194, 155, 74, 0.2)"
                            : "rgba(194, 155, 74, 0.15)",
                          color: darkMode ? "#d4a650" : "#c29b4a",
                          border: `1.5px solid ${
                            darkMode
                              ? "rgba(194, 155, 74, 0.4)"
                              : "rgba(194, 155, 74, 0.3)"
                          }`,
                          fontStyle: "italic",
                        }}
                      >
                        No answer provided
                      </div>
                    )}
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        padding: "4px 12px",
                        borderRadius: 4,
                        fontWeight: "bold",
                        fontSize: "14px",
                        backgroundColor: isShortAnswer
                          ? "#ffc107"
                          : isCorrect
                          ? "#28a745"
                          : "#dc3545",
                        color: isShortAnswer ? "#000" : "white",
                      }}
                    >
                      {isShortAnswer
                        ? "Manual Review"
                        : isCorrect
                        ? "Correct"
                        : "Incorrect"}
                    </div>
                    {/* Grade Override Button - only for non-short answer */}
                    {!isShortAnswer && (
                      <button
                        onClick={() =>
                          handleGradeOverride(question.id, isCorrect)
                        }
                        title="Override grade (toggle correct/incorrect)"
                        style={{
                          padding: "4px 10px",
                          backgroundColor: darkMode ? "#4d4d4d" : "#e0e0e0",
                          border: `1px solid ${theme.border}`,
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: "11px",
                          color: theme.text,
                          fontWeight: "bold",
                        }}
                      >
                        ⚙ Override
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.5",
                    marginBottom: 16,
                    whiteSpace: "pre-wrap",
                    color: theme.text,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: parseSimpleMarkdown(question.stem),
                  }}
                />

                {/* Options for MCQ/Multi/TrueFalse - Highlighted */}
                {question.type === "mcq" ||
                question.type === "multi" ||
                question.type === "truefalse" ? (
                  <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                    {question.type === "truefalse" ? (
                      ["True", "False"].map((option) => {
                        const isUserAnswer =
                          !isAnswerEmpty(questionReview.user_answer) &&
                          String(questionReview.user_answer).toLowerCase() ===
                            option.toLowerCase();
                        const isCorrectAnswer =
                          String(
                            questionReview.correct_answer
                          ).toLowerCase() === option.toLowerCase();

                        let backgroundColor = darkMode ? "#4d4d4d" : "#e9ecef";
                        let borderColor = theme.border;
                        let label = "";

                        if (isCorrectAnswer) {
                          backgroundColor = darkMode ? "#1a3d1a" : "#d4edda";
                          borderColor = "#28a745";
                          label = "Correct Answer";
                        }
                        if (isUserAnswer && !isCorrectAnswer) {
                          backgroundColor = darkMode ? "#3d1a1a" : "#f8d7da";
                          borderColor = "#dc3545";
                          label = "Your Answer";
                        }

                        return (
                          <div
                            key={option}
                            style={{
                              padding: "12px",
                              border: `2px solid ${borderColor}`,
                              borderRadius: 4,
                              backgroundColor,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "15px",
                                color: theme.text,
                                textTransform: "capitalize",
                              }}
                            >
                              {option}
                            </span>
                            {label && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontWeight: "bold",
                                  color: isCorrectAnswer
                                    ? darkMode
                                      ? "#66bb6a"
                                      : "#28a745"
                                    : darkMode
                                    ? "#ef5350"
                                    : "#dc3545",
                                }}
                              >
                                {label}
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : question.options && question.options.length > 0 ? (
                      question.options.map((option, optIdx) => {
                        const isUserAnswer =
                          !isAnswerEmpty(questionReview.user_answer) &&
                          (String(questionReview.user_answer) ===
                            String(option) ||
                            (Array.isArray(questionReview.user_answer) &&
                              questionReview.user_answer.includes(option)));
                        const isCorrectAnswer =
                          String(questionReview.correct_answer) ===
                            String(option) ||
                          (Array.isArray(questionReview.correct_answer) &&
                            questionReview.correct_answer.includes(option));

                        let backgroundColor = darkMode ? "#4d4d4d" : "#e9ecef";
                        let borderColor = theme.border;
                        let label = "";

                        if (isCorrectAnswer) {
                          backgroundColor = darkMode ? "#1a3d1a" : "#d4edda";
                          borderColor = "#28a745";
                          label = "Correct Answer";
                        }
                        if (isUserAnswer && !isCorrectAnswer) {
                          backgroundColor = darkMode ? "#3d1a1a" : "#f8d7da";
                          borderColor = "#dc3545";
                          label = "Your Answer";
                        }

                        return (
                          <div
                            key={optIdx}
                            style={{
                              padding: "12px",
                              border: `2px solid ${borderColor}`,
                              borderRadius: 4,
                              backgroundColor,
                            }}
                          >
                            <span
                              style={{ fontSize: "15px", color: theme.text }}
                            >
                              {option}
                            </span>
                            {label && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontWeight: "bold",
                                  color: isCorrectAnswer
                                    ? darkMode
                                      ? "#66bb6a"
                                      : "#28a745"
                                    : darkMode
                                    ? "#ef5350"
                                    : "#dc3545",
                                }}
                              >
                                {label}
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          padding: "16px",
                          backgroundColor: darkMode ? "#3d1a1a" : "#fff3cd",
                          border: `2px solid ${
                            darkMode ? "#4d2a2a" : "#ffc107"
                          }`,
                          borderRadius: 4,
                          color: theme.text,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: 8,
                            color: darkMode ? "#ffb74d" : "#856404",
                          }}
                        >
                          Warning: Options data missing for this question
                        </div>
                        <div style={{ fontSize: "14px" }}>
                          <strong>Your answer:</strong>{" "}
                          {String(questionReview.user_answer || "No answer")}
                          <br />
                          <strong>Correct answer:</strong>{" "}
                          {String(questionReview.correct_answer || "N/A")}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Short Answer / Cloze - Side by Side Comparison */}
                {isShortAnswer && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: 4,
                            fontSize: "14px",
                            color: theme.text,
                          }}
                        >
                          Your Answer:
                        </div>
                        <div
                          style={{
                            padding: "12px",
                            border: `2px solid ${darkMode ? "#555" : "#ccc"}`,
                            borderRadius: 4,
                            backgroundColor: darkMode ? "#3d3d3d" : "#f5f5f5",
                            minHeight: 40,
                            color: theme.text,
                          }}
                        >
                          {isAnswerEmpty(questionReview.user_answer)
                            ? "—"
                            : String(questionReview.user_answer)}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: 4,
                            fontSize: "14px",
                            color: theme.text,
                          }}
                        >
                          Correct Answer:
                        </div>
                        <div
                          style={{
                            padding: "12px",
                            border: "2px solid #ffc107",
                            borderRadius: 4,
                            backgroundColor: darkMode ? "#3d3d1a" : "#fffbf0",
                            minHeight: 40,
                            color: theme.text,
                          }}
                        >
                          {String(questionReview.correct_answer)}
                        </div>
                      </div>
                    </div>

                    {/* AI Explanation for Incorrect Answers */}
                    {!questionReview.is_correct &&
                      questionReview.ai_explanation && (
                        <div
                          style={{
                            marginTop: 16,
                            padding: 16,
                            backgroundColor: darkMode ? "#1a2228" : "#f0f7ff",
                            borderLeft: `4px solid ${theme.crimson}`,
                            borderRadius: 6,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
                              fontSize: 14,
                              marginBottom: 8,
                              color: theme.crimson,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            Explanation
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: theme.text,
                              lineHeight: 1.6,
                            }}
                          >
                            {questionReview.ai_explanation}
                          </div>
                        </div>
                      )}

                    <div
                      style={{
                        fontSize: "13px",
                        color: theme.textSecondary,
                        fontStyle: "italic",
                        padding: "8px",
                        backgroundColor: darkMode ? "#2a2a1a" : "#fff8dc",
                        borderRadius: 4,
                      }}
                    >
                      ℹ️ Please manually review if your answer matches the
                      expected answer.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {displayedQuestions.length === 0 && showWrongOnly && (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              backgroundColor: darkMode ? "#1a3d1a" : "#d4edda",
              borderRadius: 8,
              border: `2px solid #28a745`,
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", color: "#28a745" }}>
              Perfect Score!
            </h3>
            <p style={{ margin: 0, color: theme.text }}>
              You answered all questions correctly. Great job!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
