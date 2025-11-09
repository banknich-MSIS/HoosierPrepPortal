import React, { useState } from "react";

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  theme: any;
}

const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  theme,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const steps = [
    {
      title: "Welcome to Hoosier Prep Portal!",
      content: (
        <div>
          <p>
            This tool helps you create and take practice exams from your study
            materials using AI-powered generation.
          </p>
          <p>Choose between two approaches based on your preference.</p>
        </div>
      ),
    },
    {
      title: "Two Ways to Generate Exams",
      content: (
        <div>
          <div style={{ marginBottom: 20 }}>
            <strong style={{ color: theme.crimson }}>
              Option 1: AI Exam Creator (Built-in)
            </strong>
            <p>
              Fast and streamlined. Upload files, configure settings, and
              generate instantly—no conversation needed.
            </p>
          </div>
          <div>
            <strong style={{ color: theme.amber }}>
              Option 2: Manual Creator (Consultative Chat)
            </strong>
            <p>
              Guided, interactive experience with built-in AI chat. Talk with the assistant about your study goals, upload documents during the conversation, and refine your exam plan before generating.
            </p>
            <p style={{ fontSize: 14, color: theme.textSecondary }}>
              Perfect for when you want guidance on what to study, how to structure your materials, or need help deciding on question types and difficulty levels.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Step 2: Using Manual Creator Chat",
      content: (
        <div>
          <p>If you choose the Manual Creator with chat guidance:</p>
          <ol style={{ paddingLeft: 20, marginTop: 12 }}>
            <li>Chat with the AI assistant about your study goals</li>
            <li>Upload documents during the conversation</li>
            <li>Configure exam settings (question count, difficulty, types)</li>
            <li>Generate your exam - it appears automatically in your Dashboard</li>
          </ol>
          <p style={{ marginTop: 12, fontSize: 14, color: theme.textSecondary }}>
            The chat assistant helps you plan and refine your approach before generating questions.
          </p>
        </div>
      ),
    },
    {
      title: "Step 3: Take Your Exam",
      content: (
        <div>
          <p>Start your practice exam from the Dashboard!</p>
          <p>
            Answer questions, get instant feedback, and track your progress.
          </p>
          <p>Review your results to identify areas for improvement.</p>
          <div
            style={{ marginTop: 12, fontSize: 12, color: theme.textSecondary }}
          >
            Tip: You can also manually upload CSV files if you have pre-existing question sets.
          </div>
        </div>
      ),
    },
  ];

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("studytool_tutorial_completed", "true");
    }
    onClose();
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.modalBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
          border: `1px solid ${theme.glassBorder}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 24, color: theme.text }}>
            {steps[currentStep].title}
          </h2>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              justifyContent: "center",
            }}
          >
            {steps.map((_, index) => (
              <div
                key={index}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor:
                    index === currentStep ? theme.crimson : theme.border,
                }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ marginBottom: 24, lineHeight: 1.6, color: theme.text }}>
          {steps[currentStep].content}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${theme.border}`,
            paddingTop: 16,
          }}
        >
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                color: theme.text,
              }}
            >
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              Don't show this again
            </label>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                style={{
                  padding: "8px 20px",
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  background: "transparent",
                  color: theme.text,
                  cursor: "pointer",
                  fontWeight: 500,
                  letterSpacing: "-0.2px",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(196, 30, 58, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Previous
              </button>
            )}
            <button
              onClick={nextStep}
              style={{
                padding: "8px 20px",
                border: "none",
                borderRadius: 6,
                background: theme.crimson,
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                letterSpacing: "-0.2px",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 2px 8px rgba(196, 30, 58, 0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(196, 30, 58, 0.35)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 2px 8px rgba(196, 30, 58, 0.25)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
