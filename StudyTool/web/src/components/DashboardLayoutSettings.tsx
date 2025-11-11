import React, { useState } from "react";

export interface DashboardSection {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

interface DashboardLayoutSettingsProps {
  sections: DashboardSection[];
  onSave: (sections: DashboardSection[]) => void;
  onChange: (sections: DashboardSection[]) => void; // Preview changes immediately
  onClose: () => void;
  darkMode: boolean;
  theme: any;
}

export default function DashboardLayoutSettings({
  sections,
  onSave,
  onChange,
  onClose,
  darkMode,
  theme,
}: DashboardLayoutSettingsProps) {
  const [localSections, setLocalSections] = useState<DashboardSection[]>(
    [...sections].sort((a, b) => a.order - b.order)
  );
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const toggleVisibility = (id: string) => {
    const newSections = localSections.map((section) =>
      section.id === id ? { ...section, visible: !section.visible } : section
    );
    setLocalSections(newSections);
    onChange(newSections); // Immediately preview in parent
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newSections = [...localSections];
    [newSections[index - 1], newSections[index]] = [
      newSections[index],
      newSections[index - 1],
    ];
    // Update order values
    newSections.forEach((section, idx) => {
      section.order = idx;
    });
    setLocalSections(newSections);
    onChange(newSections); // Immediately preview in parent
  };

  const moveDown = (index: number) => {
    if (index === localSections.length - 1) return;
    const newSections = [...localSections];
    [newSections[index], newSections[index + 1]] = [
      newSections[index + 1],
      newSections[index],
    ];
    // Update order values
    newSections.forEach((section, idx) => {
      section.order = idx;
    });
    setLocalSections(newSections);
    onChange(newSections); // Immediately preview in parent
  };

  const handleSave = () => {
    onSave(localSections);
    onClose();
  };

  const handleReset = () => {
    const resetSections = localSections.map((section, index) => ({
      ...section,
      visible: true,
      order: index,
    }));
    setLocalSections(resetSections);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.cardBg,
          borderRadius: 16,
          padding: 32,
          maxWidth: 600,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          border: `1px solid ${theme.glassBorder}`,
          boxShadow: theme.glassShadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: "0 0 8px 0",
            fontSize: 24,
            fontWeight: 700,
            color: theme.crimson,
          }}
        >
          Dashboard Layout Settings
        </h2>
        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: 14,
            color: theme.textSecondary,
          }}
        >
          Customize which sections appear on your dashboard and their order.
        </p>

        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          {localSections.map((section, index) => (
            <div
              key={section.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 16,
                background: darkMode
                  ? "rgba(255, 255, 255, 0.03)"
                  : "rgba(0, 0, 0, 0.03)",
                borderRadius: 8,
                border: `1px solid ${theme.glassBorder}`,
              }}
            >
              {/* Visibility Toggle */}
              <button
                onClick={() => toggleVisibility(section.id)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  border: `2px solid ${
                    section.visible ? theme.crimson : theme.glassBorder
                  }`,
                  background: section.visible
                    ? darkMode
                      ? "rgba(196, 30, 58, 0.15)"
                      : "rgba(196, 30, 58, 0.1)"
                    : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
              >
                {section.visible ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.crimson}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : null}
              </button>

              {/* Section Title */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: section.visible ? theme.text : theme.textSecondary,
                    textDecoration: section.visible ? "none" : "line-through",
                  }}
                >
                  {section.title}
                </div>
              </div>

              {/* Move Up/Down Buttons */}
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: `1px solid ${theme.glassBorder}`,
                    background: "transparent",
                    color: theme.text,
                    cursor: index === 0 ? "not-allowed" : "pointer",
                    opacity: index === 0 ? 0.4 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                  title="Move up"
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
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === localSections.length - 1}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: `1px solid ${theme.glassBorder}`,
                    background: "transparent",
                    color: theme.text,
                    cursor:
                      index === localSections.length - 1
                        ? "not-allowed"
                        : "pointer",
                    opacity: index === localSections.length - 1 ? 0.4 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                  title="Move down"
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
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={handleReset}
            onMouseEnter={() => setHoveredButton("reset")}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              padding: "10px 20px",
              background: "transparent",
              color: theme.textSecondary,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s ease",
              opacity: hoveredButton === "reset" ? 0.8 : 1,
            }}
          >
            Reset to Default
          </button>
          <button
            onClick={onClose}
            onMouseEnter={() => setHoveredButton("cancel")}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              padding: "10px 20px",
              background: "transparent",
              color: theme.textSecondary,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s ease",
              opacity: hoveredButton === "cancel" ? 0.8 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            onMouseEnter={() => setHoveredButton("save")}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              padding: "10px 20px",
              background:
                hoveredButton === "save" ? theme.crimsonDark : theme.crimson,
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.3s ease",
              boxShadow:
                hoveredButton === "save"
                  ? "0 6px 20px rgba(196, 30, 58, 0.4)"
                  : "0 3px 12px rgba(196, 30, 58, 0.3)",
            }}
          >
            Save Layout
          </button>
        </div>
      </div>
    </div>
  );
}
