import React from "react";

interface NavigationGuardModalProps {
  isOpen: boolean;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  onCancel: () => void;
  darkMode: boolean;
  theme: any;
}

export default function NavigationGuardModal({
  isOpen,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onCancel,
  darkMode,
  theme,
}: NavigationGuardModalProps) {
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
      onClick={onCancel}
    >
      <div
        style={{
          background: theme.modalBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          padding: "32px",
          borderRadius: 16,
          maxWidth: 500,
          width: "90%",
          border: `1px solid ${theme.glassBorder}`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: "0 0 16px 0",
            color: theme.text,
            fontWeight: 700,
            fontSize: 22,
          }}
        >
          Leave this exam?
        </h3>
        <p
          style={{
            margin: "0 0 32px 0",
            lineHeight: "1.6",
            fontSize: 16,
            color: theme.textSecondary,
          }}
        >
          You have unsaved exam progress. If you leave this page without saving,
          your current attempt may be lost.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "12px 20px",
              background: "transparent",
              color: theme.text,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
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
            onClick={onLeaveWithoutSaving}
            style={{
              padding: "12px 20px",
              background: "transparent",
              color: theme.crimson,
              border: `1px solid ${theme.crimson}40`,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.crimson;
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = theme.crimson;
            }}
          >
            Leave Without Saving
          </button>

          <button
            onClick={onSaveAndLeave}
            style={{
              padding: "12px 24px",
              background: theme.btnSuccess || "#28a745", // Use green for save action
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: `0 4px 14px ${theme.btnSuccess || "#28a745"}50`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(0.9)";
              e.currentTarget.style.boxShadow = `0 6px 20px ${theme.btnSuccess || "#28a745"}60`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
              e.currentTarget.style.boxShadow = `0 4px 14px ${theme.btnSuccess || "#28a745"}50`;
            }}
          >
            Save & Leave
          </button>
        </div>
      </div>
    </div>
  );
}

