import { useEffect, useState, useRef } from "react";
import {
  useNavigate,
  useParams,
  useOutletContext,
  useBlocker,
  useLocation,
} from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { useExamStore } from "../store/examStore";
import QuestionCard from "../components/QuestionCard";
import NavigationGuardModal from "../components/NavigationGuardModal";
import ResumeAttemptModal from "../components/ResumeAttemptModal";
import {
  gradeExam,
  previewExamAnswers,
  startAttempt,
  getInProgressAttempt,
  saveProgress,
} from "../api/client";

export default function PracticeModePage() {
  const { examId } = useParams<{ examId: string }>();
  const nav = useNavigate();
  const location = useLocation();
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();
  const { showToast } = useToast();
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

  // Progress saving state
  const [currentAttemptId, setCurrentAttemptId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showNavGuard, setShowNavGuard] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );
  const hasCheckedResume = useRef(false);

  const [savedAnswersJson, setSavedAnswersJson] = useState<string>("{}");

  // Track unsaved changes
  useEffect(() => {
    const currentAnswersJson = JSON.stringify(answers);
    setHasUnsavedChanges(
      currentAnswersJson !== savedAnswersJson && !hasFinished && !isSubmitting
    );
  }, [answers, savedAnswersJson, hasFinished, isSubmitting]);

  // Navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      !hasFinished &&
      !isSubmitting &&
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowNavGuard(true);
      setPendingNavigation(blocker.location?.pathname || null);
    }
  }, [blocker]);

  // Handle navigation guard actions
  const handleSaveAndLeave = async () => {
    if (currentAttemptId) {
      setIsSaving(true);
      try {
        await saveProgressData();
        setHasUnsavedChanges(false);
        setShowNavGuard(false);
        if (pendingNavigation) {
          blocker.proceed?.();
          nav(pendingNavigation);
        }
      } catch (error) {
        console.error("Failed to save before leaving:", error);
        showToast("Failed to save progress. Please try again.", "error");
      } finally {
        setIsSaving(false);
        setPendingNavigation(null);
      }
    } else {
      // No attempt yet, just leave
      setShowNavGuard(false);
      if (pendingNavigation) {
        blocker.proceed?.();
        nav(pendingNavigation);
      }
    }
  };

  const handleLeaveWithoutSaving = () => {
    reset(); // Clear unsaved state from store
    setHasUnsavedChanges(false);
    setShowNavGuard(false);
    if (pendingNavigation) {
      blocker.proceed?.();
      nav(pendingNavigation);
    }
    setPendingNavigation(null);
  };

  const handleCancelNavigation = () => {
    setShowNavGuard(false);
    blocker.reset?.();
    setPendingNavigation(null);
  };

  // Save progress function
  const saveProgressData = async () => {
    if (!storeExamId || !currentAttemptId) return;

    try {
      await saveProgress(currentAttemptId, {
        answers,
        bookmarks: Array.from(useExamStore.getState().bookmarks),
        completed_questions: Array.from(completedQuestions),
        current_question_index: currentQuestionIndex,
        timer_state: null,
        exam_type: "practice",
      });
      setSavedAnswersJson(JSON.stringify(answers));
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save progress:", error);
      throw error;
    }
  };

  // Warn user before leaving if they have unsaved progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !hasFinished && !isSubmitting) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
        return "You have unsaved progress. Your practice session will not be saved if you leave now.";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, hasFinished, isSubmitting]);

  // Helper to restore attempt
  const restoreAttempt = async (attemptId: number) => {
    try {
      const { getProgress } = await import("../api/client");
      const progress = await getProgress(attemptId);

      // Restore answers
      Object.entries(progress.saved_answers).forEach(([qId, answer]) => {
        useExamStore.getState().setAnswer(Number(qId), answer);
      });

      // Restore current question index
      if (progress.progress_state?.current_question_index !== undefined) {
        const savedIndex = progress.progress_state.current_question_index;
        setCurrentQuestionIndex(savedIndex);
        // Note: questions might not be fully loaded here if calling from checkResume,
        // but questions array is dependency of checkResume so it should be fine.
        if (questions[savedIndex]) {
          const savedQuestionId = questions[savedIndex].id;
          // Need to update completedQuestions for practice mode
          // (we'll do this below with savedQIds)
        }
      }

      // Restore completed questions
      let newCompleted = new Set<number>();
      if (progress.progress_state?.completed_questions) {
        newCompleted = new Set(progress.progress_state.completed_questions);
      } else {
        // Legacy fallback: assume all saved answers are completed (only for old saves)
        const savedQIds = Object.keys(progress.saved_answers).map(Number);
        newCompleted = new Set(savedQIds);
      }
      setCompletedQuestions(newCompleted);

      // Update saved state tracker
      setSavedAnswersJson(JSON.stringify(progress.saved_answers || {}));

      // Restore results for completed questions (we need to fetch/check them if not stored)
      // Since we don't store "isCorrect" in progress (just answers), we might need to re-check or just leave as is.
      // Re-checking might be expensive or require correct answers.
      // For now, let's assume if it's in completedQuestions, the user will see their answer.
      // If we want to show green/red, we need to know if it was correct.
      // The current implementation of checkResume -> handleResume didn't re-grade.
      // Wait, original handleResume DID restore `completedQuestions`.
      // And `useEffect` for `fetchAnswers` runs on load.
      // So once correctAnswers are loaded, we can re-compute results?
      // Actually, let's just restore the state we have.

      setCurrentAttemptId(attemptId);
      setShowResumeModal(false);
      setHasUnsavedChanges(false); // Already saved
    } catch (error) {
      console.error("Failed to resume attempt:", error);
      showToast("Failed to resume attempt. Starting fresh.", "error");
      handleStartNew();
    }
  };

  // Check for in-progress attempt on load
  useEffect(() => {
    const checkResume = async () => {
      if (!examId || hasCheckedResume.current) return;
      hasCheckedResume.current = true;

      try {
        const inProgress = await getInProgressAttempt(Number(examId));
        if (inProgress.exists && inProgress.attempt_id) {
          // Check for auto-resume flag from dashboard
          const shouldAutoResume = location.state?.autoResume;

          if (shouldAutoResume) {
            restoreAttempt(inProgress.attempt_id);
            return;
          }

          const hasAnswers =
            inProgress.saved_answers &&
            Object.keys(inProgress.saved_answers).length > 0;
          const hasBookmarks =
            inProgress.progress_state?.bookmarks &&
            inProgress.progress_state.bookmarks.length > 0;

          if (hasAnswers || hasBookmarks) {
            setShowResumeModal(true);
            setCurrentAttemptId(inProgress.attempt_id);
          } else {
            // Reuse existing empty attempt silently
            setCurrentAttemptId(inProgress.attempt_id);
          }
        }
      } catch (error) {
        console.error("Failed to check for in-progress attempt:", error);
      }
    };

    if (questions.length > 0) {
      checkResume();
    }
  }, [examId, questions.length, location.state]);

  // Handle resume
  const handleResume = async () => {
    if (!examId || !currentAttemptId) return;
    restoreAttempt(currentAttemptId);
  };

  const handleStartNew = async () => {
    setShowResumeModal(false);
    setCurrentAttemptId(null);
    reset();
    setCompletedQuestions(new Set());
    setQuestionResults({});
    setShowAnswer(false);
    setIsCorrect(null);
    setCurrentQuestionIndex(0);
    // Start new attempt
    if (examId) {
      try {
        const newAttempt = await startAttempt(Number(examId));
        setCurrentAttemptId(newAttempt.attempt_id);
        setPracticeStartTime(Date.now());
      } catch (error) {
        console.error("Failed to start new attempt:", error);
      }
    }
  };

  // Load exam questions if not in store
  useEffect(() => {
    const loadExam = async () => {
      if (!examId) return;

      if (storeExamId && Number(examId) !== storeExamId) {
        reset();
        hasCheckedResume.current = false;
        setCurrentAttemptId(null);
        setCompletedQuestions(new Set());
        setQuestionResults({});
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

          // Start attempt if not resuming
          if (!showResumeModal) {
            try {
              const newAttempt = await startAttempt(Number(examId));
              setCurrentAttemptId(newAttempt.attempt_id);
            } catch (error) {
              console.error("Failed to start attempt:", error);
            }
          }
        } catch (e) {
          console.error("Failed to load exam:", e);
        } finally {
          setLoading(false);
        }
      }
    };

    loadExam();
  }, [examId, questions.length, storeExamId, setExam, reset, showResumeModal]);

  // Manual save progress handler
  const handleSaveProgress = async () => {
    if (!currentAttemptId) {
      // Start attempt first
      if (!examId) return;
      try {
        const newAttempt = await startAttempt(Number(examId));
        setCurrentAttemptId(newAttempt.attempt_id);
        // Save after creating attempt
        await saveProgressData();
      } catch (error) {
        console.error("Failed to start attempt:", error);
        showToast("Failed to save progress. Please try again.", "error");
      }
    } else {
      setIsSaving(true);
      try {
        await saveProgressData();
      } catch (error) {
        console.error("Failed to save progress:", error);
        showToast("Failed to save progress. Please try again.", "error");
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Auto-submit when all questions have been checked/answered
  // Only trigger if not already submitting and not finished
  useEffect(() => {
    if (
      !hasFinished &&
      !isSubmitting &&
      questions.length > 0 &&
      completedQuestions.size === questions.length
    ) {
      // Small timeout to allow last UI update to render before submit
      const t = setTimeout(() => {
        // Double-check state before submitting (race condition protection)
        if (!hasFinished && !isSubmitting) {
          finishPractice();
        }
      }, 150);
      return () => clearTimeout(t);
    }
  }, [completedQuestions, questions.length, hasFinished, isSubmitting]);

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
    // Disable checking during submission
    if (isSubmitting || hasFinished) return;

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
    // Disable navigation during submission
    if (isSubmitting || hasFinished) return;

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
      // Don't auto-submit here - let the useEffect handle it or user clicks Submit
      // This prevents duplicate submissions
    }
  };

  const previousQuestion = () => {
    // Disable navigation during submission
    if (isSubmitting || hasFinished) return;

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
    // Disable navigation during submission
    if (isSubmitting || hasFinished) return;

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
    // Navigation guard will handle this
    nav("/");
  };

  const finishPractice = async () => {
    // Guard against duplicate submissions
    if (isSubmitting || hasFinished) {
      console.log(
        "Submission already in progress or completed, ignoring duplicate call"
      );
      return;
    }

    if (!storeExamId || questions.length === 0) {
      showToast(
        "Exam is still loading. Please wait a moment and try again.",
        "warning"
      );
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

      // Mark as finished and clear unsaved changes
      setHasFinished(true);
      setHasUnsavedChanges(false);

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
        showToast("Error: Could not load exam results", "error");
      }
    } catch (e: any) {
      console.error("Failed to submit practice:", e);
      showToast(
        e?.response?.data?.detail ||
          e?.message ||
          "Failed to submit practice. Please try again.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPractice = () => {
    if (hasFinished || isSubmitting) return;
    if (!storeExamId || questions.length === 0) {
      showToast(
        "Exam is still loading. Please wait a moment and try again.",
        "warning"
      );
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

    // 1. Checked/Completed -> Red/Green
    if (completedQuestions.has(questionId)) {
      if (questionId in questionResults) {
        const isCorrect = questionResults[questionId];
        return isCorrect ? (darkMode ? "#4CAF50" : "#28a745") : theme.btnDanger;
      }
      // Fallback if result not loaded but marked completed (shouldn't happen often)
      return theme.border;
    }

    // 2. Answered but NOT checked -> Medium Gray
    const userAnswer = answers[questionId];
    const hasAnswer =
      userAnswer !== undefined &&
      userAnswer !== null &&
      userAnswer !== "" &&
      !(Array.isArray(userAnswer) && userAnswer.length === 0);

    if (hasAnswer) {
      return darkMode ? "#666" : "#ced4da"; // Medium gray
    }

    // 3. Unanswered -> Light/White
    return darkMode ? "#4d4d4d" : "#f8f9fa"; // Very light gray / default
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
        <button
          onClick={() => nav("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            color: theme.textSecondary,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 16,
            padding: "4px 0",
            opacity: 0.8,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
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
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Dashboard
        </button>

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
                disabled={isSubmitting || hasFinished}
                style={{
                  padding: idx === currentQuestionIndex ? 6 : 8,
                  borderRadius: 6,
                  border: `${
                    idx === currentQuestionIndex ? "4px" : "2px"
                  } solid ${
                    idx === currentQuestionIndex
                      ? theme.btnWarning
                      : theme.border
                  }`,
                  background: getQuestionStatusColor(idx),
                  cursor:
                    isSubmitting || hasFinished ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  color: isAnswered ? "white" : theme.text,
                  opacity: isSubmitting || hasFinished ? 0.6 : 1,
                }}
                title={`Question ${idx + 1}${
                  completedQuestions.has(q.id) ? " (Completed)" : ""
                }${
                  isSubmitting || hasFinished ? " - Submission in progress" : ""
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Save Progress Button */}
        <button
          onClick={handleSaveProgress}
          disabled={isSaving || isSubmitting}
          style={{
            width: "100%",
            padding: "10px 16px",
            marginTop: "12px",
            background:
              isSaving || isSubmitting ? theme.border : theme.btnSecondary,
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 700,
            cursor: isSaving || isSubmitting ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            opacity: isSaving || isSubmitting ? 0.6 : 1,
            boxShadow:
              isSaving || isSubmitting
                ? "none"
                : `0 4px 14px ${theme.btnSecondary}50`,
          }}
          onMouseEnter={(e) => {
            if (!isSaving && !isSubmitting) {
              e.currentTarget.style.background = theme.btnSecondaryHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isSaving && !isSubmitting) {
              e.currentTarget.style.background = theme.btnSecondary;
            }
          }}
        >
          {isSaving ? "Saving..." : "Save Progress"}
        </button>
        {lastSavedAt && (
          <div
            style={{
              fontSize: 11,
              color: theme.textSecondary,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            Saved {lastSavedAt.toLocaleTimeString()}
          </div>
        )}

        {/* Submit Practice - Sidebar (below question index) */}
        {/* Show submit button if at least one question is answered */}
        {(completedQuestions.size > 0 || Object.keys(answers).length > 0) && (
          <button
            onClick={handleSubmitPractice}
            disabled={
              hasFinished ||
              isSubmitting ||
              !storeExamId ||
              questions.length === 0
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              background:
                hasFinished ||
                isSubmitting ||
                !storeExamId ||
                questions.length === 0
                  ? theme.border
                  : theme.crimson,
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor:
                hasFinished ||
                isSubmitting ||
                !storeExamId ||
                questions.length === 0
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 700,
              fontSize: 14,
              marginTop: 12,
              transition: "0.2s",
              opacity:
                hasFinished ||
                isSubmitting ||
                !storeExamId ||
                questions.length === 0
                  ? 0.6
                  : 1,
              boxShadow:
                hasFinished ||
                isSubmitting ||
                !storeExamId ||
                questions.length === 0
                  ? "none"
                  : `0 4px 14px ${theme.crimson}50`,
            }}
            onMouseEnter={(e) => {
              if (
                !(
                  hasFinished ||
                  isSubmitting ||
                  !storeExamId ||
                  questions.length === 0
                )
              ) {
                e.currentTarget.style.background = theme.crimsonDark;
                e.currentTarget.style.boxShadow = `0 6px 20px ${theme.crimson}60`;
              }
            }}
            onMouseLeave={(e) => {
              if (
                !(
                  hasFinished ||
                  isSubmitting ||
                  !storeExamId ||
                  questions.length === 0
                )
              ) {
                e.currentTarget.style.background = theme.crimson;
                e.currentTarget.style.boxShadow = `0 4px 14px ${theme.crimson}50`;
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
                ? "You haven't checked all questions. Click to submit anyway."
                : "Submit practice for review"
            }
          >
            {isSubmitting
              ? "Submitting..."
              : hasFinished
              ? "Submitted"
              : "Submit Practice"}
          </button>
        )}

        {/* Submission status indicator */}
        {isSubmitting && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              background: theme.btnInfo,
              color: "white",
              borderRadius: 6,
              fontSize: 12,
              textAlign: "center",
              fontWeight: 500,
            }}
          >
            Grading your practice attempt...
          </div>
        )}
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
              disabled={
                currentQuestionIndex === 0 || isSubmitting || hasFinished
              }
              style={{
                padding: "8px 14px",
                width: "90px",
                background: "rgba(196, 30, 58, 0.08)",
                color: theme.crimson,
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 6,
                cursor:
                  currentQuestionIndex === 0 || isSubmitting || hasFinished
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  currentQuestionIndex === 0 || isSubmitting || hasFinished
                    ? 0.5
                    : 1,
                fontSize: 13,
                fontWeight: 500,
                transition: "0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                if (
                  currentQuestionIndex !== 0 &&
                  !isSubmitting &&
                  !hasFinished
                ) {
                  e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (
                  currentQuestionIndex !== 0 &&
                  !isSubmitting &&
                  !hasFinished
                ) {
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
              onClick={nextQuestion}
              disabled={isSubmitting || hasFinished}
              style={{
                padding: "8px 14px",
                width: "90px",
                background: "rgba(196, 30, 58, 0.08)",
                color: theme.crimson,
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 6,
                cursor: isSubmitting || hasFinished ? "not-allowed" : "pointer",
                opacity: isSubmitting || hasFinished ? 0.5 : 1,
                fontSize: 13,
                fontWeight: 500,
                transition: "0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting && !hasFinished) {
                  e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting && !hasFinished) {
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
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {!showAnswer && (
              <button
                onClick={checkAnswer}
                disabled={isSubmitting || hasFinished}
                style={{
                  padding: "12px 32px",
                  background:
                    isSubmitting || hasFinished
                      ? theme.border
                      : darkMode
                      ? "rgba(40, 167, 69, 0.7)"
                      : "#1e7e34",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "-0.2px",
                  cursor:
                    isSubmitting || hasFinished ? "not-allowed" : "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  opacity: isSubmitting || hasFinished ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && !hasFinished) {
                    e.currentTarget.style.opacity = "0.85";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting && !hasFinished) {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                Check Answer
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Resume Attempt Modal */}
      <ResumeAttemptModal
        isOpen={showResumeModal}
        onResume={handleResume}
        onStartNew={handleStartNew}
        darkMode={darkMode}
        theme={theme}
      />

      {/* Navigation Guard Modal */}
      <NavigationGuardModal
        isOpen={showNavGuard}
        onSaveAndLeave={handleSaveAndLeave}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        onCancel={handleCancelNavigation}
        darkMode={darkMode}
        theme={theme}
      />
    </div>
  );
}
