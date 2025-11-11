import { useEffect, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { useExamStore } from "../store/examStore";
import QuestionCard from "../components/QuestionCard";
import { gradeExam, previewExamAnswers } from "../api/client";

export default function PracticeModePage() {
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [completedQuestions, setCompletedQuestions] = useState<Set<number>>(
    new Set()
  );
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [questionResults, setQuestionResults] = useState<
    Record<number, boolean>
  >({});
  const [practiceStartTime, setPracticeStartTime] = useState<number>(
    Date.now()
  );
  const [hasFinished, setHasFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const anyCompleted = completedQuestions.size > 0;

  // Warn user before leaving if they have unsaved progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if user has answered questions and hasn't finished
      const hasAnswers = Object.keys(answers).some((qId) => {
        const answer = answers[Number(qId)];
        return (
          answer !== undefined &&
          answer !== null &&
          answer !== "" &&
          !(Array.isArray(answer) && answer.length === 0)
        );
      });

      if (hasAnswers && !hasFinished) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
        return "You have unsaved progress. Your practice session will not be saved if you leave now.";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [answers, hasFinished]);

  // Load exam questions if not in store
  useEffect(() => {
    const loadExam = async () => {
      if (!examId) return;

      if (storeExamId && Number(examId) !== storeExamId) {
        reset();
      }
      if (questions.length === 0) {
        setLoading(true);
        try {
          const { getExam } = await import("../api/client");
          const examData = await getExam(Number(examId));
          console.log(
            `Loaded practice exam ${examId} with ${examData.questions.length} questions`
          );
          setExam(Number(examId), examData.questions);
          setPracticeStartTime(Date.now()); // Reset start time when practice loads
        } catch (e) {
          console.error("Failed to load exam:", e);
        } finally {
          setLoading(false);
        }
      }
    };

    loadExam();
  }, [examId, questions.length, storeExamId, setExam, reset]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Auto-submit when all questions have been checked/answered
  useEffect(() => {
    if (
      !hasFinished &&
      questions.length > 0 &&
      completedQuestions.size === questions.length
    ) {
      // Small timeout to allow last UI update to render before submit
      const t = setTimeout(() => {
        finishPractice();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [completedQuestions, questions.length, hasFinished]);

  // Fetch correct answers for practice mode
  useEffect(() => {
    const fetchAnswers = async () => {
      if (!storeExamId) return;
      try {
        const preview = await previewExamAnswers(storeExamId);
        const answersMap: Record<number, any> = {};
        preview.answers.forEach((item) => {
          answersMap[item.questionId] = item.correctAnswer;
        });
        setCorrectAnswers(answersMap);
      } catch (error) {
        console.error("Failed to load answers:", error);
      }
    };
    fetchAnswers();
  }, [storeExamId]);

  if (loading) {
    return (
      <div style={{ padding: 24, color: theme.text }}>
        Loading practice exam...
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div style={{ padding: 24, color: theme.text }}>
        No questions found for this exam.
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const userAnswer = answers[currentQuestion.id];
  const correctAnswer = correctAnswers[currentQuestion.id];

  const checkAnswer = () => {
    // Check if user has answered
    if (
      userAnswer === undefined ||
      userAnswer === null ||
      userAnswer === "" ||
      (Array.isArray(userAnswer) && userAnswer.length === 0)
    ) {
      const confirmed = window.confirm(
        "You haven't provided an answer. Are you sure you want to check?"
      );
      if (!confirmed) return;
    }

    // Simple grading logic
    let correct = false;
    const qtype = currentQuestion.type;

    if (qtype === "mcq" || qtype === "short" || qtype === "cloze") {
      correct =
        String(userAnswer).toLowerCase().trim() ===
        String(correctAnswer).toLowerCase().trim();
    } else if (qtype === "truefalse") {
      correct =
        String(userAnswer).toLowerCase() ===
        String(correctAnswer).toLowerCase();
    } else if (qtype === "multi") {
      const userSet = new Set(
        Array.isArray(userAnswer)
          ? userAnswer.map((v) => String(v).toLowerCase().trim())
          : []
      );
      const correctSet = new Set(
        Array.isArray(correctAnswer)
          ? correctAnswer.map((v) => String(v).toLowerCase().trim())
          : []
      );
      correct =
        userSet.size === correctSet.size &&
        [...userSet].every((v) => correctSet.has(v));
    }

    setIsCorrect(correct);
    setShowAnswer(true);
    setCompletedQuestions(new Set([...completedQuestions, currentQuestion.id]));

    // Track the result
    setQuestionResults({
      ...questionResults,
      [currentQuestion.id]: correct,
    });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestionId = questions[nextIndex].id;
      setCurrentQuestionIndex(nextIndex);
      // Check if next question was already answered
      if (completedQuestions.has(nextQuestionId)) {
        setShowAnswer(true);
        setIsCorrect(questionResults[nextQuestionId] ?? null);
      } else {
        setShowAnswer(false);
        setIsCorrect(null);
      }
    } else {
      // Automatically submit and view results when reaching the end
      finishPractice();
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      const prevQuestionId = questions[prevIndex].id;
      setCurrentQuestionIndex(prevIndex);
      // Check if previous question was already answered
      if (completedQuestions.has(prevQuestionId)) {
        setShowAnswer(true);
        setIsCorrect(questionResults[prevQuestionId] ?? null);
      } else {
        setShowAnswer(false);
        setIsCorrect(null);
      }
    }
  };

  const jumpToQuestion = (index: number) => {
    const targetQuestionId = questions[index].id;
    setCurrentQuestionIndex(index);
    // Check if target question was already answered
    if (completedQuestions.has(targetQuestionId)) {
      setShowAnswer(true);
      setIsCorrect(questionResults[targetQuestionId] ?? null);
    } else {
      setShowAnswer(false);
      setIsCorrect(null);
    }
  };

  const handleExitPractice = () => {
    // Check if user has answered any questions
    const hasAnswers = Object.keys(answers).some((qId) => {
      const answer = answers[Number(qId)];
      return (
        answer !== undefined &&
        answer !== null &&
        answer !== "" &&
        !(Array.isArray(answer) && answer.length === 0)
      );
    });

    if (hasAnswers && !hasFinished) {
      const confirmed = window.confirm(
        "You have unsaved progress. Your practice session will not be saved if you leave now. Are you sure you want to exit?"
      );
      if (!confirmed) return;
    }

    nav("/");
  };

  const finishPractice = async () => {
    if (!storeExamId || questions.length === 0) {
      alert("Exam is still loading. Please wait a moment and try again.");
      return;
    }

    setIsSubmitting(true);

    // Submit exam for final grading
    const payload = questions.map((it) => ({
      questionId: it.id,
      // Ensure we always send a response key; use null when unanswered
      response:
        answers[it.id] === undefined || answers[it.id] === ""
          ? null
          : answers[it.id],
    }));

    // Get API key for AI explanations
    const apiKey = localStorage.getItem("gemini_api_key") || undefined;

    // Calculate duration in seconds
    const durationSeconds = Math.floor((Date.now() - practiceStartTime) / 1000);

    try {
      const graded = await gradeExam(
        storeExamId,
        payload,
        apiKey,
        durationSeconds,
        "practice"
      );

      // Trigger insights refresh on exam completion
      window.dispatchEvent(new CustomEvent("exam-completed"));

      // Navigate to attempt review page with the attemptId from graded response
      if (graded.attemptId) {
        // Mark finished before navigation to suppress leave warning
        setHasFinished(true);
        // Prefer SPA navigation, with a hard redirect fallback
        try {
          nav(`/history/${graded.attemptId}`);
        } catch {
          window.location.assign(`/history/${graded.attemptId}`);
        }
      } else {
        console.error("No attemptId returned from grading");
        alert("Error: Could not load exam results");
      }
    } catch (e: any) {
      console.error("Failed to submit practice:", e);
      alert(
        e?.response?.data?.detail ||
          e?.message ||
          "Failed to submit practice. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPractice = () => {
    if (hasFinished || isSubmitting) return;
    if (!storeExamId || questions.length === 0) {
      alert("Exam is still loading. Please wait a moment and try again.");
      return;
    }
    if (completedQuestions.size < questions.length) {
      const ok = window.confirm(
        "You haven’t checked all questions. Submit anyway?"
      );
      if (!ok) return;
    }
    finishPractice();
  };

  const getQuestionStatusColor = (index: number) => {
    const questionId = questions[index].id;

    // Check if question has been answered/revealed
    if (questionId in questionResults) {
      const isCorrect = questionResults[questionId];
      // Red for wrong/revealed, Green for correct
      return isCorrect
        ? darkMode
          ? "#4CAF50"
          : "#28a745" // Green
        : theme.btnDanger; // Red (#dc3545)
    }

    // Unanswered questions (including current)
    return darkMode ? "#4d4d4d" : "#e9ecef";
  };

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
      {/* Sidebar Navigator */}
      <aside
        style={{
          padding: "16px",
          backgroundColor: theme.bg,
          position: "sticky",
          top: 0,
          height: "fit-content",
          maxHeight: "100vh",
          overflow: "auto",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "18px",
            color: theme.text,
          }}
        >
          Progress
        </h3>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: theme.crimson,
            marginBottom: 16,
          }}
        >
          {completedQuestions.size} / {questions.length}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
            gap: 8,
          }}
        >
          {questions.map((q, idx) => {
            const isAnswered = q.id in questionResults;
            const isCorrect = questionResults[q.id];
            return (
              <button
                key={q.id}
                onClick={() => jumpToQuestion(idx)}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  border: `${
                    idx === currentQuestionIndex ? "4px" : "2px"
                  } solid ${
                    idx === currentQuestionIndex
                      ? theme.btnWarning
                      : theme.border
                  }`,
                  background: getQuestionStatusColor(idx),
                  cursor: "pointer",
                  fontWeight: 700,
                  color: isAnswered ? "white" : theme.text,
                }}
                title={`Question ${idx + 1}${
                  completedQuestions.has(q.id) ? " (Completed)" : ""
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Submit Practice - Sidebar (below question index) */}
        <button
          onClick={handleSubmitPractice}
          disabled={hasFinished || isSubmitting || !storeExamId || questions.length === 0}
          style={{
            width: "100%",
            padding: "12px 16px",
            background:
              hasFinished || isSubmitting || !storeExamId || questions.length === 0
                ? theme.border
                : theme.crimson,
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor:
              hasFinished || isSubmitting || !storeExamId || questions.length === 0
                ? "not-allowed"
                : "pointer",
            fontWeight: 700,
            fontSize: 14,
            marginTop: 16,
            transition: "0.2s",
          }}
          onMouseEnter={(e) => {
            if (!(
              hasFinished ||
              isSubmitting ||
              !storeExamId ||
              questions.length === 0
            )) {
              e.currentTarget.style.filter = "brightness(1.1)";
            }
          }}
          onMouseLeave={(e) => {
            if (!(
              hasFinished ||
              isSubmitting ||
              !storeExamId ||
              questions.length === 0
            )) {
              e.currentTarget.style.filter = "brightness(1)";
            }
          }}
          title={
            hasFinished
              ? "Already submitted"
              : isSubmitting
              ? "Submitting..."
              : !storeExamId || questions.length === 0
              ? "Exam is still loading"
              : completedQuestions.size < questions.length
              ? "You haven’t checked all questions. Click to submit anyway."
              : "Submit practice for review"
          }
        >
          {isSubmitting ? "Submitting..." : "Submit Practice"}
        </button>
      </aside>

      {/* Main Content */}
      <main
        style={{
          overflow: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Progress Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 20px",
            backgroundColor: theme.navBg,
            borderRadius: 8,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </h2>
          <button
            onClick={handleExitPractice}
            style={{
              padding: "8px 14px",
              background: "rgba(196, 30, 58, 0.08)",
              color: theme.crimson,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(196, 30, 58, 0.08)";
            }}
          >
            Exit Practice
          </button>
        </div>

        {/* Question Card */}
        <div style={{ maxWidth: 800 }}>
          <QuestionCard
            question={currentQuestion}
            darkMode={darkMode}
            theme={theme}
            disabled={completedQuestions.has(currentQuestion.id)}
          />
        </div>

        {/* Answer Feedback */}
        {showAnswer && (
          <div
            style={{
              maxWidth: 800,
              padding: 20,
              borderRadius: 8,
              backgroundColor: isCorrect
                ? darkMode
                  ? "#1a3d1a"
                  : "#d4edda"
                : darkMode
                ? "#3d1a1a"
                : "#f8d7da",
              border: `2px solid ${isCorrect ? "#28a745" : "#dc3545"}`,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: 18,
                color: isCorrect ? "#28a745" : "#dc3545",
              }}
            >
              {isCorrect ? "Correct!" : "Incorrect"}
            </h3>
            {!isCorrect && (
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: "bold",
                    marginBottom: 4,
                    color: theme.text,
                  }}
                >
                  Correct Answer:
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: darkMode ? "#2a4a2a" : "#c3e6cb",
                    borderRadius: 4,
                    color: theme.text,
                  }}
                >
                  {Array.isArray(correctAnswer)
                    ? correctAnswer.join(", ")
                    : String(correctAnswer)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div
          style={{
            maxWidth: 800,
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={previousQuestion}
              disabled={currentQuestionIndex === 0}
              style={{
                padding: "8px 14px",
                width: "90px",
                background: "rgba(196, 30, 58, 0.08)",
                color: theme.crimson,
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 6,
                cursor: currentQuestionIndex === 0 ? "not-allowed" : "pointer",
                opacity: currentQuestionIndex === 0 ? 0.5 : 1,
                fontSize: 13,
                fontWeight: 500,
                transition: "0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                if (currentQuestionIndex !== 0) {
                  e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (currentQuestionIndex !== 0) {
                  e.currentTarget.style.background = "rgba(196, 30, 58, 0.08)";
                }
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            <button
              onClick={
                currentQuestionIndex === questions.length - 1
                  ? finishPractice
                  : nextQuestion
              }
              style={{
                padding: "8px 14px",
                width: "90px",
                background: "rgba(196, 30, 58, 0.08)",
                color: theme.crimson,
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                transition: "0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(196, 30, 58, 0.08)";
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {!showAnswer && (
              <button
                onClick={checkAnswer}
                style={{
                  padding: "12px 32px",
                  background: darkMode ? "rgba(40, 167, 69, 0.7)" : "#1e7e34",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "-0.2px",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.85";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Check Answer
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
