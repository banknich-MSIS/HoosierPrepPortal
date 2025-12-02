import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams, useOutletContext, useBlocker, useLocation } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { useExamStore } from "../store/examStore";
import QuestionCard from "../components/QuestionCard";
import QuestionNavigator from "../components/QuestionNavigator";
import BookmarkButton from "../components/BookmarkButton";
import NavigationGuardModal from "../components/NavigationGuardModal";
import ResumeAttemptModal from "../components/ResumeAttemptModal";
import {
  gradeExam,
  startAttempt,
  getInProgressAttempt,
  saveProgress,
} from "../api/client";
import { shuffleWithSeed } from "../utils/shuffle";

export default function ExamPage() {
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
    bookmarks,
    currentIndex,
    setExam,
    setAnswer,
    goTo,
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
  const [savedAnswersJson, setSavedAnswersJson] = useState<string>("{}");
  
  // Progress saving state
  const [currentAttemptId, setCurrentAttemptId] = useState<number | null>(null);
  
  // ADD THIS: Shuffle questions based on attempt ID
  const shuffledQuestions = useMemo(() => {
    if (currentAttemptId && questions.length > 0) {
      return shuffleWithSeed([...questions], currentAttemptId);
    }
    return questions;
  }, [questions, currentAttemptId]);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showNavGuard, setShowNavGuard] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const hasCheckedResume = useRef(false);

  // Track unsaved changes
  useEffect(() => {
    const currentAnswersJson = JSON.stringify(answers);
    setHasUnsavedChanges(
      currentAnswersJson !== savedAnswersJson && !hasSubmitted && !isSubmitting
    );
  }, [answers, savedAnswersJson, hasSubmitted, isSubmitting]);

  // Navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      !hasSubmitted &&
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
      // Store the shuffled question order
      const questionOrder = shuffledQuestions.map(q => q.id);
      
      await saveProgress(currentAttemptId, {
        answers,
        bookmarks: Array.from(bookmarks),
        current_question_index: currentIndex,
        timer_state: null, // Timer not implemented yet
        exam_type: "exam",
        question_order: questionOrder, // Store the shuffled order
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
      if (hasUnsavedChanges && !hasSubmitted && !isSubmitting) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
        return "You have unsaved progress. Your answers will be lost if you leave now.";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, hasSubmitted, isSubmitting]);

  // Helper to restore attempt
  const restoreAttempt = async (attemptId: number) => {
    try {
      const { getProgress } = await import("../api/client");
      const progress = await getProgress(attemptId);

      // Restore answers
      Object.entries(progress.saved_answers).forEach(([qId, answer]) => {
        setAnswer(Number(qId), answer);
      });

      // Restore bookmarks
      if (progress.progress_state?.bookmarks) {
        const store = useExamStore.getState();
        progress.progress_state.bookmarks.forEach((qId: number) => {
          if (!store.bookmarks.has(qId)) {
            store.toggleBookmark(qId);
          }
        });
      }

      // Restore current question index
      if (progress.progress_state?.current_question_index !== undefined) {
        goTo(progress.progress_state.current_question_index);
      }

      setSavedAnswersJson(JSON.stringify(progress.saved_answers || {}));
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
    // Start new attempt
    if (examId) {
      try {
        const newAttempt = await startAttempt(Number(examId));
        setCurrentAttemptId(newAttempt.attempt_id);
        setExamStartTime(Date.now());
      } catch (error) {
        console.error("Failed to start new attempt:", error);
      }
    }
  };

  useEffect(() => {
    const loadExam = async () => {
      if (!examId) return;

      // If switching to a different exam, clear any stale in-memory state first
      if (storeExamId && Number(examId) !== storeExamId) {
        reset();
        hasCheckedResume.current = false;
        setCurrentAttemptId(null);
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

  // Clear in-memory exam only on unmount (not on every re-render)
  useEffect(() => {
    return () => {
      // Don't reset on unmount if we're just navigating
      // reset();
    };
  }, []);

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
    setHasUnsavedChanges(false); // No longer unsaved
    try {
      // Use shuffledQuestions to preserve the order the user took the exam in
      const payload = shuffledQuestions.map((it) => ({
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
        showToast("Error: Could not load exam results", "error");
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error submitting exam:", error);
      showToast(
        `Failed to submit exam: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
      setIsSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    // Check for unanswered questions (use shuffledQuestions to match display order)
    const unansweredQuestions = shuffledQuestions.filter((q) => {
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
      const firstUnansweredIndex = shuffledQuestions.findIndex(
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Dashboard
          </button>

          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "18px",
              color: theme.text,
            }}
          >
            Questions
          </h3>
          <QuestionNavigator
            darkMode={darkMode}
            theme={theme}
            questions={shuffledQuestions}
          />

          {/* Save Progress Button */}
          <button
            onClick={handleSaveProgress}
            disabled={isSaving || isSubmitting}
            style={{
              width: "100%",
              padding: "10px 16px",
              marginTop: "12px",
              background: isSaving || isSubmitting ? theme.border : theme.btnSecondary,
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              cursor: isSaving || isSubmitting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: isSaving || isSubmitting ? 0.6 : 1,
              boxShadow: isSaving || isSubmitting ? "none" : `0 4px 14px ${theme.btnSecondary}50`,
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

          {/* Submit Button */}
          <button
            onClick={handleSubmitClick}
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "12px 20px",
              marginTop: "12px",
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
                : `0 4px 14px ${theme.crimson}50`,
              opacity: isSubmitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = theme.crimsonDark;
                e.currentTarget.style.boxShadow = `0 6px 20px ${theme.crimson}60`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = theme.crimson;
                e.currentTarget.style.boxShadow = `0 4px 14px ${theme.crimson}50`;
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
            {shuffledQuestions.map((question, index) => (
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
                  attemptId={currentAttemptId}
                />
              </div>
            ))}
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
                    boxShadow: `0 4px 14px ${theme.crimson}50`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.crimsonDark;
                    e.currentTarget.style.boxShadow = `0 6px 20px ${theme.crimson}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.crimson;
                    e.currentTarget.style.boxShadow = `0 4px 14px ${theme.crimson}50`;
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
