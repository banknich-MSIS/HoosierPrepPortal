import React, { useState, useEffect } from "react";

export interface DashboardSection {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

interface DashboardLayoutSettingsProps {
  sections: DashboardSection[];
  onSave: (sections: DashboardSection[]) => void;
  onClose: () => void;
  darkMode: boolean;
  theme: any;
}

export default function DashboardLayoutSettings({
  sections,
  onSave,
  onClose,
  darkMode,
  theme,
}: DashboardLayoutSettingsProps) {
  const [localSections, setLocalSections] = useState<DashboardSection[]>(
    sections.map((s) => ({ ...s })).sort((a, b) => a.order - b.order)
  );
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Reset localSections when modal opens with updated sections
  useEffect(() => {
    setLocalSections(
      sections.map((s) => ({ ...s })).sort((a, b) => a.order - b.order)
    );
  }, [sections]);

  const toggleVisibility = (id: string) => {
    const newSections = localSections.map((section) =>
      section.id === id ? { ...section, visible: !section.visible } : section
    );
    setLocalSections(newSections);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSections = [...localSections];
    const draggedSection = newSections[draggedIndex];

    // Remove from old position
    newSections.splice(draggedIndex, 1);
    // Insert at new position
    newSections.splice(dropIndex, 0, draggedSection);

    // Update order values
    newSections.forEach((section, idx) => {
      section.order = idx;
    });

    setLocalSections(newSections);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = () => {
    onSave(localSections);
    onClose();
  };

  const handleCancel = () => {
    // Just close without saving
    onClose();
  };

  const handleReset = () => {
    // Default order: Performance Analytics, Recent Exam History, CSV Library
    const defaultOrder = ["analytics", "history", "library"];

    const resetSections = localSections
      .map((section) => {
        const defaultIndex = defaultOrder.indexOf(section.id);
        return {
          ...section,
          visible: true,
          order: defaultIndex !== -1 ? defaultIndex : section.order,
        };
      })
      .sort((a, b) => a.order - b.order);

    setLocalSections(resetSections);
  };

  // Check if sections are already in default order
  const isDefaultOrder = () => {
    const defaultOrder = ["analytics", "history", "library"];
    const sortedSections = [...localSections].sort((a, b) => a.order - b.order);

    return sortedSections.every((section, index) => {
      return section.id === defaultOrder[index] && section.visible === true;
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
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
          Drag sections to reorder them, and toggle visibility with the
          checkboxes. Click Save Layout to apply changes.
        </p>

        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          {localSections.map((section, index) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 16,
                background:
                  draggedIndex === index
                    ? darkMode
                      ? "rgba(196, 30, 58, 0.1)"
                      : "rgba(196, 30, 58, 0.05)"
                    : dragOverIndex === index
                    ? darkMode
                      ? "rgba(194, 155, 74, 0.1)"
                      : "rgba(194, 155, 74, 0.05)"
                    : darkMode
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.03)",
                borderRadius: 8,
                border:
                  dragOverIndex === index
                    ? `2px solid ${theme.crimson}`
                    : `1px solid ${theme.glassBorder}`,
                cursor: "grab",
                transition: "all 0.2s ease",
                opacity: draggedIndex === index ? 0.5 : 1,
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

              {/* Drag Handle */}
              <div
                style={{
                  padding: "0 8px",
                  color: theme.textSecondary,
                  cursor: "grab",
                  display: "flex",
                  alignItems: "center",
                }}
                title="Drag to reorder"
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
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </div>

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
            onMouseEnter={() => !isDefaultOrder() && setHoveredButton("reset")}
            onMouseLeave={() => setHoveredButton(null)}
            disabled={isDefaultOrder()}
            style={{
              padding: "10px 20px",
              background: "transparent",
              color: isDefaultOrder() ? theme.glassBorder : theme.textSecondary,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: 8,
              cursor: isDefaultOrder() ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s ease",
              opacity: isDefaultOrder()
                ? 0.4
                : hoveredButton === "reset"
                ? 0.8
                : 1,
            }}
          >
            Reset to Default
          </button>
          <button
            onClick={handleCancel}
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
