import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchClasses,
  assignUploadToClass,
  removeUploadFromClass,
  createClass,
  deleteClass,
} from "../api/client";
import type { ClassSummary } from "../types";

interface ClassTagSelectorProps {
  uploadId: number;
  currentTags: string[];
  onUpdate: () => void;
  darkMode: boolean;
  theme: any;
}

export default function ClassTagSelector({
  uploadId,
  currentTags,
  onUpdate,
  darkMode,
  theme,
}: ClassTagSelectorProps) {
  const navigate = useNavigate();
  const [allClasses, setAllClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#c41e3a");

  const CLASS_COLORS = [
    // Theme colors first
    {
      name: "Crimson",
      value: "#c41e3a",
      darkBg: "#3d1a1f",
      darkText: "#e85568",
    },
    {
      name: "Mustard",
      value: "#c29b4a",
      darkBg: "#3d3520",
      darkText: "#d4ad5e",
    },
    // Grayscale palette
    {
      name: "Dark Gray",
      value: "#4b5563",
      darkBg: "#2d2d2d",
      darkText: "#9ca3af",
    },
    {
      name: "Medium Gray",
      value: "#6b7280",
      darkBg: "#353535",
      darkText: "#b0b7c0",
    },
    {
      name: "Light Gray",
      value: "#9ca3af",
      darkBg: "#404040",
      darkText: "#d1d5db",
    },
    { name: "Slate", value: "#64748b", darkBg: "#2a323d", darkText: "#94a3b8" },
    // Subtle accent colors
    {
      name: "Blue Gray",
      value: "#475569",
      darkBg: "#1e2933",
      darkText: "#8b98ab",
    },
    {
      name: "Cool Gray",
      value: "#6c757d",
      darkBg: "#2d3032",
      darkText: "#b0bec5",
    },
  ];

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await fetchClasses();
      setAllClasses(data);
    } catch (e) {
      console.error("Failed to load classes:", e);
    }
  };

  const handleToggleClass = async (classId: number, className: string) => {
    setLoading(true);
    try {
      if (currentTags.includes(className)) {
        // Remove
        await removeUploadFromClass(uploadId, classId);
      } else {
        // Add
        await assignUploadToClass(uploadId, classId);
      }
      onUpdate();
    } catch (e: any) {
      alert(`Failed to update class: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const newCls = await createClass(newName.trim(), undefined, newColor);
      // Assign the current upload to the new class
      await assignUploadToClass(uploadId, newCls.id);
      await loadClasses();
      setShowCreateModal(false);
      setNewName("");
      setNewColor("#c41e3a");
      onUpdate();
    } catch (e: any) {
      alert(`Failed to create class: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (
    classId: number,
    className: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (
      !confirm(
        `Delete class "${className}"? This will unassign it from all uploads.`
      )
    )
      return;
    setLoading(true);
    try {
      await deleteClass(classId);
      await loadClasses();
      onUpdate();
    } catch (e: any) {
      alert(`Failed to delete class: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minWidth: 220 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: theme.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Classes
        </span>
      </div>

      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {allClasses.length === 0 ? (
          <div
            style={{
              padding: 12,
              color: theme.textSecondary,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            No classes available.
          </div>
        ) : (
          allClasses.map((cls) => {
            const isSelected = currentTags.includes(cls.name);
            return (
              <div
                key={cls.id}
                onClick={() => handleToggleClass(cls.id, cls.name)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: `1px solid ${theme.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: isSelected
                    ? darkMode
                      ? "#2a4a62"
                      : "#e3f2fd"
                    : theme.cardBg,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      theme.navHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      theme.cardBg;
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  style={{ cursor: "pointer" }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: cls.color || "#007bff",
                    marginRight: 4,
                  }}
                />
                <span style={{ fontSize: 14, color: theme.text, flex: 1 }}>
                  {cls.name}
                </span>
                <button
                  onClick={(e) => handleDeleteClass(cls.id, cls.name, e)}
                  onMouseEnter={() => setHoveredButton(`delete-${cls.id}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  style={{
                    padding: "4px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: theme.textSecondary,
                    opacity: hoveredButton === `delete-${cls.id}` ? 1 : 0.6,
                    transition: "opacity 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Delete class"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create Class Modal - Temporarily Hidden */}
      {false && showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: darkMode ? "#2d1819" : "#ffffff",
              borderRadius: 12,
              border: `1px solid ${theme.glassBorder}`,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
              padding: 24,
              width: "90%",
              maxWidth: 450,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: 20,
                fontWeight: 700,
                color: theme.crimson,
              }}
            >
              Create New Class
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                Class Name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Finance 101"
                disabled={loading}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  background: darkMode ? "#1a1a1a" : "#fff",
                  color: theme.text,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    handleCreate();
                  }
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.text,
                  marginBottom: 8,
                }}
              >
                Color
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 8,
                }}
              >
                {CLASS_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.value}
                    onClick={() => setNewColor(colorOption.value)}
                    disabled={loading}
                    style={{
                      width: "100%",
                      height: 36,
                      borderRadius: 6,
                      border:
                        newColor === colorOption.value
                          ? `3px solid ${theme.crimson}`
                          : `1px solid ${theme.glassBorder}`,
                      backgroundColor: darkMode
                        ? colorOption.darkBg
                        : colorOption.value,
                      cursor: loading ? "not-allowed" : "pointer",
                      transition: "all 0.2s ease",
                      transform:
                        newColor === colorOption.value
                          ? "scale(1.1)"
                          : "scale(1)",
                    }}
                    title={colorOption.name}
                  />
                ))}
              </div>
            </div>

            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewName("");
                  setNewColor("#c41e3a");
                }}
                disabled={loading}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  color: theme.textSecondary,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !newName.trim()}
                style={{
                  padding: "10px 20px",
                  background:
                    loading || !newName.trim()
                      ? theme.textSecondary
                      : theme.crimson,
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor:
                    loading || !newName.trim() ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
              >
                {loading ? "Creating..." : "Create Class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
