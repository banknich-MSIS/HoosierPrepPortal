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
  const { questions, examId: storeExamId, answers, setExam } = useExamStore();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [completedQuestions, setCompletedQuestions] = useState<Set<number>>(
    new Set()
  );
  const [showSummary, setShowSummary] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(
    new Set()
  );
  const [questionResults, setQuestionResults] = useState<
    Record<number, boolean>
  >({});

  // Load exam questions if not in store
  useEffect(() => {
    const loadExam = async () => {
      if (!examId) return;

      // Always reload if examId doesn't match store or no questions
      if (
        questions.length === 0 ||
        (storeExamId && Number(examId) !== storeExamId)
      ) {
        setLoading(true);
        try {
          const { getExam } = await import("../api/client");
          const examData = await getExam(Number(examId));
          console.log(
            `Loaded practice exam ${examId} with ${examData.questions.length} questions`
          );
          setExam(Number(examId), examData.questions);
        } catch (e) {
          console.error("Failed to load exam:", e);
        } finally {
          setLoading(false);
        }
      }
    };

    loadExam();
  }, [examId, questions.length, storeExamId, setExam]);

  useEffect(() => {
    if (!storeExamId) return;
    if (examId && Number(examId) !== storeExamId) {
      nav(`/practice/${storeExamId}`, { replace: true });
    }
  }, [examId, storeExamId, nav]);

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
      alert("Please answer the question before checking.");
      return;
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

  const revealAnswer = () => {
    // Mark as incorrect since user didn't attempt or gave up
    setIsCorrect(false);
    setShowAnswer(true);
    setCompletedQuestions(new Set([...completedQuestions, currentQuestion.id]));
    setRevealedQuestions(new Set([...revealedQuestions, currentQuestion.id]));

    // Track as incorrect
    setQuestionResults({
      ...questionResults,
      [currentQuestion.id]: false,
    });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowAnswer(false);
      setIsCorrect(null);
    } else {
      setShowSummary(true);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowAnswer(false);
      setIsCorrect(null);
    }
  };

  const jumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setShowAnswer(false);
    setIsCorrect(null);
  };

  const finishPractice = async () => {
    if (!storeExamId) return;

    // Submit exam for final grading
    const payload = questions.map((it) => ({
      questionId: it.id,
      response: answers[it.id],
    }));
    const graded = await gradeExam(storeExamId, payload);

    // Navigate to attempt review page with the attemptId from graded response
    if (graded.attemptId) {
      nav(`/history/${graded.attemptId}`);
    } else {
      console.error("No attemptId returned from grading");
      alert("Error: Could not load exam results");
    }
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

  if (showSummary) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 80px)",
          padding: 24,
          backgroundColor: theme.bg,
        }}
      >
        <div
          style={{
            maxWidth: 600,
            width: "100%",
            backgroundColor: theme.cardBg,
            padding: 40,
            borderRadius: 12,
            textAlign: "center",
            border: `1px solid ${theme.border}`,
          }}
        >
          <h2 style={{ margin: "0 0 16px 0", color: theme.text, fontSize: 28 }}>
            🎉 Practice Complete!
          </h2>
          <p
            style={{
              margin: "0 0 32px 0",
              fontSize: 16,
              color: theme.textSecondary,
            }}
          >
            You've completed all {questions.length} questions. Ready to see your
            results?
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={finishPractice}
              style={{
                padding: "12px 32px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: 16,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              View Results
            </button>
            <button
              onClick={() => nav("/settings")}
              style={{
                padding: "12px 32px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Start New
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            onClick={() => nav("/settings")}
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
            disabled={showAnswer}
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
              {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
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
              ← Previous
            </button>

            <button
              onClick={
                currentQuestionIndex === questions.length - 1
                  ? () => setShowSummary(true)
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
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(196, 30, 58, 0.08)";
              }}
            >
              {currentQuestionIndex === questions.length - 1
                ? "Finish →"
                : "Next →"}
            </button>
          </div>

          {!showAnswer ? (
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={revealAnswer}
                style={{
                  padding: "12px 24px",
                  background: darkMode ? "rgba(255, 193, 7, 0.7)" : "#e0a800",
                  color: darkMode ? "#000" : "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
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
                Reveal Answer
              </button>

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
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
