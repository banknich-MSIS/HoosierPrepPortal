import { useEffect, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { useExamStore } from "../store/examStore";
import QuestionCard from "../components/QuestionCard";
import QuestionNavigator from "../components/QuestionNavigator";
import BookmarkButton from "../components/BookmarkButton";
import { gradeExam } from "../api/client";

export default function ExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const nav = useNavigate();
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();
  const {
    questions,
    examId: storeExamId,
    answers,
    setExam,
    reset,
  } = useExamStore();
  const [showUnansweredAlert, setShowUnansweredAlert] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(
    new Set()
  );
  const [examStartTime, setExamStartTime] = useState<number>(Date.now());
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Warn user before leaving if they have unsaved progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if user has answered questions and hasn't submitted
      if (answeredQuestions.size > 0 && !hasSubmitted && !isSubmitting) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
        return "You have unsaved progress. Your answers will be lost if you leave now.";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [answeredQuestions.size, hasSubmitted, isSubmitting]);

  useEffect(() => {
    const loadExam = async () => {
      if (!examId) return;

      // If switching to a different exam, clear any stale in-memory state first
      if (storeExamId && Number(examId) !== storeExamId) {
        reset();
      }
      // Load when empty or after reset
      if (questions.length === 0) {
        setLoading(true);
        try {
          const { getExam } = await import("../api/client");
          const examData = await getExam(Number(examId));
          console.log(
            `Loaded exam ${examId} with ${examData.questions.length} questions`
          );
          setExam(Number(examId), examData.questions);
          setExamStartTime(Date.now()); // Reset start time when exam loads
        } catch (e) {
          console.error("Failed to load exam:", e);
        } finally {
          setLoading(false);
        }
      }
    };

    loadExam();
  }, [examId, questions.length, storeExamId, setExam, reset]);

  // Clear in-memory exam only on unmount (not on every re-render)
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Track which questions have been answered (for permanent locking)
  useEffect(() => {
    const answered = new Set<number>();
    Object.keys(answers).forEach((qId) => {
      const answer = answers[Number(qId)];
      // Check if answer is not empty
      if (
        answer !== undefined &&
        answer !== null &&
        answer !== "" &&
        !(Array.isArray(answer) && answer.length === 0)
      ) {
        answered.add(Number(qId));
      }
    });
    setAnsweredQuestions(answered);
  }, [answers]);

  if (loading) {
    return (
      <div style={{ padding: 24, color: theme.text }}>Loading exam...</div>
    );
  }

  if (!questions.length) {
    return (
      <div style={{ padding: 24, color: theme.text }}>
        No questions found for this exam.
      </div>
    );
  }

  const onSubmit = async () => {
    if (!storeExamId) return;
    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true);
    setHasSubmitted(true); // Mark as submitted to disable warnings
    try {
      const payload = questions.map((it) => ({
        questionId: it.id,
        response: answers[it.id] !== undefined ? answers[it.id] : null,
      }));

      // Get API key for AI explanations
      const apiKey = localStorage.getItem("gemini_api_key") || undefined;

      // Calculate duration in seconds
      const durationSeconds = Math.floor((Date.now() - examStartTime) / 1000);

      console.log("Submitting exam with payload:", payload);
      const graded = await gradeExam(
        storeExamId,
        payload,
        apiKey,
        durationSeconds,
        "exam"
      );
      console.log("Grading response:", graded);

      // Trigger insights refresh on exam completion
      window.dispatchEvent(new CustomEvent("exam-completed"));

      // Navigate to attempt review page with the attemptId from graded response
      if (graded.attemptId) {
        nav(`/history/${graded.attemptId}`);
      } else {
        console.error("No attemptId returned from grading");
        alert("Error: Could not load exam results");
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error submitting exam:", error);
      alert(
        `Failed to submit exam: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    // Check for unanswered questions
    const unansweredQuestions = questions.filter((q) => {
      const answer = answers[q.id];
      return (
        answer === undefined ||
        answer === null ||
        answer === "" ||
        (Array.isArray(answer) && answer.length === 0)
      );
    });

    if (unansweredQuestions.length > 0) {
      setUnansweredCount(unansweredQuestions.length);
      setShowUnansweredAlert(true);
      // Scroll to first unanswered question
      const firstUnansweredIndex = questions.findIndex(
        (q) => q.id === unansweredQuestions[0].id
      );
      if (firstUnansweredIndex !== -1) {
        const element = document.getElementById(
          `question-${firstUnansweredIndex}`
        );
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      // Show warning modal
      return;
    }

    // No unanswered questions, submit directly
    onSubmit();
  };

  const confirmSubmitWithUnanswered = () => {
    // User confirmed they want to submit with unanswered questions
    setShowUnansweredAlert(false);
    // Scroll to top before navigating
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Small delay to allow scroll to complete
    setTimeout(() => {
      onSubmit();
    }, 300);
  };

  // Scrollbar styles for dark mode
  const scrollbarStyles = `
    .exam-scroll::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .exam-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .exam-scroll::-webkit-scrollbar-thumb {
      background: ${darkMode ? "#555" : "#888"};
      border-radius: 4px;
    }
    .exam-scroll::-webkit-scrollbar-thumb:hover {
      background: ${darkMode ? "#666" : "#555"};
    }
  `;

  return (
    <>
      <style>{scrollbarStyles}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 16,
          minHeight: "calc(100vh - 80px)",
          backgroundColor: theme.bg,
        }}
      >
        <aside
          className="exam-scroll"
          style={{
            padding: "16px",
            backgroundColor: theme.navBg,
            overflow: "auto",
            position: "sticky",
            top: 80,
            height: "fit-content",
            maxHeight: "calc(100vh - 80px)",
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "18px",
              color: theme.text,
            }}
          >
            Questions
          </h3>
          <QuestionNavigator darkMode={darkMode} theme={theme} />

          {/* Submit Button */}
          <button
            onClick={handleSubmitClick}
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "12px 20px",
              marginTop: "20px",
              background: isSubmitting ? theme.border : theme.crimson,
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.2px",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: isSubmitting
                ? "none"
                : "0 2px 8px rgba(196, 30, 58, 0.25)",
              opacity: isSubmitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(196, 30, 58, 0.35)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.boxShadow =
                  "0 2px 8px rgba(196, 30, 58, 0.25)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Exam"}
          </button>
        </aside>
        <main
          className="exam-scroll"
          style={{ overflow: "auto", padding: "16px" }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              maxWidth: "800px",
            }}
          >
            {questions.map((question, index) => (
              <div
                key={question.id}
                id={`question-${index}`}
                style={{ position: "relative" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      color: theme.textSecondary,
                    }}
                  >
                    Question {index + 1}
                  </h3>
                  <BookmarkButton questionId={question.id} />
                </div>
                <QuestionCard
                  question={question}
                  darkMode={darkMode}
                  theme={theme}
                  disabled={false}
                />
              </div>
            ))}
          </div>
        </main>

        {/* Unanswered Questions Alert Modal */}
        {showUnansweredAlert && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowUnansweredAlert(false)}
          >
            <div
              style={{
                background: theme.modalBg,
                backdropFilter: theme.glassBlur,
                WebkitBackdropFilter: theme.glassBlur,
                padding: 24,
                borderRadius: 12,
                maxWidth: 400,
                width: "90%",
                border: `1px solid ${theme.glassBorder}`,
                boxShadow: theme.glassShadowHover,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  color: theme.crimson,
                  fontWeight: 700,
                }}
              >
                Submit Exam
              </h3>
              <p
                style={{
                  margin: "0 0 24px 0",
                  lineHeight: "1.5",
                  fontSize: "15px",
                  color: theme.text,
                }}
              >
                You have {unansweredCount} unanswered question(s) that will be
                marked as incorrect. Ready to submit?
              </p>
              <div
                style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
              >
                <button
                  onClick={() => setShowUnansweredAlert(false)}
                  style={{
                    padding: "8px 20px",
                    background: "transparent",
                    color: theme.text,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 500,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.glassBorder;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSubmitWithUnanswered}
                  style={{
                    padding: "8px 20px",
                    background: theme.crimson,
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: "-0.2px",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: "0 2px 8px rgba(196, 30, 58, 0.25)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(196, 30, 58, 0.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(196, 30, 58, 0.25)";
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
