import React from "react";

interface ResumeAttemptModalProps {
  isOpen: boolean;
  onResume: () => void;
  onStartNew: () => void;
  darkMode: boolean;
  theme: any;
}

export default function ResumeAttemptModal({
  isOpen,
  onResume,
  onStartNew,
  darkMode,
  theme,
}: ResumeAttemptModalProps) {
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
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: theme.modalBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          padding: 24,
          borderRadius: 12,
          maxWidth: 450,
          width: "90%",
          border: `1px solid ${theme.glassBorder}`,
          boxShadow: theme.glassShadowHover,
        }}
      >
        <h3
          style={{
            margin: "0 0 16px 0",
            color: theme.amber,
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          Resume saved attempt?
        </h3>
        <p
          style={{
            margin: "0 0 24px 0",
            lineHeight: "1.6",
            fontSize: 15,
            color: theme.text,
          }}
        >
          You have in-progress work for this exam. Would you like to resume
          where you left off, or start a new attempt?
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={onStartNew}
            style={{
              padding: "10px 20px",
              background: "transparent",
              color: theme.text,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
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
            Start New Attempt
          </button>
          <button
            onClick={onResume}
            style={{
              padding: "10px 20px",
              background: theme.btnSecondary,
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.btnSecondaryHover;
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.btnSecondary;
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
            }}
          >
            Resume Saved Attempt
          </button>
        </div>
      </div>
    </div>
  );
}

